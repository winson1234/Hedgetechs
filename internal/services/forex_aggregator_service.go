package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// CurrentBar holds in-memory OHLC data for one 1-minute bar
type CurrentBar struct {
	Symbol    string
	Timestamp time.Time // Truncated to minute
	OpenBid   float64
	HighBid   float64
	LowBid    float64
	CloseBid  float64
	OpenAsk   float64
	HighAsk   float64
	LowAsk    float64
	CloseAsk  float64
	TickCount int
	mu        sync.Mutex
}

// ForexAggregatorService aggregates ticks from Redis into 1-minute OHLC bars
type ForexAggregatorService struct {
	redisClient *redis.Client
	db          *pgxpool.Pool
	bars        map[string]*CurrentBar // symbol -> current bar
	mu          sync.RWMutex
}

// NewForexAggregatorService creates a new forex aggregator service
func NewForexAggregatorService(db *pgxpool.Pool, redisClient *redis.Client) *ForexAggregatorService {
	return &ForexAggregatorService{
		redisClient: redisClient,
		db:          db,
		bars:        make(map[string]*CurrentBar),
	}
}

// StartAggregator begins subscribing to Redis and aggregating ticks
func (s *ForexAggregatorService) StartAggregator(ctx context.Context) {
	log.Println("[Forex Aggregator] Starting tick aggregation service...")

	// Subscribe to Redis fx_price_updates channel
	pubsub := s.redisClient.Subscribe(ctx, "fx_price_updates")
	defer pubsub.Close()

	// Start flush ticker (every 1 minute)
	flushTicker := time.NewTicker(1 * time.Minute)
	defer flushTicker.Stop()

	// Process ticks in goroutine
	go s.processTicks(ctx, pubsub)

	// Flush bars every minute
	go s.flushBars(ctx, flushTicker)

	log.Println("[Forex Aggregator] Service started successfully")

	// Keep service running
	<-ctx.Done()
	log.Println("[Forex Aggregator] Service shutting down...")
}

// processTicks reads ticks from Redis and updates in-memory bars
func (s *ForexAggregatorService) processTicks(ctx context.Context, pubsub *redis.PubSub) {
	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			var tick struct {
				Symbol    string  `json:"symbol"`
				Bid       float64 `json:"bid"`
				Ask       float64 `json:"ask"`
				Timestamp int64   `json:"timestamp"` // Milliseconds
			}

			if err := json.Unmarshal([]byte(msg.Payload), &tick); err != nil {
				log.Printf("[Forex Aggregator] ERROR: Failed to parse tick: %v", err)
				continue
			}

			// Cache current price to Redis (for API reads)
			priceData := map[string]interface{}{
				"bid":       tick.Bid,
				"ask":       tick.Ask,
				"timestamp": tick.Timestamp,
			}
			priceJSON, _ := json.Marshal(priceData)
			s.redisClient.Set(ctx, "forex:price:"+tick.Symbol, priceJSON, 5*time.Minute)

			// Update in-memory bar
			s.updateBar(tick.Symbol, tick.Bid, tick.Ask, tick.Timestamp)
		}
	}
}

// updateBar updates the OHLC values for the current minute bar
func (s *ForexAggregatorService) updateBar(symbol string, bid, ask float64, tsMillis int64) {
	barTime := time.Unix(tsMillis/1000, 0).Truncate(time.Minute)

	s.mu.Lock()
	bar, exists := s.bars[symbol]
	if !exists || !bar.Timestamp.Equal(barTime) {
		// New bar for this minute
		bar = &CurrentBar{
			Symbol:    symbol,
			Timestamp: barTime,
			OpenBid:   bid,
			HighBid:   bid,
			LowBid:    bid,
			CloseBid:  bid,
			OpenAsk:   ask,
			HighAsk:   ask,
			LowAsk:    ask,
			CloseAsk:  ask,
			TickCount: 0,
		}
		s.bars[symbol] = bar
	}
	s.mu.Unlock()

	// Update OHLC (thread-safe)
	bar.mu.Lock()
	defer bar.mu.Unlock()

	// Update bid OHLC
	if bid > bar.HighBid {
		bar.HighBid = bid
	}
	if bid < bar.LowBid {
		bar.LowBid = bid
	}
	bar.CloseBid = bid

	// Update ask OHLC
	if ask > bar.HighAsk {
		bar.HighAsk = ask
	}
	if ask < bar.LowAsk {
		bar.LowAsk = ask
	}
	bar.CloseAsk = ask

	bar.TickCount++
}

// flushBars writes completed bars to database using batch insert
func (s *ForexAggregatorService) flushBars(ctx context.Context, ticker *time.Ticker) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Swap out current bars and reset map
			s.mu.Lock()
			barsToFlush := s.bars
			s.bars = make(map[string]*CurrentBar)
			s.mu.Unlock()

			if len(barsToFlush) == 0 {
				continue
			}

			// ===== CRITICAL: SINGLE BATCH INSERT USING CopyFrom =====
			// Build rows for batch insert (10-100x faster than loop inserts)
			rows := make([][]interface{}, 0, len(barsToFlush))

			for _, bar := range barsToFlush {
				bar.mu.Lock()
				rows = append(rows, []interface{}{
					bar.Symbol,
					bar.Timestamp,
					bar.OpenBid, bar.HighBid, bar.LowBid, bar.CloseBid,
					bar.OpenAsk, bar.HighAsk, bar.LowAsk, bar.CloseAsk,
					bar.TickCount,
				})
				bar.mu.Unlock()
			}

			// Column names must match table schema
			columns := []string{
				"symbol", "timestamp",
				"open_bid", "high_bid", "low_bid", "close_bid",
				"open_ask", "high_ask", "low_ask", "close_ask",
				"volume",
			}

			// Perform single batch copy operation
			_, err := s.db.CopyFrom(
				ctx,
				pgx.Identifier{"forex_klines_1m"},
				columns,
				pgx.CopyFromRows(rows),
			)

			if err != nil {
				log.Printf("[Forex Aggregator] ERROR: Batch insert failed: %v", err)
				// TODO: Implement retry queue or dead-letter queue for production
			} else {
				log.Printf("[Forex Aggregator] Successfully flushed %d bars to database", len(rows))

				// ===== REDIS ZSET CACHING =====
				// Write-through cache: Add bars to Redis ZSET after successful DB insert
				if s.redisClient != nil {
					s.cacheKlinesToRedis(ctx, barsToFlush)
				}
				// ===== END REDIS CACHING =====
			}
			// ===== END BATCH INSERT =====
		}
	}
}

// cacheKlinesToRedis adds completed K-lines to Redis ZSET and trims old data
func (s *ForexAggregatorService) cacheKlinesToRedis(ctx context.Context, bars map[string]*CurrentBar) {
	const retentionDuration = 7 * 24 * time.Hour // 7 days

	for _, bar := range bars {
		bar.mu.Lock()

		// Build K-line JSON for Redis
		kline := map[string]interface{}{
			"timestamp":  bar.Timestamp.UnixMilli(),
			"open_bid":   bar.OpenBid,
			"high_bid":   bar.HighBid,
			"low_bid":    bar.LowBid,
			"close_bid":  bar.CloseBid,
			"open_ask":   bar.OpenAsk,
			"high_ask":   bar.HighAsk,
			"low_ask":    bar.LowAsk,
			"close_ask":  bar.CloseAsk,
			"volume":     bar.TickCount,
		}

		klineJSON, err := json.Marshal(kline)
		if err != nil {
			log.Printf("[Forex Aggregator] ERROR: Failed to marshal kline for Redis: %v", err)
			bar.mu.Unlock()
			continue
		}

		// Redis key: forex:klines:1m:<SYMBOL>
		key := "forex:klines:1m:" + bar.Symbol
		score := float64(bar.Timestamp.UnixMilli())

		// Add to ZSET (score = timestamp in milliseconds)
		err = s.redisClient.ZAdd(ctx, key, redis.Z{
			Score:  score,
			Member: string(klineJSON),
		}).Err()

		if err != nil {
			log.Printf("[Forex Aggregator] ERROR: Failed to ZADD kline to Redis for %s: %v", bar.Symbol, err)
			bar.mu.Unlock()
			continue
		}

		// Trim old data (remove bars older than 7 days)
		cutoffTime := time.Now().Add(-retentionDuration)
		cutoffScore := float64(cutoffTime.UnixMilli())

		removed, err := s.redisClient.ZRemRangeByScore(ctx, key, "-inf", fmt.Sprintf("%f", cutoffScore)).Result()
		if err != nil {
			log.Printf("[Forex Aggregator] WARN: Failed to trim old klines for %s: %v", bar.Symbol, err)
		} else if removed > 0 {
			log.Printf("[Forex Aggregator] Trimmed %d old bars from Redis cache for %s", removed, bar.Symbol)
		}

		bar.mu.Unlock()
	}

	log.Printf("[Forex Aggregator] Cached %d bars to Redis ZSET", len(bars))
}

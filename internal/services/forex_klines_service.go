package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Kline represents a single candlestick/K-line
type Kline struct {
	Timestamp time.Time `json:"timestamp"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int       `json:"volume"` // Tick count
}

// ForexKlinesService provides historical kline data
// OPTIMIZED: Added Redis caching layer to reduce database egress
type ForexKlinesService struct {
	db          *pgxpool.Pool
	redisClient *redis.Client
}

// NewForexKlinesService creates a new forex klines service
func NewForexKlinesService(db *pgxpool.Pool, redisClient *redis.Client) *ForexKlinesService {
	return &ForexKlinesService{
		db:          db,
		redisClient: redisClient,
	}
}

// GetHistoricalKlines retrieves aggregated klines for a symbol and interval
// OPTIMIZED: Uses Redis cache-first strategy to reduce database egress
// Cache hit rate expected: >90% for chart requests
func (s *ForexKlinesService) GetHistoricalKlines(ctx context.Context, symbol, interval string, limit int) ([]Kline, error) {
	bucketSeconds := intervalToSeconds(interval)

	if bucketSeconds == 0 {
		log.Printf("[Forex Klines] Invalid interval: %s", interval)
		return []Kline{}, nil
	}

	// OPTIMIZATION: Try Redis cache first (for aggregated intervals: 5m, 15m, 1h, 1d)
	// 1m interval is cached by ForexAggregatorService in ZSET format
	if s.redisClient != nil && interval != "1m" {
		cacheKey := fmt.Sprintf("forex:klines:agg:%s:%s:%d", interval, symbol, limit)

		cachedData, err := s.redisClient.Get(ctx, cacheKey).Result()
		if err == nil && cachedData != "" {
			// Cache hit - deserialize and return
			var klines []Kline
			if err := json.Unmarshal([]byte(cachedData), &klines); err == nil {
				log.Printf("[Forex Klines] CACHE HIT for %s (%s) - %d bars", symbol, interval, len(klines))
				return klines, nil
			}
		}

		// Cache miss - query database and cache result
		log.Printf("[Forex Klines] Cache miss for %s (%s), querying database...", symbol, interval)
		klines, err := s.queryDatabase(ctx, bucketSeconds, symbol, limit)
		if err != nil {
			return nil, err
		}

		// Cache the result with appropriate TTL
		cacheTTL := getCacheTTL(interval)
		klinesJSON, _ := json.Marshal(klines)
		s.redisClient.Set(ctx, cacheKey, klinesJSON, cacheTTL)
		log.Printf("[Forex Klines] Cached %d bars for %s (%s) with TTL %v", len(klines), symbol, interval, cacheTTL)

		return klines, nil
	}

	// Fallback: No Redis or 1m interval (1m uses ZSET cache from ForexAggregatorService)
	return s.queryDatabase(ctx, bucketSeconds, symbol, limit)
}

// queryDatabase performs the actual PostgreSQL query
func (s *ForexKlinesService) queryDatabase(ctx context.Context, bucketSeconds int, symbol string, limit int) ([]Kline, error) {
	// Use floor division to bucket timestamps into intervals
	// FLOOR(EXTRACT(EPOCH FROM timestamp) / bucket_size) * bucket_size
	query := `
		WITH buckets AS (
			SELECT
				to_timestamp(FLOOR(EXTRACT(EPOCH FROM timestamp) / $1) * $1) AS bucket,
				open_bid,
				high_bid,
				low_bid,
				close_bid,
				volume,
				timestamp,
				ROW_NUMBER() OVER (PARTITION BY FLOOR(EXTRACT(EPOCH FROM timestamp) / $1) ORDER BY timestamp ASC) as rn_first,
				ROW_NUMBER() OVER (PARTITION BY FLOOR(EXTRACT(EPOCH FROM timestamp) / $1) ORDER BY timestamp DESC) as rn_last
			FROM forex_klines_1m
			WHERE symbol = $2
		)
		SELECT
			bucket,
			MAX(CASE WHEN rn_first = 1 THEN open_bid END) as open,
			MAX(high_bid) as high,
			MIN(low_bid) as low,
			MAX(CASE WHEN rn_last = 1 THEN close_bid END) as close,
			SUM(volume) as volume
		FROM buckets
		GROUP BY bucket
		ORDER BY bucket DESC
		LIMIT $3
	`

	rows, err := s.db.Query(ctx, query, bucketSeconds, symbol, limit)
	if err != nil {
		log.Printf("[Forex Klines] ERROR querying klines for %s: %v", symbol, err)
		return nil, err
	}
	defer rows.Close()

	klines := []Kline{}
	for rows.Next() {
		var k Kline
		var vol *int // Handle NULL volumes

		err := rows.Scan(&k.Timestamp, &k.Open, &k.High, &k.Low, &k.Close, &vol)
		if err != nil {
			log.Printf("[Forex Klines] ERROR scanning row: %v", err)
			continue
		}

		if vol != nil {
			k.Volume = *vol
		}

		klines = append(klines, k)
	}

	log.Printf("[Forex Klines] Returned %d klines from database", len(klines))
	return klines, nil
}

// getCacheTTL returns appropriate cache TTL based on interval
func getCacheTTL(interval string) time.Duration {
	switch interval {
	case "5m", "15m":
		return 5 * time.Minute // Frequent updates
	case "30m", "1h", "2h":
		return 15 * time.Minute // Medium updates
	case "4h", "6h", "12h", "1d":
		return 1 * time.Hour // Infrequent updates
	case "1w":
		return 6 * time.Hour // Very infrequent
	default:
		return 5 * time.Minute
	}
}

// intervalToSeconds maps API interval to seconds for bucketing
func intervalToSeconds(interval string) int {
	mapping := map[string]int{
		"1m":  60,
		"5m":  300,
		"15m": 900,
		"30m": 1800,
		"1h":  3600,
		"2h":  7200,
		"4h":  14400,
		"6h":  21600,
		"12h": 43200,
		"1d":  86400,
		"1w":  604800,
	}

	if seconds, ok := mapping[interval]; ok {
		return seconds
	}

	// Default to 1 hour if invalid
	return 3600
}

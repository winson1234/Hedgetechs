package api

import (
	"brokerageProject/internal/services"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/redis/go-redis/v9"
)

// ForexQuote represents a single forex pair quote with session info
type ForexQuote struct {
	Symbol      string   `json:"symbol"`
	Bid         float64  `json:"bid"`
	Ask         float64  `json:"ask"`
	Spread      float64  `json:"spread"`      // In pips
	Change24h   float64  `json:"change24h"`   // Percentage
	High24h     float64  `json:"high24h"`
	Low24h      float64  `json:"low24h"`
	RangePips   float64  `json:"rangePips"`   // 24h high-low range in pips
	Sessions    []string `json:"sessions"`    // Active trading sessions
	LastUpdated int64    `json:"lastUpdated"` // Unix timestamp (milliseconds)
}

// HandleForexQuotes returns current quotes for all forex pairs (cache-first)
// GET /api/v1/forex/quotes
func HandleForexQuotes(redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx := context.Background()

		// Read active sessions from cache ONCE (not inside loop)
		sessionsJSON, err := redisClient.Get(ctx, "forex:sessions").Result()
		var sessions []string
		if err == nil {
			json.Unmarshal([]byte(sessionsJSON), &sessions)
		}

		// Fetch quotes for all forex symbols from Redis cache
		quotes := []ForexQuote{}

		for _, symbol := range services.FOREX_SYMBOLS {
			// Get current price from Redis
			priceJSON, err := redisClient.Get(ctx, "forex:price:"+symbol).Result()
			if err != nil {
				log.Printf("[Forex API] No price cached for %s, skipping", symbol)
				continue
			}

			var priceData struct {
				Bid       float64 `json:"bid"`
				Ask       float64 `json:"ask"`
				Timestamp int64   `json:"timestamp"`
			}
			if err := json.Unmarshal([]byte(priceJSON), &priceData); err != nil {
				log.Printf("[Forex API] ERROR unmarshalling price for %s: %v", symbol, err)
				continue
			}

			// Get 24h stats from Redis cache
			statsJSON, err := redisClient.Get(ctx, "forex:24h_stats:"+symbol).Result()
			if err != nil {
				log.Printf("[Forex API] No 24h stats cached for %s, using defaults", symbol)
				// Return quote with price only (no stats)
				quotes = append(quotes, ForexQuote{
					Symbol:      symbol,
					Bid:         priceData.Bid,
					Ask:         priceData.Ask,
					Spread:      calculateSpreadPips(symbol, priceData.Bid, priceData.Ask),
					Change24h:   0,
					High24h:     0,
					Low24h:      0,
					RangePips:   0,
					Sessions:    sessions,
					LastUpdated: priceData.Timestamp,
				})
				continue
			}

			var stats services.Stats24h
			if err := json.Unmarshal([]byte(statsJSON), &stats); err != nil {
				log.Printf("[Forex API] ERROR unmarshalling stats for %s: %v", symbol, err)
				continue
			}

			// Combine price + stats into quote
			quotes = append(quotes, ForexQuote{
				Symbol:      symbol,
				Bid:         priceData.Bid,
				Ask:         priceData.Ask,
				Spread:      calculateSpreadPips(symbol, priceData.Bid, priceData.Ask),
				Change24h:   stats.Change24h,
				High24h:     stats.High24h,
				Low24h:      stats.Low24h,
				RangePips:   stats.RangePips,
				Sessions:    sessions,
				LastUpdated: priceData.Timestamp,
			})
		}

		// Return quotes
		response := map[string]interface{}{
			"quotes": quotes,
			"count":  len(quotes),
		}

		out, err := json.Marshal(response)
		if err != nil {
			log.Printf("[Forex API] ERROR marshalling response: %v", err)
			http.Error(w, "Failed to generate response", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT") // Always from cache
		w.WriteHeader(http.StatusOK)
		w.Write(out)
	}
}

// HandleForexKlines returns historical klines for a forex pair with cache-aside pattern
// GET /api/v1/forex/klines?symbol=EURUSD&interval=1h&limit=100
//
// Cache Strategy:
// - 1m interval: Cache-aside (Redis first, PostgreSQL fallback + hydrate)
// - Other intervals: Direct PostgreSQL aggregation (cached bars used if available)
func HandleForexKlines(klinesService *services.ForexKlinesService, redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		q := r.URL.Query()

		// Extract and validate 'symbol'
		symbol := q.Get("symbol")
		if symbol == "" {
			http.Error(w, "Query parameter 'symbol' is required", http.StatusBadRequest)
			return
		}

		// Extract and validate 'interval' (default to "1h")
		interval := q.Get("interval")
		if interval == "" {
			interval = "1h"
		}

		// Extract and validate 'limit' (default to 100, max 1000)
		limitStr := q.Get("limit")
		if limitStr == "" {
			limitStr = "100"
		}
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			http.Error(w, "Query parameter 'limit' must be a positive integer", http.StatusBadRequest)
			return
		}
		if limit > 1000 {
			limit = 1000
		}

		ctx := context.Background()
		cacheHit := false

		var klines interface{}

		// ===== CACHE-ASIDE PATTERN FOR 1M INTERVALS =====
		if interval == "1m" && redisClient != nil {
			// Try Redis cache first
			cachedKlines, err := fetchKlinesFromCache(ctx, redisClient, symbol, limit)
			if err == nil && len(cachedKlines) > 0 {
				klines = cachedKlines
				cacheHit = true
				log.Printf("[Forex API] Cache HIT for %s 1m klines (returned %d bars)", symbol, len(cachedKlines))
			} else {
				// Cache miss - fetch from PostgreSQL
				log.Printf("[Forex API] Cache MISS for %s 1m klines, querying PostgreSQL", symbol)
				dbKlines, err := klinesService.GetHistoricalKlines(ctx, symbol, interval, limit)
				if err != nil {
					log.Printf("[Forex API] ERROR fetching klines from DB for %s: %v", symbol, err)
					http.Error(w, "Failed to fetch klines", http.StatusInternalServerError)
					return
				}
				klines = dbKlines

				// Hydrate Redis cache asynchronously
				go hydrateCache(context.Background(), redisClient, symbol, dbKlines)
			}
		} else {
			// For other intervals, use PostgreSQL aggregation directly
			dbKlines, err := klinesService.GetHistoricalKlines(ctx, symbol, interval, limit)
			if err != nil {
				log.Printf("[Forex API] ERROR fetching klines for %s: %v", symbol, err)
				http.Error(w, "Failed to fetch klines", http.StatusInternalServerError)
				return
			}
			klines = dbKlines
		}

		// Return klines
		out, err := json.Marshal(klines)
		if err != nil {
			log.Printf("[Forex API] ERROR marshalling klines: %v", err)
			http.Error(w, "Failed to generate response", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if cacheHit {
			w.Header().Set("X-Cache", "HIT")
		} else {
			w.Header().Set("X-Cache", "MISS")
		}
		w.WriteHeader(http.StatusOK)
		w.Write(out)
	}
}

// fetchKlinesFromCache retrieves K-lines from Redis cache (sorted set)
func fetchKlinesFromCache(ctx context.Context, redisClient *redis.Client, symbol string, limit int) ([]map[string]interface{}, error) {
	key := "forex:klines:1m:" + symbol

	// Get the last N bars using ZREVRANGE (reverse order by score/timestamp)
	klineStrings, err := redisClient.ZRevRange(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}

	if len(klineStrings) == 0 {
		return nil, nil
	}

	// Parse JSON strings into kline objects
	klines := make([]map[string]interface{}, 0, len(klineStrings))
	for i := len(klineStrings) - 1; i >= 0; i-- { // Reverse to get chronological order
		var kline map[string]interface{}
		if err := json.Unmarshal([]byte(klineStrings[i]), &kline); err != nil {
			log.Printf("[Forex API] WARN: Failed to unmarshal cached kline: %v", err)
			continue
		}
		klines = append(klines, kline)
	}

	return klines, nil
}

// hydrateCache writes fetched klines to Redis cache asynchronously
func hydrateCache(ctx context.Context, redisClient *redis.Client, symbol string, klines interface{}) {
	// Type assert to slice of maps
	klinesSlice, ok := klines.([]map[string]interface{})
	if !ok {
		log.Printf("[Forex API] WARN: Cannot hydrate cache - unexpected klines type")
		return
	}

	if len(klinesSlice) == 0 {
		return
	}

	key := "forex:klines:1m:" + symbol

	// Add each kline to Redis ZSET
	for _, kline := range klinesSlice {
		timestamp, ok := kline["timestamp"].(float64)
		if !ok {
			continue
		}

		klineJSON, err := json.Marshal(kline)
		if err != nil {
			continue
		}

		// ZADD with score = timestamp
		err = redisClient.ZAdd(ctx, key, redis.Z{
			Score:  timestamp,
			Member: string(klineJSON),
		}).Err()

		if err != nil {
			log.Printf("[Forex API] WARN: Failed to hydrate cache for %s: %v", symbol, err)
			return
		}
	}

	log.Printf("[Forex API] Cache hydrated for %s (%d bars)", symbol, len(klinesSlice))
}

// calculateSpreadPips calculates spread in pips
func calculateSpreadPips(symbol string, bid, ask float64) float64 {
	// Determine pip size based on symbol
	pipSize := 0.0001 // Standard forex pairs use 4 decimal places
	if len(symbol) >= 6 && symbol[3:6] == "JPY" {
		pipSize = 0.01 // JPY pairs use 2 decimal places
	}

	spread := ask - bid
	return spread / pipSize
}

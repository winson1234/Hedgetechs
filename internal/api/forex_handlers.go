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

// HandleForexKlines returns historical klines for a forex pair (cache-first)
// GET /api/v1/forex/klines?symbol=EURUSD&interval=1h&limit=100
func HandleForexKlines(klinesService *services.ForexKlinesService) http.HandlerFunc {
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

		// Fetch klines from service (uses database query)
		klines, err := klinesService.GetHistoricalKlines(ctx, symbol, interval, limit)
		if err != nil {
			log.Printf("[Forex API] ERROR fetching klines for %s: %v", symbol, err)
			http.Error(w, "Failed to fetch klines", http.StatusInternalServerError)
			return
		}

		// Return klines
		out, err := json.Marshal(klines)
		if err != nil {
			log.Printf("[Forex API] ERROR marshalling klines: %v", err)
			http.Error(w, "Failed to generate response", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(out)
	}
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

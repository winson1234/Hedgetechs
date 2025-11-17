package services

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Stats24h holds 24-hour statistics for a forex pair
type Stats24h struct {
	Symbol    string  `json:"symbol"`
	Change24h float64 `json:"change24h"` // Percentage change
	High24h   float64 `json:"high24h"`
	Low24h    float64 `json:"low24h"`
	RangePips float64 `json:"rangePips"`
}

// ForexAnalyticsService calculates forex statistics and caches them
type ForexAnalyticsService struct {
	db          *pgxpool.Pool
	redisClient *redis.Client
}

// NewForexAnalyticsService creates a new forex analytics service
func NewForexAnalyticsService(db *pgxpool.Pool, redisClient *redis.Client) *ForexAnalyticsService {
	return &ForexAnalyticsService{
		db:          db,
		redisClient: redisClient,
	}
}

// Forex symbols list (should match MT5 publisher configuration)
var FOREX_SYMBOLS = []string{
	"EURUSD", "GBPUSD", "USDJPY", "AUDUSD",
	"NZDUSD", "USDCHF", "CADJPY", "AUDNZD", "EURGBP",
	"USDCAD", "EURJPY", "GBPJPY",
}

// StartAnalyticsWorker runs background analytics calculations
func (s *ForexAnalyticsService) StartAnalyticsWorker(ctx context.Context) {
	log.Println("[Forex Analytics] Starting analytics worker...")

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run immediately on startup
	s.calculateAndCacheAll(ctx)

	// Then run every minute
	for {
		select {
		case <-ctx.Done():
			log.Println("[Forex Analytics] Worker shutting down...")
			return
		case <-ticker.C:
			s.calculateAndCacheAll(ctx)
		}
	}
}

// calculateAndCacheAll calculates stats for all forex symbols and caches them
func (s *ForexAnalyticsService) calculateAndCacheAll(ctx context.Context) {
	log.Println("[Forex Analytics] Calculating 24h stats for all symbols...")

	statsCount := 0

	// Calculate stats for each symbol
	for _, symbol := range FOREX_SYMBOLS {
		stats := s.calculate24hStats(ctx, symbol)

		if stats.Symbol != "" {
			// Write to Redis cache
			data, _ := json.Marshal(stats)
			err := s.redisClient.Set(ctx, "forex:24h_stats:"+symbol, data, 2*time.Minute).Err()

			if err != nil {
				log.Printf("[Forex Analytics] ERROR: Failed to cache stats for %s: %v", symbol, err)
			} else {
				statsCount++
			}
		}
	}

	// Calculate and cache active trading sessions
	sessions := s.getActiveSessions()
	sessionsJSON, _ := json.Marshal(sessions)
	s.redisClient.Set(ctx, "forex:sessions", sessionsJSON, 2*time.Minute)

	log.Printf("[Forex Analytics] Cached stats for %d/%d symbols, active sessions: %v",
		statsCount, len(FOREX_SYMBOLS), sessions)
}

// calculate24hStats calculates 24-hour statistics for a single symbol
func (s *ForexAnalyticsService) calculate24hStats(ctx context.Context, symbol string) Stats24h {
	now := time.Now()
	ago24h := now.Add(-24 * time.Hour)

	// Query using standard PostgreSQL (no TimescaleDB required)
	// Use nullable types to handle cases where there's no data
	var high, low, firstClose, lastClose *float64
	err := s.db.QueryRow(ctx, `
		WITH ordered_data AS (
			SELECT
				close_bid,
				timestamp,
				ROW_NUMBER() OVER (ORDER BY timestamp ASC) as rn_asc,
				ROW_NUMBER() OVER (ORDER BY timestamp DESC) as rn_desc
			FROM forex_klines_1m
			WHERE symbol = $1 AND timestamp >= $2
		),
		stats AS (
			SELECT
				MAX(high_bid) as high,
				MIN(low_bid) as low
			FROM forex_klines_1m
			WHERE symbol = $1 AND timestamp >= $2
		)
		SELECT
			stats.high,
			stats.low,
			(SELECT close_bid FROM ordered_data WHERE rn_asc = 1) as first_close,
			(SELECT close_bid FROM ordered_data WHERE rn_desc = 1) as last_close
		FROM stats
	`, symbol, ago24h).Scan(&high, &low, &firstClose, &lastClose)

	if err != nil {
		log.Printf("[Forex Analytics] ERROR calculating stats for %s: %v", symbol, err)
		return Stats24h{}
	}

	// Check if we have any data (all values should be non-NULL)
	if high == nil || low == nil || firstClose == nil || lastClose == nil {
		// No data available for this symbol in the last 24 hours
		return Stats24h{}
	}

	// ===== CRITICAL: Division by Zero Protection =====
	var changePct float64
	if *firstClose != 0 {
		changePct = ((*lastClose - *firstClose) / *firstClose) * 100
	}
	// else changePct remains 0.0 (safe default for new/untraded pairs)
	// ===== END DIVISION PROTECTION =====

	// Calculate pip range
	pipSize := s.getPipSize(symbol)
	rangePips := (*high - *low) / pipSize

	return Stats24h{
		Symbol:    symbol,
		Change24h: changePct,
		High24h:   *high,
		Low24h:    *low,
		RangePips: rangePips,
	}
}

// getPipSize returns the pip size for a forex symbol
func (s *ForexAnalyticsService) getPipSize(symbol string) float64 {
	var pipSize float64
	err := s.db.QueryRow(context.Background(),
		"SELECT pip_size FROM instruments WHERE symbol = $1", symbol).Scan(&pipSize)

	if err != nil {
		// Fallback to standard pip sizes
		if strings.Contains(symbol, "JPY") {
			return 0.01 // JPY pairs use 2 decimal places
		}
		return 0.0001 // Standard forex pairs use 4 decimal places
	}

	return pipSize
}

// getActiveSessions returns list of currently active trading sessions
func (s *ForexAnalyticsService) getActiveSessions() []string {
	utcHour := time.Now().UTC().Hour()
	sessions := []string{}

	// Tokyo Session: 00:00-09:00 UTC (Sunday 21:00 - Monday 06:00 EST)
	if utcHour >= 0 && utcHour < 9 {
		sessions = append(sessions, "tokyo")
	}

	// London Session: 08:00-17:00 UTC (03:00-12:00 EST)
	if utcHour >= 8 && utcHour < 17 {
		sessions = append(sessions, "london")
	}

	// New York Session: 13:00-22:00 UTC (08:00-17:00 EST)
	if utcHour >= 13 && utcHour < 22 {
		sessions = append(sessions, "newyork")
	}

	// Sydney Session: 22:00-07:00 UTC (next day, 17:00-02:00 EST)
	if utcHour >= 22 || utcHour < 7 {
		sessions = append(sessions, "sydney")
	}

	return sessions
}

package services

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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
type ForexKlinesService struct {
	db *pgxpool.Pool
}

// NewForexKlinesService creates a new forex klines service
func NewForexKlinesService(db *pgxpool.Pool) *ForexKlinesService {
	return &ForexKlinesService{
		db: db,
	}
}

// GetHistoricalKlines retrieves aggregated klines for a symbol and interval
// Aggregates 1m bars into higher timeframes using PostgreSQL floor division
func (s *ForexKlinesService) GetHistoricalKlines(ctx context.Context, symbol, interval string, limit int) ([]Kline, error) {
	bucketSeconds := intervalToSeconds(interval)

	if bucketSeconds == 0 {
		log.Printf("[Forex Klines] Invalid interval: %s", interval)
		return []Kline{}, nil
	}

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
		log.Printf("[Forex Klines] ERROR querying klines for %s (%s): %v", symbol, interval, err)
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

	log.Printf("[Forex Klines] Returned %d klines for %s (%s)", len(klines), symbol, interval)
	return klines, nil
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

package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"brokerageProject/internal/mt5client"
)

// DataIntegrityService monitors and ensures data integrity for forex K-lines
type DataIntegrityService struct {
	db         *pgxpool.Pool
	mt5Client  *mt5client.Client
	cron       *cron.Cron
	symbols    []string
	gapWindow  time.Duration // Threshold for considering data as missing (default: 2 minutes)
	maxBackoff time.Duration // Maximum backfill range per run (default: 1 hour)
}

// DataIntegrityConfig holds configuration for the data integrity service
type DataIntegrityConfig struct {
	DB             *pgxpool.Pool
	MT5Client      *mt5client.Client
	GapWindow      time.Duration // Default: 2 minutes
	MaxBackoff     time.Duration // Default: 1 hour
	CheckSchedule  string        // Cron schedule (default: "*/5 * * * *" - every 5 minutes)
	TrackedSymbols []string      // Symbols to monitor (default: all 12 forex pairs)
}

// NewDataIntegrityService creates a new data integrity service
func NewDataIntegrityService(config DataIntegrityConfig) *DataIntegrityService {
	if config.GapWindow == 0 {
		config.GapWindow = 2 * time.Minute
	}
	if config.MaxBackoff == 0 {
		config.MaxBackoff = 1 * time.Hour
	}
	if config.CheckSchedule == "" {
		config.CheckSchedule = "*/5 * * * *" // Every 5 minutes
	}
	if len(config.TrackedSymbols) == 0 {
		config.TrackedSymbols = []string{
			"EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCHF",
			"CADJPY", "AUDNZD", "EURGBP", "USDCAD", "EURJPY", "GBPJPY",
		}
	}

	return &DataIntegrityService{
		db:         config.DB,
		mt5Client:  config.MT5Client,
		cron:       cron.New(),
		symbols:    config.TrackedSymbols,
		gapWindow:  config.GapWindow,
		maxBackoff: config.MaxBackoff,
	}
}

// Start begins the gap detection worker
func (s *DataIntegrityService) Start(ctx context.Context) error {
	log.Printf("[DataIntegrity] Starting gap detection worker (schedule: every 5 minutes)")
	log.Printf("[DataIntegrity] Monitoring %d symbols: %v", len(s.symbols), s.symbols)
	log.Printf("[DataIntegrity] Gap threshold: %v, Max backfill: %v", s.gapWindow, s.maxBackoff)

	// Add cron job: every 5 minutes
	_, err := s.cron.AddFunc("*/5 * * * *", func() {
		s.checkAndFillGaps(ctx)
	})
	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	// Run initial check immediately
	go s.checkAndFillGaps(ctx)

	// Start cron scheduler
	s.cron.Start()

	log.Printf("[DataIntegrity] Gap detection worker started successfully")
	return nil
}

// Stop gracefully stops the gap detection worker
func (s *DataIntegrityService) Stop(ctx context.Context) {
	log.Printf("[DataIntegrity] Stopping gap detection worker...")

	stopCtx := s.cron.Stop()
	<-stopCtx.Done()

	log.Printf("[DataIntegrity] Gap detection worker stopped")
}

// checkAndFillGaps checks for missing data and triggers backfill
func (s *DataIntegrityService) checkAndFillGaps(ctx context.Context) {
	log.Printf("[DataIntegrity] Running gap detection check...")

	startTime := time.Now()
	gapsDetected := 0
	gapsFilled := 0
	errors := 0

	for _, symbol := range s.symbols {
		gap, err := s.detectGap(ctx, symbol)
		if err != nil {
			log.Printf("[DataIntegrity] Error detecting gap for %s: %v", symbol, err)
			errors++
			continue
		}

		if gap != nil {
			gapsDetected++
			log.Printf("[DataIntegrity] Gap detected for %s: last_bar=%s, gap_duration=%v",
				symbol, gap.LastTimestamp.Format(time.RFC3339), gap.GapDuration)

			if err := s.fillGap(ctx, symbol, gap); err != nil {
				log.Printf("[DataIntegrity] Failed to fill gap for %s: %v", symbol, err)
				errors++
			} else {
				gapsFilled++
			}
		}
	}

	duration := time.Since(startTime)
	log.Printf("[DataIntegrity] Gap detection complete: duration=%v, gaps_detected=%d, gaps_filled=%d, errors=%d",
		duration, gapsDetected, gapsFilled, errors)
}

// Gap represents a detected gap in K-line data
type Gap struct {
	Symbol        string
	LastTimestamp time.Time
	GapDuration   time.Duration
	ExpectedNext  time.Time
}

// detectGap checks if there's a gap in data for the given symbol
func (s *DataIntegrityService) detectGap(ctx context.Context, symbol string) (*Gap, error) {
	// Query the latest timestamp for this symbol
	query := `
		SELECT MAX(timestamp) as last_timestamp
		FROM forex_klines_1m
		WHERE symbol = $1
	`

	var lastTimestamp *time.Time
	err := s.db.QueryRow(ctx, query, symbol).Scan(&lastTimestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to query last timestamp: %w", err)
	}

	// If no data exists, this is the first run - not a gap
	if lastTimestamp == nil {
		log.Printf("[DataIntegrity] No data found for %s (first run or new symbol)", symbol)
		return nil, nil
	}

	// Calculate gap duration
	now := time.Now()
	gapDuration := now.Sub(*lastTimestamp)

	// Check if gap exceeds threshold (2 minutes + some buffer for aggregator delay)
	if gapDuration > s.gapWindow {
		expectedNext := lastTimestamp.Add(1 * time.Minute) // Next 1-minute bar

		return &Gap{
			Symbol:        symbol,
			LastTimestamp: *lastTimestamp,
			GapDuration:   gapDuration,
			ExpectedNext:  expectedNext,
		}, nil
	}

	return nil, nil
}

// fillGap backfills missing data for the detected gap
func (s *DataIntegrityService) fillGap(ctx context.Context, symbol string, gap *Gap) error {
	// Calculate backfill range
	startTime := gap.ExpectedNext
	endTime := time.Now()

	// Limit backfill range to avoid overwhelming the system
	if endTime.Sub(startTime) > s.maxBackoff {
		endTime = startTime.Add(s.maxBackoff)
		log.Printf("[DataIntegrity] Limiting backfill for %s to %v (will retry remaining in next run)",
			symbol, s.maxBackoff)
	}

	// Round to minute boundaries
	startTime = startTime.Truncate(time.Minute)
	endTime = endTime.Truncate(time.Minute)

	log.Printf("[DataIntegrity] Backfilling %s from %s to %s",
		symbol, startTime.Format(time.RFC3339), endTime.Format(time.RFC3339))

	// Call MT5 backfill API
	req := mt5client.NewKlineBackfillRequest(symbol, startTime, endTime)

	resp, err := s.mt5Client.BackfillKlines(ctx, req)
	if err != nil {
		return fmt.Errorf("backfill request failed: %w", err)
	}

	if resp.BarsCount == 0 {
		log.Printf("[DataIntegrity] No bars returned from MT5 for %s (market closed?)", symbol)
		return nil
	}

	// Insert backfilled data into PostgreSQL
	inserted, err := s.insertKlines(ctx, symbol, resp.Klines)
	if err != nil {
		return fmt.Errorf("failed to insert backfilled data: %w", err)
	}

	log.Printf("[DataIntegrity] Successfully backfilled %s: received=%d bars, inserted=%d bars",
		symbol, resp.BarsCount, inserted)

	return nil
}

// insertKlines inserts K-lines into the database (idempotent)
func (s *DataIntegrityService) insertKlines(ctx context.Context, symbol string, klines []*mt5client.KlineData) (int, error) {
	if len(klines) == 0 {
		return 0, nil
	}

	// Use pgx.CopyFrom for efficient batch insert
	// The unique index (symbol, timestamp) ensures idempotency - duplicates are ignored
	query := `
		INSERT INTO forex_klines_1m (
			symbol, timestamp,
			open_bid, high_bid, low_bid, close_bid,
			open_ask, high_ask, low_ask, close_ask,
			volume
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (symbol, timestamp) DO NOTHING
	`

	inserted := 0

	for _, kline := range klines {
		timestamp := time.UnixMilli(kline.Timestamp)

		// Execute insert
		tag, err := s.db.Exec(ctx, query,
			symbol,
			timestamp,
			kline.OpenBid, kline.HighBid, kline.LowBid, kline.CloseBid,
			kline.OpenAsk, kline.HighAsk, kline.LowAsk, kline.CloseAsk,
			kline.Volume,
		)
		if err != nil {
			return inserted, fmt.Errorf("failed to insert kline: %w", err)
		}

		if tag.RowsAffected() > 0 {
			inserted++
		}
	}

	return inserted, nil
}

// ManualBackfill allows manual triggering of backfill for a specific symbol and time range
// This is useful for initial data population or fixing specific gaps
func (s *DataIntegrityService) ManualBackfill(ctx context.Context, symbol string, start, end time.Time) error {
	log.Printf("[DataIntegrity] Manual backfill requested: symbol=%s, start=%s, end=%s",
		symbol, start.Format(time.RFC3339), end.Format(time.RFC3339))

	// Use chunked backfill for large ranges
	klines, err := s.mt5Client.BackfillKlinesChunked(ctx, symbol, start, end, 7*24*time.Hour)
	if err != nil {
		return fmt.Errorf("chunked backfill failed: %w", err)
	}

	// Insert all klines
	inserted, err := s.insertKlines(ctx, symbol, klines)
	if err != nil {
		return fmt.Errorf("failed to insert manual backfill data: %w", err)
	}

	log.Printf("[DataIntegrity] Manual backfill complete: symbol=%s, total_bars=%d, inserted=%d",
		symbol, len(klines), inserted)

	return nil
}

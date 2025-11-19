package mt5client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"
)

// Client is an HTTP client for the MT5 backfill API
type Client struct {
	baseURL    string
	httpClient *http.Client
	maxRetries int
}

// Config holds the configuration for the MT5 client
type Config struct {
	BaseURL    string        // MT5 backfill API base URL (e.g., "http://localhost:8001")
	Timeout    time.Duration // HTTP timeout (default: 30s)
	MaxRetries int           // Maximum retry attempts (default: 3)
}

// NewClient creates a new MT5 backfill API client
func NewClient(config Config) *Client {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}

	return &Client{
		baseURL: config.BaseURL,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		maxRetries: config.MaxRetries,
	}
}

// Health checks the MT5 backfill API health status
func (c *Client) Health(ctx context.Context) (*HealthResponse, error) {
	url := c.baseURL + "/health"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create health request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("health check failed with status %d: %s", resp.StatusCode, string(body))
	}

	var healthResp HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&healthResp); err != nil {
		return nil, fmt.Errorf("failed to decode health response: %w", err)
	}

	return &healthResp, nil
}

// BackfillKlines fetches historical K-lines from the MT5 backfill API with retry logic
func (c *Client) BackfillKlines(ctx context.Context, req *KlineBackfillRequest) (*KlineBackfillResponse, error) {
	var lastErr error

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s, ...
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			log.Printf("[MT5Client] Retry attempt %d/%d after %v (symbol: %s)", attempt, c.maxRetries, backoff, req.Symbol)

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		resp, err := c.doBackfillRequest(ctx, req)
		if err == nil {
			if attempt > 0 {
				log.Printf("[MT5Client] Backfill succeeded on attempt %d (symbol: %s, bars: %d)", attempt+1, req.Symbol, resp.BarsCount)
			}
			return resp, nil
		}

		lastErr = err
		log.Printf("[MT5Client] Backfill attempt %d failed: %v", attempt+1, err)
	}

	return nil, fmt.Errorf("backfill failed after %d retries: %w", c.maxRetries, lastErr)
}

// doBackfillRequest performs a single backfill request without retry
func (c *Client) doBackfillRequest(ctx context.Context, req *KlineBackfillRequest) (*KlineBackfillResponse, error) {
	url := c.baseURL + "/api/v1/klines/backfill"

	// Validate request
	if err := c.validateRequest(req); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}

	// Marshal request body
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// Execute request
	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer httpResp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backfill failed with status %d: %s", httpResp.StatusCode, string(respBody))
	}

	// Decode response
	var backfillResp KlineBackfillResponse
	if err := json.Unmarshal(respBody, &backfillResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("[MT5Client] Backfill successful: symbol=%s, bars=%d, range=%s to %s",
		backfillResp.Symbol,
		backfillResp.BarsCount,
		time.UnixMilli(backfillResp.StartTime).Format(time.RFC3339),
		time.UnixMilli(backfillResp.EndTime).Format(time.RFC3339),
	)

	return &backfillResp, nil
}

// validateRequest validates the backfill request parameters
func (c *Client) validateRequest(req *KlineBackfillRequest) error {
	if req.Symbol == "" {
		return fmt.Errorf("symbol is required")
	}

	if req.StartTime <= 0 {
		return fmt.Errorf("start_time must be positive")
	}

	if req.EndTime <= 0 {
		return fmt.Errorf("end_time must be positive")
	}

	if req.StartTime >= req.EndTime {
		return fmt.Errorf("start_time must be before end_time")
	}

	// Check if time range is not too large (max 30 days)
	maxRange := 30 * 24 * time.Hour
	startTime := time.UnixMilli(req.StartTime)
	endTime := time.UnixMilli(req.EndTime)

	if endTime.Sub(startTime) > maxRange {
		return fmt.Errorf("time range cannot exceed 30 days (requested: %v)", endTime.Sub(startTime))
	}

	return nil
}

// BackfillKlinesChunked fetches K-lines in chunks if the time range is too large
// This is useful for backfilling large date ranges (e.g., 90 days)
func (c *Client) BackfillKlinesChunked(ctx context.Context, symbol string, start, end time.Time, chunkSize time.Duration) ([]*KlineData, error) {
	if chunkSize == 0 {
		chunkSize = 7 * 24 * time.Hour // Default 7-day chunks
	}

	var allKlines []*KlineData
	currentStart := start

	for currentStart.Before(end) {
		currentEnd := currentStart.Add(chunkSize)
		if currentEnd.After(end) {
			currentEnd = end
		}

		req := NewKlineBackfillRequest(symbol, currentStart, currentEnd)

		resp, err := c.BackfillKlines(ctx, req)
		if err != nil {
			return nil, fmt.Errorf("failed to backfill chunk %s to %s: %w",
				currentStart.Format(time.RFC3339),
				currentEnd.Format(time.RFC3339),
				err,
			)
		}

		allKlines = append(allKlines, resp.Klines...)
		log.Printf("[MT5Client] Backfilled chunk: %s to %s (%d bars, total: %d)",
			currentStart.Format(time.RFC3339),
			currentEnd.Format(time.RFC3339),
			resp.BarsCount,
			len(allKlines),
		)

		currentStart = currentEnd
	}

	log.Printf("[MT5Client] Backfill complete: symbol=%s, total_bars=%d, range=%s to %s",
		symbol, len(allKlines), start.Format(time.RFC3339), end.Format(time.RFC3339))

	return allKlines, nil
}

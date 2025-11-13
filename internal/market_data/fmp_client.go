package market_data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// TICKER_INTERVAL enforces minimum time between FMP API calls (6 minutes = 360 seconds)
	// This prevents hitting FMP rate limits and reduces API costs
	TICKER_INTERVAL = 360 // seconds

	// FMP API stable endpoint for real-time quotes
	// Using the stable path without api/ prefix
	FMP_QUOTE_URL = "https://financialmodelingprep.com/stable/real-time-quote/%s?apikey=%s"
)

// Symbol mapping: Internal system symbols → FMP API symbols
// Internal symbols are what we use in DB, UI, and order execution
// FMP symbols are what we send to the Financial Modeling Prep API
var internalToFMP = map[string]string{
	"WTI":    "CLUSD",   // WTI Crude Oil
	"BRENT":  "BZUSD",   // Brent Crude Oil
	"NATGAS": "NGUSD",   // Natural Gas
	"CADJPY": "CADJPY",  // Canadian Dollar / Japanese Yen
	"AUDNZD": "AUDNZD",  // Australian Dollar / New Zealand Dollar
	"EURGBP": "EURGBP",  // Euro / British Pound
}

// Reverse mapping: FMP symbols → Internal symbols
var fmpToInternal = map[string]string{
	"CLUSD":  "WTI",
	"BZUSD":  "BRENT",
	"NGUSD":  "NATGAS",
	"CADJPY": "CADJPY",
	"AUDNZD": "AUDNZD",
	"EURGBP": "EURGBP",
}

// FMPQuote represents a single quote from FMP API response
type FMPQuote struct {
	Symbol           string  `json:"symbol"`
	Name             string  `json:"name"`
	Price            float64 `json:"price"`
	ChangesPercentage float64 `json:"changesPercentage"`
	Change           float64 `json:"change"`
	DayLow           float64 `json:"dayLow"`
	DayHigh          float64 `json:"dayHigh"`
	YearHigh         float64 `json:"yearHigh"`
	YearLow          float64 `json:"yearLow"`
	Volume           int64   `json:"volume"`
	Timestamp        int64   `json:"timestamp"`
}

// FMPClient manages FMP API requests with rate limiting and persistence
type FMPClient struct {
	apiKey          string
	lastFetchTime   time.Time
	persistenceFile string
	httpClient      *http.Client
}

// PersistenceState stores the last fetch timestamp to survive restarts
type PersistenceState struct {
	LastFetchTime time.Time `json:"last_fetch_time"`
}

// NewFMPClient creates a new FMP client with rate limiting and persistence
func NewFMPClient(apiKey string, persistenceFile string) (*FMPClient, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("FMP API key is required")
	}

	// Ensure data directory exists
	dataDir := filepath.Dir(persistenceFile)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	client := &FMPClient{
		apiKey:          apiKey,
		persistenceFile: persistenceFile,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	// Load last fetch time from persistence file
	if err := client.loadState(); err != nil {
		// If file doesn't exist or is corrupted, start fresh (not a fatal error)
		client.lastFetchTime = time.Time{} // Zero time allows immediate first fetch
	}

	return client, nil
}

// loadState reads the last fetch timestamp from disk
func (c *FMPClient) loadState() error {
	data, err := os.ReadFile(c.persistenceFile)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("persistence file does not exist (first run)")
		}
		return fmt.Errorf("failed to read persistence file: %w", err)
	}

	var state PersistenceState
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("failed to parse persistence file: %w", err)
	}

	c.lastFetchTime = state.LastFetchTime
	return nil
}

// saveState writes the current fetch timestamp to disk
func (c *FMPClient) saveState() error {
	state := PersistenceState{
		LastFetchTime: c.lastFetchTime,
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	if err := os.WriteFile(c.persistenceFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write persistence file: %w", err)
	}

	return nil
}

// FetchBatchQuotes fetches current prices for all 6 symbols using FMP v4 API
// Makes a single API call with comma-separated symbols for all forex and commodities
// Returns a map of internal symbol names → FMPQuote
// Enforces 360-second minimum interval between calls
func (c *FMPClient) FetchBatchQuotes() (map[string]FMPQuote, error) {
	// Safety check: Enforce 360s minimum interval
	timeSinceLastFetch := time.Since(c.lastFetchTime)
	if timeSinceLastFetch < TICKER_INTERVAL*time.Second {
		waitTime := TICKER_INTERVAL*time.Second - timeSinceLastFetch
		return nil, fmt.Errorf("rate limit: too soon since last fetch (wait %v)", waitTime)
	}

	// Build comma-separated list of all FMP symbols
	// Commodities: CLUSD, BZUSD, NGUSD
	// Forex: CADJPY, AUDNZD, EURGBP
	symbols := []string{"CLUSD", "BZUSD", "NGUSD", "CADJPY", "AUDNZD", "EURGBP"}
	symbolsParam := strings.Join(symbols, ",")
	
	url := fmt.Sprintf(FMP_QUOTE_URL, symbolsParam, c.apiKey)
	quotes, err := c.fetchQuotesFromURL(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch quotes: %w", err)
	}

	// Convert FMP symbols to internal symbols
	result := make(map[string]FMPQuote)
	for _, quote := range quotes {
		internalSymbol, ok := fmpToInternal[quote.Symbol]
		if ok {
			result[internalSymbol] = quote
		}
	}

	// Validate we got all 6 symbols
	if len(result) != 6 {
		return nil, fmt.Errorf("expected 6 quotes, got %d", len(result))
	}

	// Update last fetch time and persist to disk
	c.lastFetchTime = time.Now()
	if err := c.saveState(); err != nil {
		// Log warning but don't fail the request (state persistence is not critical)
		fmt.Printf("WARNING: Failed to save FMP fetch state: %v\n", err)
	}

	return result, nil
}

// fetchQuotesFromURL is a helper function that makes HTTP request and parses response
func (c *FMPClient) fetchQuotesFromURL(url string) ([]FMPQuote, error) {
	// Make HTTP request
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response (FMP returns an array of quotes)
	var quotes []FMPQuote
	if err := json.NewDecoder(resp.Body).Decode(&quotes); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return quotes, nil
}

// GetInternalSymbols returns the list of internal symbol names (for iteration)
func GetInternalSymbols() []string {
	return []string{"WTI", "BRENT", "NATGAS", "CADJPY", "AUDNZD", "EURGBP"}
}

// GetFMPSymbol converts an internal symbol to its FMP equivalent
func GetFMPSymbol(internalSymbol string) (string, error) {
	fmpSymbol, ok := internalToFMP[internalSymbol]
	if !ok {
		return "", fmt.Errorf("unknown internal symbol: %s", internalSymbol)
	}
	return fmpSymbol, nil
}

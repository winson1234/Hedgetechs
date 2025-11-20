package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/patrickmn/go-cache"
)

// ExchangeRateService fetches and caches crypto-to-fiat exchange rates.
type ExchangeRateService struct {
	httpClient     *http.Client
	cache          *cache.Cache
	defaultSymbols []string
	lastKnown      map[string]rateSnapshot
	mu             sync.RWMutex
}

type rateSnapshot struct {
	Value     float64
	UpdatedAt time.Time
}

type rateCacheEntry struct {
	Rates     map[string]float64
	FetchedAt time.Time
}

// coinGeckoIDs maps supported symbols to CoinGecko identifiers.
var coinGeckoIDs = map[string]string{
	// Major cryptocurrencies
	"BTC":   "bitcoin",
	"ETH":   "ethereum",
	"BNB":   "binancecoin",
	"SOL":   "solana",
	"ADA":   "cardano",
	"XRP":   "ripple",
	"AVAX":  "avalanche-2",
	"MATIC": "matic-network",
	"LINK":  "chainlink",
	"UNI":   "uniswap",
	"ATOM":  "cosmos",
	"DOT":   "polkadot",
	"ARB":   "arbitrum",
	"OP":    "optimism",
	"APT":   "aptos",
	"DOGE":  "dogecoin",
	"LTC":   "litecoin",
	"SHIB":  "shiba-inu",
	"NEAR":  "near",
	"ICP":   "internet-computer",
	"FIL":   "filecoin",
	"SUI":   "sui",
	"STX":   "stacks",
	"TON":   "the-open-network",
	// Additional popular cryptocurrencies
	"USDT":  "tether",
	"USDC":  "usd-coin",
	"DAI":   "dai",
	"BUSD":  "binance-usd",
	"TRX":   "tron",
	"ETC":   "ethereum-classic",
	"XLM":   "stellar",
	"ALGO":  "algorand",
	"VET":   "vechain",
	"THETA": "theta-token",
	"EOS":   "eos",
	"AAVE":  "aave",
	"GRT":   "the-graph",
	"AXS":   "axie-infinity",
	"MANA":  "decentraland",
	"SAND":  "the-sandbox",
	"ENJ":   "enjincoin",
	"CHZ":   "chiliz",
	"HBAR":  "hedera-hashgraph",
	"FLOW":  "flow",
	"EGLD":  "elrond-erd-2",
	"ZIL":   "zilliqa",
	"WAVES": "waves",
	"XTZ":   "tezos",
	"BAT":   "basic-attention-token",
	"ZEC":   "zcash",
	"DASH":  "dash",
	"XMR":   "monero",
}

// NewExchangeRateService creates a new service with background refresh.
func NewExchangeRateService(defaultSymbols []string, refreshInterval time.Duration) *ExchangeRateService {
	if len(defaultSymbols) == 0 {
		defaultSymbols = []string{"BTC"}
	}

	svc := &ExchangeRateService{
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		cache:          cache.New(30*time.Second, 1*time.Minute),
		defaultSymbols: sanitizeSymbols(defaultSymbols),
		lastKnown:      make(map[string]rateSnapshot),
	}

	// Prime cache asynchronously (don't block startup if CoinGecko is slow/unavailable)
	go func() {
		_, _, err := svc.fetchAndCache(svc.defaultSymbols)
		if err != nil {
			log.Printf("Warning: Failed to prime exchange rate cache on startup: %v", err)
			log.Printf("Service will continue and retry in background. First request may use fallback data.")
		} else {
			log.Printf("Exchange rate service initialized successfully with %d cryptocurrencies", len(svc.defaultSymbols))
		}
	}()

	// Start background refresher.
	go svc.runRefresher(refreshInterval)

	return svc
}

// runRefresher periodically refreshes the cache using default symbols.
func (s *ExchangeRateService) runRefresher(refreshInterval time.Duration) {
	if refreshInterval <= 0 {
		refreshInterval = 30 * time.Second
	}

	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()

	backoffMultiplier := 1
	maxBackoff := 10

	for range ticker.C {
		if _, _, err := s.fetchAndCache(s.defaultSymbols); err != nil {
			// Check if it's a rate limit error (429)
			if strings.Contains(err.Error(), "429") {
				backoffMultiplier = min(backoffMultiplier*2, maxBackoff)
				log.Printf("Rate limit hit, backing off to %dx refresh interval", backoffMultiplier)
				ticker.Reset(refreshInterval * time.Duration(backoffMultiplier))
			}
			// swallow error - fallback will use lastKnown
			continue
		}
		// Success - reset backoff
		if backoffMultiplier > 1 {
			backoffMultiplier = 1
			ticker.Reset(refreshInterval)
			log.Printf("Exchange rate service recovered, reset to normal refresh interval")
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetRates returns exchange rates for the requested symbols.
// The returned bool indicates whether the data came from a stale cache fallback.
func (s *ExchangeRateService) GetRates(symbols []string) (map[string]float64, time.Time, bool, error) {
	cleanSymbols := sanitizeSymbols(symbols)
	if len(cleanSymbols) == 0 {
		cleanSymbols = s.defaultSymbols
	}

	cacheKey := cacheKeyFor(cleanSymbols)
	if cached, found := s.cache.Get(cacheKey); found {
		if entry, ok := cached.(rateCacheEntry); ok {
			return cloneRates(entry.Rates), entry.FetchedAt, false, nil
		}
	}

	rates, fetchedAt, err := s.fetchAndCache(cleanSymbols)
	if err == nil && len(rates) > 0 {
		return cloneRates(rates), fetchedAt, false, nil
	}

	// Fallback to last known rates if available.
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.lastKnown) == 0 {
		if err != nil {
			return nil, time.Time{}, false, err
		}
		return nil, time.Time{}, false, fmt.Errorf("no exchange rate data available")
	}

	fallback := make(map[string]float64)
	latest := time.Time{}
	for _, symbol := range cleanSymbols {
		if snapshot, ok := s.lastKnown[symbol]; ok {
			fallback[symbol] = snapshot.Value
			if snapshot.UpdatedAt.After(latest) {
				latest = snapshot.UpdatedAt
			}
		}
	}

	if len(fallback) == 0 {
		if err != nil {
			return nil, time.Time{}, false, err
		}
		return nil, time.Time{}, false, fmt.Errorf("requested symbols unavailable")
	}

	if latest.IsZero() {
		latest = time.Now().UTC()
	}

	// Cache fallback to reduce repeated work and return stale flag.
	s.cache.Set(cacheKey, rateCacheEntry{
		Rates:     cloneRates(fallback),
		FetchedAt: latest,
	}, cache.DefaultExpiration)
	return fallback, latest, true, nil
}

// fetchAndCache hits CoinGecko and stores the result.
func (s *ExchangeRateService) fetchAndCache(symbols []string) (map[string]float64, time.Time, error) {
	cleanSymbols := sanitizeSymbols(symbols)
	if len(cleanSymbols) == 0 {
		return nil, time.Time{}, fmt.Errorf("no supported symbols requested")
	}

	ids := make([]string, 0, len(cleanSymbols))
	for _, symbol := range cleanSymbols {
		if id, ok := coinGeckoIDs[symbol]; ok {
			ids = append(ids, id)
		}
	}

	if len(ids) == 0 {
		return nil, time.Time{}, fmt.Errorf("no supported symbols requested")
	}

	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=usd", strings.Join(ids, ","))

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to fetch exchange rates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, time.Time{}, fmt.Errorf("coingecko returned status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to read response: %w", err)
	}

	type priceResponse map[string]map[string]float64

	var parsed priceResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to parse response: %w", err)
	}

	rates := make(map[string]float64, len(cleanSymbols))
	for _, symbol := range cleanSymbols {
		id := coinGeckoIDs[symbol]
		if priceMap, ok := parsed[id]; ok {
			if usd, ok := priceMap["usd"]; ok {
				rates[symbol] = usd
			}
		}
	}

	if len(rates) == 0 {
		return nil, time.Time{}, fmt.Errorf("no rates returned for requested symbols")
	}

	fetchedAt := time.Now().UTC()
	cacheKey := cacheKeyFor(symbols)
	s.cache.Set(cacheKey, rateCacheEntry{
		Rates:     cloneRates(rates),
		FetchedAt: fetchedAt,
	}, cache.DefaultExpiration)

	s.mu.Lock()
	for k, v := range rates {
		s.lastKnown[k] = rateSnapshot{
			Value:     v,
			UpdatedAt: fetchedAt,
		}
	}
	s.mu.Unlock()

	return rates, fetchedAt, nil
}

func sanitizeSymbols(symbols []string) []string {
	unique := make(map[string]struct{}, len(symbols))
	normalized := make([]string, 0, len(symbols))
	for _, symbol := range symbols {
		s := strings.ToUpper(strings.TrimSpace(symbol))
		if s == "" {
			continue
		}
		if _, seen := unique[s]; seen {
			continue
		}
		if _, supported := coinGeckoIDs[s]; supported {
			unique[s] = struct{}{}
			normalized = append(normalized, s)
		}
	}
	return normalized
}

func cacheKeyFor(symbols []string) string {
	if len(symbols) == 0 {
		return "exchange_rate_default"
	}
	clean := sanitizeSymbols(symbols)
	if len(clean) == 0 {
		return "exchange_rate_default"
	}
	sorted := make([]string, len(clean))
	copy(sorted, clean)
	sort.Strings(sorted)
	return fmt.Sprintf("exchange_rate_%s", strings.Join(sorted, "_"))
}

func cloneRates(src map[string]float64) map[string]float64 {
	dst := make(map[string]float64, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

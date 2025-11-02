package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/patrickmn/go-cache"
)

// MassiveService handles forex rate fetching using Frankfurter API (free, no API key required)
type MassiveService struct {
	BaseURL    string
	HTTPClient *http.Client
	Cache      *cache.Cache
}

// NewMassiveService creates a new forex service instance using Frankfurter API
func NewMassiveService(apiKey string) *MassiveService {
	// Note: apiKey is ignored for Frankfurter API (no key required)
	return &MassiveService{
		BaseURL: "https://api.frankfurter.dev",
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		Cache: cache.New(5*time.Minute, 10*time.Minute),
	}
}

// FXRateResponse represents the response from Frankfurter API
type FXRateResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}

// GetFXRate fetches the forex conversion rate from one currency to another using Frankfurter API
// Example: GetFXRate("EUR", "USD") returns the EUR/USD exchange rate
func (s *MassiveService) GetFXRate(from, to string) (float64, error) {
	cacheKey := fmt.Sprintf("fx_rate_%s_%s", from, to)

	// Check cache first
	if cached, found := s.Cache.Get(cacheKey); found {
		return cached.(float64), nil
	}

	// Build request URL for Frankfurter API: GET /v1/latest?from={from}&to={to}
	url := fmt.Sprintf("%s/v1/latest?from=%s&to=%s", s.BaseURL, from, to)

	// Make HTTP request
	resp, err := s.HTTPClient.Get(url)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch FX rate: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var fxResp FXRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&fxResp); err != nil {
		return 0, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract the rate from the rates map
	rate, ok := fxResp.Rates[to]
	if !ok {
		return 0, fmt.Errorf("rate for %s not found in response", to)
	}

	// Cache the result
	s.Cache.Set(cacheKey, rate, cache.DefaultExpiration)

	return rate, nil
}

// GetMultipleFXRates fetches multiple forex rates in parallel
// Returns a map of currency pairs to their rates
func (s *MassiveService) GetMultipleFXRates(pairs [][2]string) (map[string]float64, error) {
	type result struct {
		pair string
		rate float64
		err  error
	}

	results := make(chan result, len(pairs))
	rates := make(map[string]float64)

	// Fetch all rates in parallel
	for _, pair := range pairs {
		go func(from, to string) {
			rate, err := s.GetFXRate(from, to)
			pairKey := fmt.Sprintf("%s/%s", from, to)
			results <- result{pair: pairKey, rate: rate, err: err}
		}(pair[0], pair[1])
	}

	// Collect results
	var lastErr error
	for i := 0; i < len(pairs); i++ {
		res := <-results
		if res.err != nil {
			lastErr = res.err
			continue
		}
		rates[res.pair] = res.rate
	}

	if lastErr != nil && len(rates) == 0 {
		return nil, lastErr
	}

	return rates, nil
}

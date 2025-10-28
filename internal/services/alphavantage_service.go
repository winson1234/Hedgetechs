package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"brokerageProject/internal/config"

	"github.com/patrickmn/go-cache"
)

// AlphaVantageService handles Alpha Vantage API requests with caching
type AlphaVantageService struct {
	apiKey string
	cache  *cache.Cache
	client *http.Client
}

// NewAlphaVantageService creates a new Alpha Vantage service instance
func NewAlphaVantageService() *AlphaVantageService {
	apiKey := os.Getenv("ALPHAVANTAGE_API_KEY")
	if apiKey == "" {
		log.Println("Warning: ALPHAVANTAGE_API_KEY not set in environment")
	}

	return &AlphaVantageService{
		apiKey: apiKey,
		cache:  cache.New(5*time.Minute, 10*time.Minute), // Cache for 5 minutes
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetQuote fetches real-time quote for a symbol (stocks, forex, crypto)
func (s *AlphaVantageService) GetQuote(symbol string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("quote_%s", symbol)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL
	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=%s&apikey=%s",
		config.AlphaVantageBaseURL, symbol, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch quote: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetIntradayData fetches intraday time series (1min, 5min, 15min, 30min, 60min)
func (s *AlphaVantageService) GetIntradayData(symbol string, interval string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("intraday_%s_%s", symbol, interval)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL
	url := fmt.Sprintf("%s?function=TIME_SERIES_INTRADAY&symbol=%s&interval=%s&apikey=%s",
		config.AlphaVantageBaseURL, symbol, interval, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch intraday data: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetTechnicalIndicator fetches technical indicators (RSI, MACD, SMA, EMA, etc.)
func (s *AlphaVantageService) GetTechnicalIndicator(function string, symbol string, interval string, timePeriod string, seriesType string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("indicator_%s_%s_%s_%s", function, symbol, interval, timePeriod)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL with parameters
	url := fmt.Sprintf("%s?function=%s&symbol=%s&interval=%s&time_period=%s&series_type=%s&apikey=%s",
		config.AlphaVantageBaseURL, function, symbol, interval, timePeriod, seriesType, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch technical indicator: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetCryptoQuote fetches real-time cryptocurrency exchange rate
func (s *AlphaVantageService) GetCryptoQuote(fromCurrency string, toCurrency string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("crypto_quote_%s_%s", fromCurrency, toCurrency)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL for CURRENCY_EXCHANGE_RATE
	url := fmt.Sprintf("%s?function=CURRENCY_EXCHANGE_RATE&from_currency=%s&to_currency=%s&apikey=%s",
		config.AlphaVantageBaseURL, fromCurrency, toCurrency, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch crypto quote: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetCryptoIntraday fetches intraday cryptocurrency data
func (s *AlphaVantageService) GetCryptoIntraday(symbol string, market string, interval string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("crypto_intraday_%s_%s_%s", symbol, market, interval)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL for CRYPTO_INTRADAY
	url := fmt.Sprintf("%s?function=CRYPTO_INTRADAY&symbol=%s&market=%s&interval=%s&apikey=%s",
		config.AlphaVantageBaseURL, symbol, market, interval, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch crypto intraday: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetCryptoDaily fetches daily cryptocurrency data
func (s *AlphaVantageService) GetCryptoDaily(symbol string, market string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("crypto_daily_%s_%s", symbol, market)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		return cached.(map[string]interface{}), nil
	}

	// Build URL for DIGITAL_CURRENCY_DAILY
	url := fmt.Sprintf("%s?function=DIGITAL_CURRENCY_DAILY&symbol=%s&market=%s&apikey=%s",
		config.AlphaVantageBaseURL, symbol, market, s.apiKey)

	// Make request
	resp, err := s.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch crypto daily: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Cache the result
	s.cache.Set(cacheKey, result, cache.DefaultExpiration)

	return result, nil
}

// GetFXDaily fetches daily forex (FX) data for currency pairs like EUR/USD
func (s *AlphaVantageService) GetFXDaily(fromCurrency string, toCurrency string) (map[string]interface{}, error) {
cacheKey := fmt.Sprintf("fx_daily_%s_%s", fromCurrency, toCurrency)

// Check cache first
if cached, found := s.cache.Get(cacheKey); found {
return cached.(map[string]interface{}), nil
}

// Build URL for FX_DAILY
url := fmt.Sprintf("%s?function=FX_DAILY&from_symbol=%s&to_symbol=%s&apikey=%s",
config.AlphaVantageBaseURL, fromCurrency, toCurrency, s.apiKey)

// Make request
resp, err := s.client.Get(url)
if err != nil {
return nil, fmt.Errorf("failed to fetch FX daily: %w", err)
}
defer resp.Body.Close()

body, err := io.ReadAll(resp.Body)
if err != nil {
return nil, fmt.Errorf("failed to read response: %w", err)
}

var result map[string]interface{}
if err := json.Unmarshal(body, &result); err != nil {
return nil, fmt.Errorf("failed to parse response: %w", err)
}

// Cache the result
s.cache.Set(cacheKey, result, cache.DefaultExpiration)

return result, nil
}

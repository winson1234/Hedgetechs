package api

import (
	"brokerageProject/internal/services"
	"encoding/json"
	"log"
	"net/http"
)

// AlphaVantageHandler handles Alpha Vantage analytics requests
type AlphaVantageHandler struct {
	service *services.AlphaVantageService
}

// NewAlphaVantageHandler creates a new Alpha Vantage handler
func NewAlphaVantageHandler(service *services.AlphaVantageService) *AlphaVantageHandler {
	return &AlphaVantageHandler{
		service: service,
	}
}

// HandleAlphaVantage processes Alpha Vantage API requests
func (h *AlphaVantageHandler) HandleAlphaVantage(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Parse query parameters
	queryType := r.URL.Query().Get("type")
	symbol := r.URL.Query().Get("symbol")

	if symbol == "" {
		http.Error(w, `{"error": "symbol parameter is required"}`, http.StatusBadRequest)
		return
	}

	var result map[string]interface{}
	var err error

	switch queryType {
	case "crypto_quote":
		// For crypto: symbol should be like "BTC" and we query against USD
		toCurrency := r.URL.Query().Get("market")
		if toCurrency == "" {
			toCurrency = "USD"
		}
		result, err = h.service.GetCryptoQuote(symbol, toCurrency)
	case "crypto_intraday":
		market := r.URL.Query().Get("market")
		interval := r.URL.Query().Get("interval")
		if market == "" {
			market = "USD"
		}
		if interval == "" {
			interval = "5min"
		}
		result, err = h.service.GetCryptoIntraday(symbol, market, interval)
	case "crypto_daily":
		market := r.URL.Query().Get("market")
		if market == "" {
			market = "USD"
		}
		result, err = h.service.GetCryptoDaily(symbol, market)
	case "fx_daily":
		// For forex pairs like EUR/USD
		toCurrency := r.URL.Query().Get("market")
		if toCurrency == "" {
			toCurrency = "USD"
		}
		result, err = h.service.GetFXDaily(symbol, toCurrency)
	case "quote":
		result, err = h.service.GetQuote(symbol)
	case "intraday":
		interval := r.URL.Query().Get("interval")
		if interval == "" {
			interval = "5min" // Default to 5min
		}
		result, err = h.service.GetIntradayData(symbol, interval)
	case "indicator":
		function := r.URL.Query().Get("function")
		interval := r.URL.Query().Get("interval")
		timePeriod := r.URL.Query().Get("time_period")
		seriesType := r.URL.Query().Get("series_type")

		if function == "" {
			http.Error(w, `{"error": "function parameter is required for indicators"}`, http.StatusBadRequest)
			return
		}
		if interval == "" {
			interval = "daily"
		}
		if timePeriod == "" {
			timePeriod = "14"
		}
		if seriesType == "" {
			seriesType = "close"
		}

		result, err = h.service.GetTechnicalIndicator(function, symbol, interval, timePeriod, seriesType)
	default:
		http.Error(w, `{"error": "invalid type parameter. Use: crypto_quote, crypto_intraday, crypto_daily, fx_daily, quote, intraday, or indicator"}`, http.StatusBadRequest)
		return
	}

	if err != nil {
		log.Printf("Alpha Vantage API error: %v", err)
		http.Error(w, `{"error": "failed to fetch data from Alpha Vantage"}`, http.StatusInternalServerError)
		return
	}

	// Return the result
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
		return
	}
}

package api

import (
	"brokerageProject/internal/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ExchangeRateHandler provides HTTP handlers for exchange rates.
type ExchangeRateHandler struct {
	service *services.ExchangeRateService
}

// NewExchangeRateHandler builds a new handler instance.
func NewExchangeRateHandler(service *services.ExchangeRateService) *ExchangeRateHandler {
	return &ExchangeRateHandler{service: service}
}

// HandleGetRates returns crypto to USD exchange rates.
func (h *ExchangeRateHandler) HandleGetRates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendJSONError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	symbolsParam := r.URL.Query().Get("symbols")
	var symbols []string
	if symbolsParam != "" {
		symbols = strings.Split(symbolsParam, ",")
	}

	rates, fetchedAt, stale, err := h.service.GetRates(symbols)
	if err != nil {
		// Log the error for debugging
		fmt.Printf("Exchange rate service error: %v\n", err)
		sendJSONError(w, err.Error(), http.StatusBadGateway)
		return
	}

	// Ensure we have at least some rates
	if len(rates) == 0 {
		sendJSONError(w, "No exchange rates available", http.StatusServiceUnavailable)
		return
	}

	// Always include USD base rate.
	payload := make(map[string]float64, len(rates)+1)
	for symbol, value := range rates {
		payload[symbol] = value
	}
	if _, ok := payload["USD"]; !ok {
		payload["USD"] = 1
	}

	timestamp := fetchedAt
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}

	// 🔧 NEW: Wrap response to match frontend expected format
	source := "live"
	if stale {
		source = "cache"
	}

	response := map[string]interface{}{
		"rates":        payload,
		"last_updated": timestamp.Format(time.RFC3339),
		"source":       source,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=30")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		sendJSONError(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

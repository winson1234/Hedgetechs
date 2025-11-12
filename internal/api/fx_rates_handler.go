package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"brokerageProject/internal/services"
)

// FXRatesHandler handles requests for bulk FX rates
type FXRatesHandler struct {
	massiveService *services.MassiveService
	cache          map[string]float64
	cacheMu        sync.RWMutex
	cacheExpiry    time.Time
}

// NewFXRatesHandler creates a new FX rates handler
func NewFXRatesHandler(massiveService *services.MassiveService) *FXRatesHandler {
	return &FXRatesHandler{
		massiveService: massiveService,
		cache:          make(map[string]float64),
	}
}

// HandleFXRates returns exchange rates for common currencies to USD
// Returns: {"EUR": 1.09, "MYR": 0.23, "JPY": 0.0069, "USD": 1.0}
func (h *FXRatesHandler) HandleFXRates(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	// Check cache
	h.cacheMu.RLock()
	if time.Now().Before(h.cacheExpiry) && len(h.cache) > 0 {
		rates := h.cache
		h.cacheMu.RUnlock()
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(rates)
		return
	}
	h.cacheMu.RUnlock()

	// Fetch fresh rates
	rates := make(map[string]float64)
	rates["USD"] = 1.0 // USD to USD is always 1.0

	// Common currencies to fetch
	currencies := []string{"EUR", "MYR", "JPY"}

	// Use wait group to fetch rates concurrently
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, currency := range currencies {
		wg.Add(1)
		go func(curr string) {
			defer wg.Done()

			// Fetch rate from Frankfurter API via MassiveService
			rate, err := h.massiveService.GetFXRate(curr, "USD")
			if err != nil {
				log.Printf("Failed to fetch %s/USD rate: %v", curr, err)
				// Use fallback approximations if API fails
				mu.Lock()
				switch curr {
				case "EUR":
					rates[curr] = 1.09 // Approximate EUR to USD
				case "MYR":
					rates[curr] = 0.23 // Approximate MYR to USD
				case "JPY":
					rates[curr] = 0.0069 // Approximate JPY to USD
				default:
					rates[curr] = 1.0
				}
				mu.Unlock()
				return
			}

			mu.Lock()
			rates[curr] = rate
			mu.Unlock()
		}(currency)
	}

	wg.Wait()

	// Update cache (cache for 5 minutes)
	h.cacheMu.Lock()
	h.cache = rates
	h.cacheExpiry = time.Now().Add(5 * time.Minute)
	h.cacheMu.Unlock()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rates)
}

package api

import (
	"io"
	"log"
	"net/http"
	"time"
)

// ProxyBinanceKlines proxies Binance klines (candlestick) requests
func ProxyBinanceKlines(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	interval := r.URL.Query().Get("interval")
	limit := r.URL.Query().Get("limit")

	if symbol == "" || interval == "" {
		http.Error(w, `{"error":"Missing required parameters: symbol, interval"}`, http.StatusBadRequest)
		return
	}

	if limit == "" {
		limit = "100"
	}

	// Build Binance API URL
	binanceURL := "https://api.binance.com/api/v3/klines"
	req, err := http.NewRequest("GET", binanceURL, nil)
	if err != nil {
		log.Printf("❌ Error creating Binance request: %v", err)
		http.Error(w, `{"error":"Failed to create request"}`, http.StatusInternalServerError)
		return
	}

	// Add query parameters
	q := req.URL.Query()
	q.Add("symbol", symbol)
	q.Add("interval", interval)
	q.Add("limit", limit)
	req.URL.RawQuery = q.Encode()

	// Make request with timeout
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Error fetching klines from Binance: %v", err)
		http.Error(w, `{"error":"Failed to fetch from Binance"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ Error reading Binance response: %v", err)
		http.Error(w, `{"error":"Failed to read response"}`, http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)

	log.Printf("✅ Proxied Binance klines: symbol=%s, interval=%s, limit=%s, status=%d", symbol, interval, limit, resp.StatusCode)
}

// ProxyExchangeRates proxies exchange rate API requests
func ProxyExchangeRates(w http.ResponseWriter, r *http.Request) {
	base := r.URL.Query().Get("base")
	if base == "" {
		base = "USD"
	}

	// Use exchangerate-api.com (free tier)
	url := "https://api.exchangerate-api.com/v4/latest/" + base

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("❌ Error fetching exchange rates: %v", err)
		http.Error(w, `{"error":"Failed to fetch exchange rates"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read response"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)

	log.Printf("✅ Proxied exchange rates: base=%s, status=%d", base, resp.StatusCode)
}

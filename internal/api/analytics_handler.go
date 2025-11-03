package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"brokerageProject/internal/indicators"
	"brokerageProject/internal/services"
)

// AnalyticsHandler handles analytics requests for forex and technical indicators
type AnalyticsHandler struct {
	MassiveService *services.MassiveService
}

// NewAnalyticsHandler creates a new analytics handler
func NewAnalyticsHandler(massiveService *services.MassiveService) *AnalyticsHandler {
	return &AnalyticsHandler{
		MassiveService: massiveService,
	}
}

// HandleAnalytics processes analytics requests
// Supports:
//   - /api/v1/analytics?type=fx_rate&from=EUR&to=USD
func (h *AnalyticsHandler) HandleAnalytics(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	queryType := r.URL.Query().Get("type")

	switch queryType {
	case "fx_rate":
		h.handleFXRate(w, r)
	case "rsi":
		h.handleRSI(w, r)
	case "sma":
		h.handleSMA(w, r)
	case "ema":
		h.handleEMA(w, r)
	case "macd":
		h.handleMACD(w, r)
	default:
		writeErrorResponse(w, fmt.Sprintf("Unknown analytics type: %s. Supported types: fx_rate, rsi, sma, ema, macd", queryType), http.StatusBadRequest)
	}
}

// handleFXRate handles forex rate requests
func (h *AnalyticsHandler) handleFXRate(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	if from == "" || to == "" {
		writeErrorResponse(w, "Missing required parameters: from and to", http.StatusBadRequest)
		return
	}

	// Fetch FX rate from Massive API
	rate, err := h.MassiveService.GetFXRate(from, to)
	if err != nil {
		log.Printf("Error fetching FX rate for %s/%s: %v", from, to, err)
		writeErrorResponse(w, fmt.Sprintf("Failed to fetch FX rate: %v", err), http.StatusInternalServerError)
		return
	}

	// Build response
	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"from": from,
			"to":   to,
			"rate": rate,
			"pair": fmt.Sprintf("%s/%s", from, to),
		},
	}

	writeJSONResponse(w, response, http.StatusOK)
}

// writeJSONResponse writes a JSON response
func writeJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// writeErrorResponse writes an error response
func writeErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	response := map[string]interface{}{
		"status": "error",
		"error":  message,
	}
	writeJSONResponse(w, response, statusCode)
}

// fetchKlinesFromBinance fetches historical kline data from Binance
func (h *AnalyticsHandler) fetchKlinesFromBinance(symbol, interval string, limit int) ([]float64, error) {
	// Build Binance API URL
	url := fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d", symbol, interval, limit)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch klines: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("binance API error: %s", string(body))
	}

	var rawKlines [][]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawKlines); err != nil {
		return nil, fmt.Errorf("failed to decode klines: %w", err)
	}

	// Extract close prices (index 4)
	closes := make([]float64, len(rawKlines))
	for i, kline := range rawKlines {
		closeStr, ok := kline[4].(string)
		if !ok {
			return nil, fmt.Errorf("invalid close price format")
		}
		close, err := strconv.ParseFloat(closeStr, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse close price: %w", err)
		}
		closes[i] = close
	}

	return closes, nil
}

// handleRSI calculates and returns RSI
func (h *AnalyticsHandler) handleRSI(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	if symbol == "" {
		writeErrorResponse(w, "Missing required parameter: symbol", http.StatusBadRequest)
		return
	}

	periodStr := r.URL.Query().Get("period")
	if periodStr == "" {
		periodStr = "14" // Default RSI period
	}
	period, err := strconv.Atoi(periodStr)
	if err != nil || period <= 0 {
		writeErrorResponse(w, "Invalid period parameter", http.StatusBadRequest)
		return
	}

	// Fetch klines (need more data than period for accurate RSI)
	closes, err := h.fetchKlinesFromBinance(symbol, "1h", period*3)
	if err != nil {
		log.Printf("Error fetching klines for RSI: %v", err)
		writeErrorResponse(w, fmt.Sprintf("Failed to fetch market data: %v", err), http.StatusInternalServerError)
		return
	}

	rsi := indicators.CalculateRSI(closes, period)

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"symbol": symbol,
			"rsi":    rsi,
			"period": period,
		},
	}

	writeJSONResponse(w, response, http.StatusOK)
}

// handleSMA calculates and returns Simple Moving Average
func (h *AnalyticsHandler) handleSMA(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	if symbol == "" {
		writeErrorResponse(w, "Missing required parameter: symbol", http.StatusBadRequest)
		return
	}

	periodStr := r.URL.Query().Get("period")
	if periodStr == "" {
		periodStr = "20" // Default SMA period
	}
	period, err := strconv.Atoi(periodStr)
	if err != nil || period <= 0 {
		writeErrorResponse(w, "Invalid period parameter", http.StatusBadRequest)
		return
	}

	closes, err := h.fetchKlinesFromBinance(symbol, "1h", period*2)
	if err != nil {
		log.Printf("Error fetching klines for SMA: %v", err)
		writeErrorResponse(w, fmt.Sprintf("Failed to fetch market data: %v", err), http.StatusInternalServerError)
		return
	}

	sma := indicators.CalculateSMA(closes, period)
	latestSMA := indicators.GetLatestValue(sma)

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"symbol": symbol,
			"sma":    latestSMA,
			"period": period,
		},
	}

	writeJSONResponse(w, response, http.StatusOK)
}

// handleEMA calculates and returns Exponential Moving Average
func (h *AnalyticsHandler) handleEMA(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	if symbol == "" {
		writeErrorResponse(w, "Missing required parameter: symbol", http.StatusBadRequest)
		return
	}

	periodStr := r.URL.Query().Get("period")
	if periodStr == "" {
		periodStr = "12" // Default EMA period
	}
	period, err := strconv.Atoi(periodStr)
	if err != nil || period <= 0 {
		writeErrorResponse(w, "Invalid period parameter", http.StatusBadRequest)
		return
	}

	closes, err := h.fetchKlinesFromBinance(symbol, "1h", period*3)
	if err != nil {
		log.Printf("Error fetching klines for EMA: %v", err)
		writeErrorResponse(w, fmt.Sprintf("Failed to fetch market data: %v", err), http.StatusInternalServerError)
		return
	}

	ema := indicators.CalculateEMA(closes, period)
	latestEMA := indicators.GetLatestValue(ema)

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"symbol": symbol,
			"ema":    latestEMA,
			"period": period,
		},
	}

	writeJSONResponse(w, response, http.StatusOK)
}

// handleMACD calculates and returns MACD
func (h *AnalyticsHandler) handleMACD(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	if symbol == "" {
		writeErrorResponse(w, "Missing required parameter: symbol", http.StatusBadRequest)
		return
	}

	// Standard MACD periods: 12, 26, 9
	closes, err := h.fetchKlinesFromBinance(symbol, "1h", 100)
	if err != nil {
		log.Printf("Error fetching klines for MACD: %v", err)
		writeErrorResponse(w, fmt.Sprintf("Failed to fetch market data: %v", err), http.StatusInternalServerError)
		return
	}

	macdResult := indicators.CalculateMACD(closes, 12, 26, 9)
	latestMACD := indicators.GetLatestValue(macdResult.MACD)
	latestSignal := indicators.GetLatestValue(macdResult.Signal)
	latestHistogram := indicators.GetLatestValue(macdResult.Histogram)

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"symbol":    symbol,
			"macd":      latestMACD,
			"signal":    latestSignal,
			"histogram": latestHistogram,
		},
	}

	writeJSONResponse(w, response, http.StatusOK)
}

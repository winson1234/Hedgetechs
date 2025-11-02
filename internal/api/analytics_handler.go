package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

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
	default:
		writeErrorResponse(w, fmt.Sprintf("Unknown analytics type: %s. Supported types: fx_rate", queryType), http.StatusBadRequest)
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

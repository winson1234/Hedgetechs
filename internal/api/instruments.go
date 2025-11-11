package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/models"
)

// GetInstruments handles GET /api/v1/instruments
// Returns list of all tradeable instruments
func GetInstruments(w http.ResponseWriter, r *http.Request) {
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Query for all tradeable instruments
	rows, err := pool.Query(ctx,
		`SELECT symbol, name, base_currency, quote_currency, instrument_type,
		        is_tradeable, leverage_cap, spread_adjustment_bps,
		        min_order_size, max_order_size, tick_size, created_at, updated_at
		 FROM instruments
		 WHERE is_tradeable = true
		 ORDER BY instrument_type, symbol`,
	)
	if err != nil {
		log.Printf("Failed to query instruments: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch instruments")
		return
	}
	defer rows.Close()

	var instruments []models.Instrument
	for rows.Next() {
		var instrument models.Instrument
		err := rows.Scan(
			&instrument.Symbol, &instrument.Name, &instrument.BaseCurrency,
			&instrument.QuoteCurrency, &instrument.InstrumentType,
			&instrument.IsTradeable, &instrument.LeverageCap, &instrument.SpreadAdjustmentBps,
			&instrument.MinOrderSize, &instrument.MaxOrderSize, &instrument.TickSize,
			&instrument.CreatedAt, &instrument.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan instrument: %v", err)
			continue
		}
		instruments = append(instruments, instrument)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Row iteration error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "error processing instruments")
		return
	}

	// Return empty array if no instruments found
	if instruments == nil {
		instruments = []models.Instrument{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"instruments": instruments,
	})
}

// GetInstrumentBySymbol handles GET /api/v1/instruments/{symbol}
// Returns a single instrument by its symbol
func GetInstrumentBySymbol(w http.ResponseWriter, r *http.Request) {
	// Extract symbol from URL path
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "symbol parameter is required")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var instrument models.Instrument
	err = pool.QueryRow(ctx,
		`SELECT symbol, name, base_currency, quote_currency, instrument_type,
		        is_tradeable, leverage_cap, spread_adjustment_bps,
		        min_order_size, max_order_size, tick_size, created_at, updated_at
		 FROM instruments
		 WHERE symbol = $1`,
		symbol,
	).Scan(
		&instrument.Symbol, &instrument.Name, &instrument.BaseCurrency,
		&instrument.QuoteCurrency, &instrument.InstrumentType,
		&instrument.IsTradeable, &instrument.LeverageCap, &instrument.SpreadAdjustmentBps,
		&instrument.MinOrderSize, &instrument.MaxOrderSize, &instrument.TickSize,
		&instrument.CreatedAt, &instrument.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to fetch instrument %s: %v", symbol, err)
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"instrument": instrument,
	})
}

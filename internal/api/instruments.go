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
// Returns list of all tradeable instruments with their configurations
func GetInstruments(w http.ResponseWriter, r *http.Request) {
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Query instruments with LEFT JOINs to get configurations
	query := `
		SELECT
			i.symbol, i.instrument_type, i.base_currency, i.quote_currency,
			i.is_tradable, i.created_at, i.updated_at,
			-- Spot configuration fields
			sc.base_precision, sc.quote_precision, sc.tick_size, sc.step_size,
			sc.min_quantity, sc.max_quantity, sc.min_notional, sc.max_notional,
			sc.maker_fee_rate, sc.taker_fee_rate,
			-- Forex configuration fields
			fc.digits, fc.contract_size, fc.pip_size, fc.min_lot, fc.max_lot,
			fc.lot_step, fc.max_leverage, fc.margin_currency, fc.stop_level,
			fc.freeze_level, fc.swap_enable, fc.swap_long, fc.swap_short, fc.swap_triple_day
		FROM instruments i
		LEFT JOIN spot_configurations sc ON i.symbol = sc.symbol
		LEFT JOIN forex_configurations fc ON i.symbol = fc.symbol
		WHERE i.is_tradable = true
		ORDER BY i.instrument_type, i.symbol
	`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		log.Printf("Failed to query instruments: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch instruments")
		return
	}
	defer rows.Close()

	var instruments []models.Instrument
	for rows.Next() {
		var instrument models.Instrument
		var spotConfig models.SpotConfiguration
		var forexConfig models.ForexConfiguration

		// Nullable fields for configurations
		var basePrecision, quotePrecision, digits, contractSize, stopLevel, freezeLevel *int
		var tickSize, stepSize, minQuantity, maxQuantity, minNotional, maxNotional *float64
		var makerFee, takerFee, pipSize, minLot, maxLot, lotStep *float64
		var maxLeverage *int
		var marginCurrency, swapTripleDay *string
		var swapEnable *bool
		var swapLong, swapShort *float64

		err := rows.Scan(
			&instrument.Symbol, &instrument.InstrumentType, &instrument.BaseCurrency,
			&instrument.QuoteCurrency, &instrument.IsTradeable, &instrument.CreatedAt, &instrument.UpdatedAt,
			// Spot config (nullable)
			&basePrecision, &quotePrecision, &tickSize, &stepSize,
			&minQuantity, &maxQuantity, &minNotional, &maxNotional,
			&makerFee, &takerFee,
			// Forex config (nullable)
			&digits, &contractSize, &pipSize, &minLot, &maxLot,
			&lotStep, &maxLeverage, &marginCurrency, &stopLevel,
			&freezeLevel, &swapEnable, &swapLong, &swapShort, &swapTripleDay,
		)
		if err != nil {
			log.Printf("Failed to scan instrument: %v", err)
			continue
		}

		// Populate spot config if present
		if basePrecision != nil {
			spotConfig.Symbol = instrument.Symbol
			spotConfig.BasePrecision = *basePrecision
			spotConfig.QuotePrecision = *quotePrecision
			spotConfig.TickSize = *tickSize
			spotConfig.StepSize = *stepSize
			spotConfig.MinQuantity = *minQuantity
			spotConfig.MaxQuantity = *maxQuantity
			spotConfig.MinNotional = *minNotional
			spotConfig.MaxNotional = *maxNotional
			spotConfig.MakerFeeRate = *makerFee
			spotConfig.TakerFeeRate = *takerFee
			instrument.SpotConfig = &spotConfig
		}

		// Populate forex config if present
		if digits != nil {
			forexConfig.Symbol = instrument.Symbol
			forexConfig.Digits = *digits
			forexConfig.ContractSize = *contractSize
			forexConfig.PipSize = *pipSize
			forexConfig.MinLot = *minLot
			forexConfig.MaxLot = *maxLot
			forexConfig.LotStep = *lotStep
			forexConfig.MaxLeverage = *maxLeverage
			forexConfig.MarginCurrency = *marginCurrency
			forexConfig.StopLevel = *stopLevel
			forexConfig.FreezeLevel = *freezeLevel
			forexConfig.SwapEnable = *swapEnable
			forexConfig.SwapLong = *swapLong
			forexConfig.SwapShort = *swapShort
			forexConfig.SwapTripleDay = *swapTripleDay
			instrument.ForexConfig = &forexConfig
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
// Returns a single instrument by its symbol with configuration
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

	// Query instrument with configurations
	query := `
		SELECT
			i.symbol, i.instrument_type, i.base_currency, i.quote_currency,
			i.is_tradable, i.created_at, i.updated_at,
			-- Spot configuration fields
			sc.base_precision, sc.quote_precision, sc.tick_size, sc.step_size,
			sc.min_quantity, sc.max_quantity, sc.min_notional, sc.max_notional,
			sc.maker_fee_rate, sc.taker_fee_rate,
			-- Forex configuration fields
			fc.digits, fc.contract_size, fc.pip_size, fc.min_lot, fc.max_lot,
			fc.lot_step, fc.max_leverage, fc.margin_currency, fc.stop_level,
			fc.freeze_level, fc.swap_enable, fc.swap_long, fc.swap_short, fc.swap_triple_day
		FROM instruments i
		LEFT JOIN spot_configurations sc ON i.symbol = sc.symbol
		LEFT JOIN forex_configurations fc ON i.symbol = fc.symbol
		WHERE i.symbol = $1
	`

	var instrument models.Instrument
	var spotConfig models.SpotConfiguration
	var forexConfig models.ForexConfiguration

	// Nullable fields for configurations
	var basePrecision, quotePrecision, digits, contractSize, stopLevel, freezeLevel *int
	var tickSize, stepSize, minQuantity, maxQuantity, minNotional, maxNotional *float64
	var makerFee, takerFee, pipSize, minLot, maxLot, lotStep *float64
	var maxLeverage *int
	var marginCurrency, swapTripleDay *string
	var swapEnable *bool
	var swapLong, swapShort *float64

	err = pool.QueryRow(ctx, query, symbol).Scan(
		&instrument.Symbol, &instrument.InstrumentType, &instrument.BaseCurrency,
		&instrument.QuoteCurrency, &instrument.IsTradeable, &instrument.CreatedAt, &instrument.UpdatedAt,
		// Spot config (nullable)
		&basePrecision, &quotePrecision, &tickSize, &stepSize,
		&minQuantity, &maxQuantity, &minNotional, &maxNotional,
		&makerFee, &takerFee,
		// Forex config (nullable)
		&digits, &contractSize, &pipSize, &minLot, &maxLot,
		&lotStep, &maxLeverage, &marginCurrency, &stopLevel,
		&freezeLevel, &swapEnable, &swapLong, &swapShort, &swapTripleDay,
	)

	if err != nil {
		log.Printf("Failed to fetch instrument %s: %v", symbol, err)
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}

	// Populate spot config if present
	if basePrecision != nil {
		spotConfig.Symbol = instrument.Symbol
		spotConfig.BasePrecision = *basePrecision
		spotConfig.QuotePrecision = *quotePrecision
		spotConfig.TickSize = *tickSize
		spotConfig.StepSize = *stepSize
		spotConfig.MinQuantity = *minQuantity
		spotConfig.MaxQuantity = *maxQuantity
		spotConfig.MinNotional = *minNotional
		spotConfig.MaxNotional = *maxNotional
		spotConfig.MakerFeeRate = *makerFee
		spotConfig.TakerFeeRate = *takerFee
		instrument.SpotConfig = &spotConfig
	}

	// Populate forex config if present
	if digits != nil {
		forexConfig.Symbol = instrument.Symbol
		forexConfig.Digits = *digits
		forexConfig.ContractSize = *contractSize
		forexConfig.PipSize = *pipSize
		forexConfig.MinLot = *minLot
		forexConfig.MaxLot = *maxLot
		forexConfig.LotStep = *lotStep
		forexConfig.MaxLeverage = *maxLeverage
		forexConfig.MarginCurrency = *marginCurrency
		forexConfig.StopLevel = *stopLevel
		forexConfig.FreezeLevel = *freezeLevel
		forexConfig.SwapEnable = *swapEnable
		forexConfig.SwapLong = *swapLong
		forexConfig.SwapShort = *swapShort
		forexConfig.SwapTripleDay = *swapTripleDay
		instrument.ForexConfig = &forexConfig
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"instrument": instrument,
	})
}

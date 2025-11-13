package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"brokerageProject/internal/models"
	"brokerageProject/internal/services"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OrderProcessor processes pending orders in real-time based on price updates
// This is an event-driven worker that receives messages through a dedicated channel
type OrderProcessor struct {
	db             *pgxpool.Pool
	MessageChannel chan []byte      // Channel to receive raw messages (fed by main.go)
	priceData      chan PriceUpdate // Channel to receive parsed price updates
	quit           chan bool         // Channel to signal shutdown
}

// PriceUpdate represents a parsed price message from Binance
type PriceUpdate struct {
	Symbol string  `json:"symbol"` // e.g., "BTCUSDT"
	Price  float64 `json:"price"`  // Current price
}

// NewOrderProcessor creates a new order processor instance
func NewOrderProcessor(db *pgxpool.Pool) *OrderProcessor {
	return &OrderProcessor{
		db:             db,
		MessageChannel: make(chan []byte, 8192),      // Increased buffer to match hub's broadcast channel
		priceData:      make(chan PriceUpdate, 256), // Buffered channel for parsed price updates
		quit:           make(chan bool),
	}
}

// Run starts the order processor
// It listens to messages from MessageChannel and processes pending orders in real-time
func (op *OrderProcessor) Run() {
	log.Println("✅ Order Processor started (event-driven mode)")

	// Start price parser goroutine
	go op.parsePriceUpdates()

	// Start order processing goroutine
	go op.processOrders()

	log.Println("✅ Order Processor is listening to real-time price updates")
}

// parsePriceUpdates listens to the MessageChannel and parses price messages
// This runs in a goroutine and forwards parsed prices to the priceData channel
// Messages are sent to this channel from main.go when Binance updates arrive
func (op *OrderProcessor) parsePriceUpdates() {
	// Get global price cache for market order execution
	priceCache := services.GetGlobalPriceCache()

	messageCount := 0
	parsedCount := 0

	for {
		select {
		case message := <-op.MessageChannel:
			messageCount++
			// Log every 100th message to avoid spam
			if messageCount%100 == 0 {
				log.Printf("📊 Order processor received %d messages, parsed %d price updates", messageCount, parsedCount)
			}

			// Parse the message to extract symbol and price
			priceUpdate, err := op.parseMessage(message)
			if err != nil {
				// Skip invalid messages (not all messages are price updates)
				// Log first 5 parse failures for debugging
				if parsedCount < 5 {
					log.Printf("⚠️ Failed to parse message: %v (message: %s)", err, string(message[:min(len(message), 200)]))
				}
				continue
			}

			parsedCount++
			// Log first successful parse
			if parsedCount == 1 {
				log.Printf("✅ First price update parsed: %s @ %.2f", priceUpdate.Symbol, priceUpdate.Price)
			}

			// Update global price cache (CRITICAL: used by market order execution)
			priceCache.UpdatePrice(priceUpdate.Symbol, priceUpdate.Price)

			// Forward to price data channel for processing pending orders
			select {
			case op.priceData <- priceUpdate:
				// Successfully enqueued
			default:
				// Channel full, skip this update (price updates are frequent, missing one is ok)
			}

		case <-op.quit:
			log.Println("Price parser stopped")
			return
		}
	}
}

// parseMessage attempts to parse a message from the hub into a price update
// Returns error if message is not a valid price update
func (op *OrderProcessor) parseMessage(message []byte) (PriceUpdate, error) {
	var update PriceUpdate

	// Define struct matching models.PriceUpdateMessage (from binance/client.go)
	// This is the format sent by our Binance client, not raw Binance JSON
	var incomingMsg struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"` // Note: This field is a string
	}

	// Parse the JSON
	if err := json.Unmarshal(message, &incomingMsg); err != nil {
		return update, fmt.Errorf("invalid JSON: %w", err)
	}

	// Validate fields to filter out non-price messages (like orderbook updates)
	if incomingMsg.Symbol == "" || incomingMsg.Price == "" {
		return update, fmt.Errorf("not a price update message")
	}

	// Convert Price string to float64 using strconv for accurate financial precision
	price, err := strconv.ParseFloat(incomingMsg.Price, 64)
	if err != nil {
		return update, fmt.Errorf("invalid price format: %w", err)
	}

	update.Symbol = incomingMsg.Symbol
	update.Price = price
	return update, nil
}

// processOrders listens to price updates and executes pending orders when conditions are met
// This is the core event-driven logic - NO POLLING, NO TIMERS
func (op *OrderProcessor) processOrders() {
	for {
		select {
		case priceUpdate := <-op.priceData:
			// Process all pending orders for this symbol
			op.processPendingOrdersForSymbol(priceUpdate.Symbol, priceUpdate.Price)

		case <-op.quit:
			log.Println("Order processor stopped")
			return
		}
	}
}

// processPendingOrdersForSymbol processes all pending orders for a specific symbol
// This is called whenever a price update is received for that symbol
func (op *OrderProcessor) processPendingOrdersForSymbol(symbol string, currentPrice float64) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Query pending orders for this symbol
	// CRITICAL INDEX: This query uses idx_pending_orders_symbol_status for O(1) lookup
	rows, err := op.db.Query(ctx,
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price, status, order_number
		 FROM pending_orders
		 WHERE symbol = $1 AND status = 'pending'`,
		symbol,
	)
	if err != nil {
		log.Printf("❌ Failed to query pending orders for %s: %v", symbol, err)
		return
	}
	defer rows.Close()

	// Parse orders
	var orders []models.PendingOrder
	for rows.Next() {
		var order models.PendingOrder
		err := rows.Scan(
			&order.ID, &order.UserID, &order.AccountID, &order.Symbol,
			&order.Type, &order.Side, &order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Status, &order.OrderNumber,
		)
		if err != nil {
			log.Printf("❌ Failed to scan pending order: %v", err)
			continue
		}
		orders = append(orders, order)
	}

	// Log order processing (only for first price update per symbol to avoid spam)
	if len(orders) > 0 {
		log.Printf("🔍 Processing %d pending orders for %s at price %.2f", len(orders), symbol, currentPrice)
	}

	// Process each order
	for _, order := range orders {
		// Check if order should execute
		shouldExecute := order.ShouldExecute(currentPrice)

		// Log first order check for debugging
		log.Printf("📋 Order %s: %s %s @ %.2f, Current: %.2f, ShouldExecute: %v",
			*order.OrderNumber, order.Side, order.Type, order.TriggerPrice, currentPrice, shouldExecute)

		if shouldExecute {
			log.Printf("⚡ Executing pending order %s for %s at price %.8f", order.ID, order.Symbol, currentPrice)
			op.executePendingOrder(ctx, order, currentPrice)
		}
	}
}

// executePendingOrder executes a pending order that has been triggered
func (op *OrderProcessor) executePendingOrder(ctx context.Context, order models.PendingOrder, currentPrice float64) {
	// Get execution price (use limit price if set, otherwise current price)
	executionPrice := order.GetExecutionPrice(currentPrice)

	// Start transaction
	tx, err := op.db.Begin(ctx)
	if err != nil {
		log.Printf("❌ Failed to begin transaction for order %s: %v", order.ID, err)
		return
	}
	defer tx.Rollback(ctx)

	// Get instrument quote currency
	var quoteCurrency string
	err = tx.QueryRow(ctx, "SELECT quote_currency FROM instruments WHERE symbol = $1", order.Symbol).Scan(&quoteCurrency)
	if err != nil {
		log.Printf("❌ Failed to get quote currency for %s: %v", order.Symbol, err)
		return
	}

	// Use shared order execution service to update balances
	// This eliminates ~150 lines of duplicated logic
	executionService := services.NewOrderExecutionService(op.db)
	_, _, _, err = executionService.ExecuteSpotTrade(
		ctx,
		tx,
		order.AccountID,
		order.Symbol,
		order.Side,
		order.Quantity,
		executionPrice,
		quoteCurrency,
	)

	if err != nil {
		log.Printf("❌ Failed to execute spot trade for order %s: %v", order.ID, err)
		// Mark order as failed
		tx.Exec(ctx, "UPDATE pending_orders SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2",
			err.Error(), order.ID)
		tx.Commit(ctx)
		return
	}

	// Update pending order status to executed
	_, err = tx.Exec(ctx,
		`UPDATE pending_orders
		 SET status = 'executed',
		     executed_at = NOW(),
		     executed_price = $1,
		     updated_at = NOW()
		 WHERE id = $2`,
		executionPrice, order.ID,
	)
	if err != nil {
		log.Printf("❌ Failed to update pending order %s: %v", order.ID, err)
		return
	}

	// Create order history record (insert into orders table)
	orderID := uuid.New()

	// Use the PRE-EXISTING order number from the pending order
	orderNumber := "UNKNOWN" // Default fallback
	if order.OrderNumber != nil {
		orderNumber = *order.OrderNumber
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO orders (
			id, user_id, account_id, symbol, order_number, side, type, status,
			amount_base, limit_price, stop_price, filled_amount, average_fill_price,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, 'filled',
			$8, $9, NULL, $8, $10,
			NOW(), NOW()
		)`,
		orderID, order.UserID, order.AccountID, order.Symbol,
		orderNumber, // Use the passed-through order number
		order.Side, order.Type, // Preserve original order type
		order.Quantity, order.LimitPrice, executionPrice,
	)
	if err != nil {
		log.Printf("❌ Failed to create order history for pending order %s: %v", order.ID, err)
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("❌ Failed to commit transaction for order %s: %v", order.ID, err)
		return
	}

	log.Printf("✅ Successfully executed pending order %s: %s %.8f %s at %.8f",
		order.ID, order.Side, order.Quantity, order.Symbol, executionPrice)

	// TODO: Log audit event for order execution
	// utils.GlobalAuditLogger.LogPendingOrderExecuted(ctx, order.UserID, order.AccountID, order.ID, order.Symbol, fmt.Sprintf("%.8f", executionPrice))
}

// Stop gracefully stops the order processor
func (op *OrderProcessor) Stop() {
	log.Println("Stopping order processor...")
	close(op.quit)
}

// GetStats returns current processor statistics (for monitoring/debugging)
type ProcessorStats struct {
	PriceQueueLength int
	IsRunning        bool
}

func (op *OrderProcessor) GetStats() ProcessorStats {
	return ProcessorStats{
		PriceQueueLength: len(op.priceData),
		IsRunning:        true,
	}
}

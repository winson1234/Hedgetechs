package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"brokerageProject/internal/models"

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
		MessageChannel: make(chan []byte, 2048),      // Large buffer to match hub's broadcast channel
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
	for {
		select {
		case message := <-op.MessageChannel:
			// Parse the message to extract symbol and price
			priceUpdate, err := op.parseMessage(message)
			if err != nil {
				// Skip invalid messages (not all messages are price updates)
				continue
			}

			// Forward to price data channel for processing
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

	// Try to parse as JSON
	var raw map[string]interface{}
	if err := json.Unmarshal(message, &raw); err != nil {
		return update, fmt.Errorf("invalid JSON: %w", err)
	}

	// Check for trade message (from Binance WebSocket)
	// Format: {"s": "BTCUSDT", "p": "50000.00", "e": "trade", ...}
	if eventType, ok := raw["e"].(string); ok && eventType == "trade" {
		symbol, _ := raw["s"].(string)
		priceStr, _ := raw["p"].(string)

		if symbol == "" || priceStr == "" {
			return update, fmt.Errorf("missing symbol or price")
		}

		var price float64
		_, err := fmt.Sscanf(priceStr, "%f", &price)
		if err != nil {
			return update, fmt.Errorf("invalid price format: %w", err)
		}

		update.Symbol = symbol
		update.Price = price
		return update, nil
	}

	// Check for aggregated trade message
	// Format: {"s": "BTCUSDT", "p": "50000.00", "e": "aggTrade", ...}
	if eventType, ok := raw["e"].(string); ok && eventType == "aggTrade" {
		symbol, _ := raw["s"].(string)
		priceStr, _ := raw["p"].(string)

		if symbol == "" || priceStr == "" {
			return update, fmt.Errorf("missing symbol or price")
		}

		var price float64
		_, err := fmt.Sscanf(priceStr, "%f", &price)
		if err != nil {
			return update, fmt.Errorf("invalid price format: %w", err)
		}

		update.Symbol = symbol
		update.Price = price
		return update, nil
	}

	// Not a price update message, skip
	return update, fmt.Errorf("not a price update")
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
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price
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
			&order.Type, &order.Side, &order.Quantity, &order.TriggerPrice, &order.LimitPrice,
		)
		if err != nil {
			log.Printf("❌ Failed to scan pending order: %v", err)
			continue
		}
		orders = append(orders, order)
	}

	// Process each order
	for _, order := range orders {
		// Check if order should execute
		if order.ShouldExecute(currentPrice) {
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

	// NOTE: In production, calculate total cost and update account balances:
	// totalCost := order.Quantity * executionPrice
	// - Check account balance
	// - Deduct funds for buy orders
	// - Credit funds for sell orders
	// - Create balance transaction records

	// Update account balance (simplified - in production you'd need more complex logic)
	// For now, we'll just mark the order as executed
	// In production, you would:
	// 1. Check account balance
	// 2. Deduct funds for buy orders
	// 3. Credit funds for sell orders
	// 4. Create balance transaction records
	// 5. Create order history records

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
	_, err = tx.Exec(ctx,
		`INSERT INTO orders (
			id, user_id, account_id, symbol, order_number, side, type, status,
			amount_base, limit_price, stop_price, filled_amount, average_fill_price,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, 'market', 'filled',
			$7, $8, NULL, $7, $9,
			NOW(), NOW()
		)`,
		orderID, order.UserID, order.AccountID, order.Symbol,
		fmt.Sprintf("ORD-%s", orderID.String()[:8]), // Simplified order number
		order.Side, order.Quantity, order.LimitPrice, executionPrice,
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

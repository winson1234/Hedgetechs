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
	db                  *pgxpool.Pool
	hub                 Hub              // Hub for broadcasting order execution notifications to WebSocket clients
	MessageChannel      chan []byte      // Channel to receive raw messages (fed by main.go)
	priceData           chan PriceUpdate // Channel to receive parsed price updates
	quit                chan bool         // Channel to signal shutdown
	liquidationService  *services.LiquidationService // Service for automatic liquidations
}

// Hub interface for broadcasting messages (allows dependency injection and testing)
type Hub interface {
	BroadcastMessage(message []byte)
}

// PriceUpdate represents a parsed price message from Binance
type PriceUpdate struct {
	Symbol string  `json:"symbol"` // e.g., "BTCUSDT"
	Price  float64 `json:"price"`  // Current price
}

// NewOrderProcessor creates a new order processor instance
func NewOrderProcessor(db *pgxpool.Pool, hub Hub) *OrderProcessor {
	return &OrderProcessor{
		db:                 db,
		hub:                hub,
		MessageChannel:     make(chan []byte, 8192),      // Increased buffer to match hub's broadcast channel
		priceData:          make(chan PriceUpdate, 256), // Buffered channel for parsed price updates
		quit:               make(chan bool),
		liquidationService: services.NewLiquidationService(db), // Initialize liquidation service
	}
}

// Run starts the order processor
// It listens to messages from MessageChannel and processes pending orders in real-time
func (op *OrderProcessor) Run() {
	log.Println("Order Processor started (event-driven mode)")

	// Start price parser goroutine
	go op.parsePriceUpdates()

	// Start order processing goroutine
	go op.processOrders()
}

// parsePriceUpdates listens to the MessageChannel and parses price messages
// This runs in a goroutine and forwards parsed prices to the priceData channel
// Messages are sent to this channel from main.go when Binance updates arrive
func (op *OrderProcessor) parsePriceUpdates() {
	// Get global price cache for market order execution
	priceCache := services.GetGlobalPriceCache()

	for {
		select {
		case message := <-op.MessageChannel:
			// Parse the message to extract symbol and price
			priceUpdate, err := op.parseMessage(message)
			if err != nil {
				// Skip invalid messages (not all messages are price updates)
				continue
			}

			// Update global price cache (CRITICAL: used by market order execution)
			priceCache.UpdatePrice(priceUpdate.Symbol, priceUpdate.Price)

			// CRITICAL: Check for liquidations immediately after price update (event-driven)
			// This ensures positions are liquidated in real-time, preventing negative balances
			ctx := context.Background()
			if err := op.liquidationService.CheckLiquidations(ctx, priceUpdate.Symbol, priceUpdate.Price); err != nil {
				log.Printf("ERROR: Liquidation check failed for %s: %v", priceUpdate.Symbol, err)
			}

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
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price, leverage, product_type, status, order_number
		 FROM pending_orders
		 WHERE symbol = $1 AND status = 'pending'`,
		symbol,
	)
	if err != nil {
		log.Printf("ERROR: Failed to query pending orders for %s: %v", symbol, err)
		return
	}
	defer rows.Close()

	// Parse orders
	var orders []models.PendingOrder
	for rows.Next() {
		var order models.PendingOrder
		err := rows.Scan(
			&order.ID, &order.UserID, &order.AccountID, &order.Symbol,
			&order.Type, &order.Side, &order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Leverage, &order.ProductType, &order.Status, &order.OrderNumber,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan pending order: %v", err)
			continue
		}
		orders = append(orders, order)
	}

	// Process each order
	for _, order := range orders {
		// Check if order should execute
		shouldExecute := order.ShouldExecute(currentPrice)

		if shouldExecute {
			log.Printf("Executing pending order %s for %s at price %.8f", order.ID, order.Symbol, currentPrice)
			op.executePendingOrder(ctx, order, currentPrice)
		}
	}
}

// executePendingOrder executes a pending order that has been triggered
func (op *OrderProcessor) executePendingOrder(ctx context.Context, order models.PendingOrder, currentPrice float64) {
	// Get execution price (use limit price if set, otherwise current price)
	executionPrice := order.GetExecutionPrice(currentPrice)

	// Use the PRE-EXISTING order number from the pending order
	orderNumber := "UNKNOWN" // Default fallback
	if order.OrderNumber != nil {
		orderNumber = *order.OrderNumber
	}

	// Create order record in database first (ExecuteOrder expects it to exist)
	newOrderID := uuid.New()
	_, err := op.db.Exec(ctx,
		`INSERT INTO orders (
			id, user_id, account_id, symbol, order_number, side, type, product_type, status,
			amount_base, limit_price, stop_price, leverage, filled_amount, average_fill_price,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, 'pending',
			$9, NULL, NULL, $10, 0, NULL,
			NOW(), NOW()
		)`,
		newOrderID, order.UserID, order.AccountID, order.Symbol,
		orderNumber, order.Side, "market", order.ProductType, // Pending orders execute as market orders
		order.Quantity, order.Leverage,
	)
	if err != nil {
		log.Printf("ERROR: Failed to create order record for pending order %s: %v", order.ID, err)
		return
	}

	// Use ExecuteOrder which handles both spot and leveraged orders
	executionService := services.NewOrderExecutionService(op.db)
	result, err := executionService.ExecuteOrder(ctx, newOrderID, executionPrice)

	if err != nil {
		log.Printf("ERROR: Failed to execute pending order %s: %v", order.ID, err)
		// Mark pending order as failed
		op.db.Exec(ctx, "UPDATE pending_orders SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2",
			err.Error(), order.ID)
		return
	}

	if !result.Success {
		log.Printf("ERROR: Execution failed for pending order %s: %s", order.ID, result.Message)
		// Mark pending order as failed
		op.db.Exec(ctx, "UPDATE pending_orders SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2",
			result.Message, order.ID)
		return
	}

	// Update pending order status to executed
	_, err = op.db.Exec(ctx,
		`UPDATE pending_orders
		 SET status = 'executed',
		     executed_at = NOW(),
		     executed_price = $1,
		     updated_at = NOW()
		 WHERE id = $2`,
		executionPrice, order.ID,
	)
	if err != nil {
		log.Printf("ERROR: Failed to update pending order %s: %v", order.ID, err)
		return
	}

	log.Printf("Executed pending order %s: %s %.8f %s at %.8f (leverage: %dx)",
		order.ID, order.Side, order.Quantity, order.Symbol, executionPrice, order.Leverage)

	// Broadcast order execution notification to WebSocket clients
	// This notifies the frontend to show a toast: "Your BUY limit order for 0.025 BTC at $100,000 has been executed"
	notificationMsg := map[string]interface{}{
		"type":            "order_executed",
		"user_id":         order.UserID.String(), // For frontend filtering
		"order_id":        order.ID.String(),
		"order_number":    orderNumber,
		"symbol":          order.Symbol,
		"side":            order.Side,
		"quantity":        fmt.Sprintf("%.8f", order.Quantity),
		"execution_price": fmt.Sprintf("%.2f", executionPrice),
		"product_type":    order.ProductType,
		"leverage":        order.Leverage,
	}
	if msgBytes, err := json.Marshal(notificationMsg); err == nil {
		op.hub.BroadcastMessage(msgBytes)
		log.Printf("Broadcasted order execution notification for order %s", orderNumber)
	} else {
		log.Printf("ERROR: Failed to marshal order execution notification: %v", err)
	}

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

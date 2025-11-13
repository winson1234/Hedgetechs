package market_data

// Provider defines a pluggable interface for market data sources.
// This allows us to switch between different implementations (Binance WebSocket, Twelve Data REST Polling, etc.)
// without changing the orchestration layer.
//
// Design Philosophy: "Ferrari engine on scooter fuel"
// - The infrastructure (WebSockets, Matching Engine, UI) is production-ready
// - The data source can be swapped from free-tier APIs to premium feeds by changing one line
type Provider interface {
	// Subscribe starts the data stream for the specified symbols.
	// The onTick callback is invoked whenever a new price arrives (real-time or simulated).
	//
	// Parameters:
	//   - symbols: List of instruments to subscribe to (e.g., ["BTCUSDT", "WTI", "BRENT"])
	//   - onTick: Callback function invoked for each price update
	//
	// Returns:
	//   - error: If subscription initialization fails (connection errors, invalid API key, etc.)
	//
	// Note: This method should be non-blocking. The provider runs in the background
	// and calls onTick asynchronously whenever data arrives.
	Subscribe(symbols []string, onTick func(symbol string, price float64)) error

	// Stop gracefully shuts down the provider and releases resources.
	// After calling Stop, the provider should no longer invoke the onTick callback.
	Stop()
}

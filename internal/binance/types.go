package binance

import "brokerageProject/internal/models"

// CombinedStreamMessage represents the wrapper format for Binance combined streams
// Ref: https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#general-wss-information
type CombinedStreamMessage struct {
	Stream string                     `json:"stream"` // e.g., "btcusdt@trade"
	Data   models.BinanceTradeMessage `json:"data"`   // The actual trade message
}

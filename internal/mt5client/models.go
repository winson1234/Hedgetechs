package mt5client

import "time"

// KlineBackfillRequest represents a request to the MT5 backfill API
type KlineBackfillRequest struct {
	Symbol    string `json:"symbol"`     // Forex symbol (e.g., "EURUSD")
	StartTime int64  `json:"start_time"` // Unix milliseconds
	EndTime   int64  `json:"end_time"`   // Unix milliseconds
}

// KlineData represents a single K-line bar matching the database schema
type KlineData struct {
	Timestamp int64   `json:"timestamp"` // Bar open time in Unix milliseconds
	OpenBid   float64 `json:"open_bid"`
	HighBid   float64 `json:"high_bid"`
	LowBid    float64 `json:"low_bid"`
	CloseBid  float64 `json:"close_bid"`
	OpenAsk   float64 `json:"open_ask"`
	HighAsk   float64 `json:"high_ask"`
	LowAsk    float64 `json:"low_ask"`
	CloseAsk  float64 `json:"close_ask"`
	Volume    int     `json:"volume"` // Tick count
}

// KlineBackfillResponse represents the MT5 backfill API response
type KlineBackfillResponse struct {
	Symbol    string       `json:"symbol"`
	BarsCount int          `json:"bars_count"`
	StartTime int64        `json:"start_time"`
	EndTime   int64        `json:"end_time"`
	Klines    []*KlineData `json:"klines"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status       string                 `json:"status"`
	MT5Connected bool                   `json:"mt5_connected"`
	MT5Version   *string                `json:"mt5_version"`
	TerminalInfo map[string]interface{} `json:"terminal_info"`
}

// ToTime converts Unix milliseconds to time.Time
func (k *KlineData) ToTime() time.Time {
	return time.UnixMilli(k.Timestamp)
}

// NewKlineBackfillRequest creates a request for the given time range
func NewKlineBackfillRequest(symbol string, start, end time.Time) *KlineBackfillRequest {
	return &KlineBackfillRequest{
		Symbol:    symbol,
		StartTime: start.UnixMilli(),
		EndTime:   end.UnixMilli(),
	}
}

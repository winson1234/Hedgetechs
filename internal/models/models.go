package models

// --- Binance Data Structures ---

// BinanceTradeMessage represents the structure of incoming trade messages from Binance WebSocket.
// Ref: https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#trade-streams
type BinanceTradeMessage struct {
	EventType     string `json:"e"` // Event type (e.g., "trade")
	EventTime     int64  `json:"E"` // Event time (timestamp)
	Symbol        string `json:"s"` // Symbol (e.g., "BTCUSDT")
	TradeID       int64  `json:"t"` // Trade ID
	Price         string `json:"p"` // Price
	Quantity      string `json:"q"` // Quantity
	BuyerOrderID  int64  `json:"b"` // Buyer order ID
	SellerOrderID int64  `json:"a"` // Seller order ID
	TradeTime     int64  `json:"T"` // Trade time (timestamp)
	IsMarketMaker bool   `json:"m"` // Is the buyer the market maker?
	Ignore        bool   `json:"M"` // Ignore
}

// --- Local Data Structures ---

// PriceUpdateMessage represents the simplified message sent to frontend clients.
type PriceUpdateMessage struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
	Time   int64  `json:"time"` // Use Binance's trade time
}

// Kline represents a single candlestick data point (OHLCV) from Binance REST API.
// Note: Binance returns this as an array of interfaces/strings. We'll handle parsing in the API layer.
// Example structure: [O_time, Open, High, Low, Close, Volume, C_time, QuoteVol, Trades, TakerBaseVol, TakerQuoteVol, Ignore]

// Kline represents a normalized candlestick returned to clients.
type Kline struct {
	OpenTime         int64  `json:"openTime"`
	Open             string `json:"open"`
	High             string `json:"high"`
	Low              string `json:"low"`
	Close            string `json:"close"`
	Volume           string `json:"volume"`
	CloseTime        int64  `json:"closeTime"`
	QuoteAssetVolume string `json:"quoteAssetVolume"`
	Trades           int64  `json:"trades"`
	TakerBuyBaseVol  string `json:"takerBuyBaseAssetVolume"`
	TakerBuyQuoteVol string `json:"takerBuyQuoteAssetVolume"`
	Ignore           string `json:"ignore"`
}

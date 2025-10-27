package config

// --- Configuration ---

// Binance settings
// Binance combined streams WebSocket URL for multiple symbols
// Format: wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/solusdt@trade/eurusdt@trade
const BinanceWebSocketURL = "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/solusdt@trade/eurusdt@trade"
const BinanceRestURL = "https://api.binance.com/api/v3/klines"
const BinanceTicker24hURL = "https://api.binance.com/api/v3/ticker/24hr"

// Local server settings
const LocalServerAddress = ":8080"     // Address for the backend server
const LocalWebSocketPath = "/ws"       // Path for frontend WebSocket connections
const KlinesAPIPath = "/api/v1/klines" // Path for historical data REST endpoint
const TickerAPIPath = "/api/v1/ticker" // Path for 24h ticker data endpoint

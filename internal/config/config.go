package config

// --- Configuration ---

// Binance settings
const BinanceSymbol = "btcusdt" // Target symbol (lowercase)
const BinanceWebSocketURL = "wss://stream.binance.com:9443/ws/" + BinanceSymbol + "@trade"
const BinanceRestURL = "https://api.binance.com/api/v3/klines"

// Local server settings
const LocalServerAddress = ":8080"      // Address for the backend server
const LocalWebSocketPath = "/ws"        // Path for frontend WebSocket connections
const KlinesAPIPath = "/api/v1/klines" // Path for historical data REST endpoint
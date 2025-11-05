package config

// --- Configuration ---

// Binance settings
// Binance combined streams WebSocket URL for multiple symbols
// Includes: BTC, ETH, SOL, EUR (forex), BNB, ADA, XRP, DOGE, MATIC, DOT, AVAX, LINK, UNI, LTC
const BinanceWebSocketURL = "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/solusdt@trade/eurusdt@trade/bnbusdt@trade/adausdt@trade/xrpusdt@trade/dogeusdt@trade/maticusdt@trade/dotusdt@trade/avaxusdt@trade/linkusdt@trade/uniusdt@trade/ltcusdt@trade"

// Binance order book depth stream URL (use with symbol, e.g., btcusdt@depth20@100ms)
// Includes depth data for primary trading pairs
const BinanceDepthStreamURL = "wss://stream.binance.com:9443/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms/solusdt@depth20@100ms/eurusdt@depth20@100ms/bnbusdt@depth20@100ms/adausdt@depth20@100ms/xrpusdt@depth20@100ms/dogeusdt@depth20@100ms"
const BinanceRestURL = "https://api.binance.com/api/v3/klines"
const BinanceTicker24hURL = "https://api.binance.com/api/v3/ticker/24hr"

// Crypto sources
const CoinDeskRSSURL = "https://www.coindesk.com/arc/outboundfeeds/rss/"
const CryptoNewsRSSURL = "https://cryptonews.com/news/feed/"
const CoinTelegraphRSSURL = "https://cointelegraph.com/rss"

// Forex sources
const FXStreetRSSURL = "https://www.fxstreet.com/rss/news"
const InvestingComForexRSSURL = "https://www.investing.com/rss/news_285.rss"
const YahooFinanceForexRSSURL = "https://finance.yahoo.com/rss/forex"

// Local server settings
const LocalServerAddress = ":8080"                           // Address for the backend server
const LocalWebSocketPath = "/ws"                             // Path for frontend WebSocket connections
const KlinesAPIPath = "/api/v1/klines"                       // Path for historical data REST endpoint
const TickerAPIPath = "/api/v1/ticker"                       // Path for 24h ticker data endpoint
const NewsAPIPath = "/api/v1/news"                           // Path for news feed endpoint
const AnalyticsAPIPath = "/api/v1/analytics"                 // Path for forex rates analytics endpoint (powered by Frankfurter API)
const PaymentIntentAPIPath = "/api/v1/deposit/create-payment-intent" // Path for Stripe payment intent creation
const PaymentStatusAPIPath = "/api/v1/payment/status"        // Path for Stripe payment status check

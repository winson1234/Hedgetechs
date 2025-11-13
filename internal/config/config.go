package config

// --- Configuration ---

// Binance settings
// Binance combined streams WebSocket URL for 26 instruments (24 crypto + 1 forex + 1 commodity)
// Major (7): BTC, ETH, BNB, SOL, XRP, ADA, AVAX
// DeFi/Layer2 (8): MATIC, LINK, UNI, ATOM, DOT, ARB, OP, APT
// Altcoin (9): DOGE, LTC, SHIB, NEAR, ICP, FIL, SUI, STX, TON
// Forex (1): EURUSDT (Euro/Tether proxy)
// Commodity (1): PAXGUSDT (PAX Gold - gold-backed token, 1 PAXG = 1 troy oz of gold)
const BinanceWebSocketURL = "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/bnbusdt@trade/solusdt@trade/xrpusdt@trade/adausdt@trade/avaxusdt@trade/dogeusdt@trade/maticusdt@trade/linkusdt@trade/uniusdt@trade/atomusdt@trade/dotusdt@trade/arbusdt@trade/opusdt@trade/aptusdt@trade/ltcusdt@trade/shibusdt@trade/nearusdt@trade/icpusdt@trade/filusdt@trade/suiusdt@trade/stxusdt@trade/tonusdt@trade/eurusdt@trade/paxgusdt@trade"

// Binance order book depth stream URL for all 26 instruments (20 levels, 100ms update)
// Provides order book data for complete instrument coverage
const BinanceDepthStreamURL = "wss://stream.binance.com:9443/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms/bnbusdt@depth20@100ms/solusdt@depth20@100ms/xrpusdt@depth20@100ms/adausdt@depth20@100ms/avaxusdt@depth20@100ms/dogeusdt@depth20@100ms/maticusdt@depth20@100ms/linkusdt@depth20@100ms/uniusdt@depth20@100ms/atomusdt@depth20@100ms/dotusdt@depth20@100ms/arbusdt@depth20@100ms/opusdt@depth20@100ms/aptusdt@depth20@100ms/ltcusdt@depth20@100ms/shibusdt@depth20@100ms/nearusdt@depth20@100ms/icpusdt@depth20@100ms/filusdt@depth20@100ms/suiusdt@depth20@100ms/stxusdt@depth20@100ms/tonusdt@depth20@100ms/eurusdt@depth20@100ms/paxgusdt@depth20@100ms"
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

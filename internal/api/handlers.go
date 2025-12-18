package api

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub" // Import local hub package
	"brokerageProject/internal/models"
	"brokerageProject/internal/services"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	gocache "github.com/patrickmn/go-cache"
)

// --- WebSocket Upgrader (Specific to API handlers) ---
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development.
		// TODO: Restrict this in production!
		return true
	},
}

// --- WebSocket Handler ---

// HandleWebSocket upgrades HTTP connections to WebSocket and registers the client with the hub.
func HandleWebSocket(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	// Create a hub client with a per-client send channel
	// Increased buffer (1024) to handle high-frequency updates from multiple sources
	// Old messages are automatically dropped when buffer is full to keep latest data
	client := &hub.Client{
		Conn: conn,
		Send: make(chan []byte, 1024), // Increased to handle multiple high-frequency data sources
	}

	// Register the new client with the hub
	h.Register <- client
	log.Println("Client connection upgraded to WebSocket")

	// Start writePump: dedicated goroutine to write messages to this client
	go func(c *hub.Client) {
		// Ensure client is unregistered when this goroutine exits
		defer func() {
			h.Unregister <- c
		}()

		// Send ping every 30 seconds to keep connection alive
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		// Track consecutive write failures to detect slow/unresponsive clients
		consecutiveFailures := 0
		maxFailures := 5

		for {
			select {
			case msg, ok := <-c.Send:
				if !ok {
					// Channel closed, exit gracefully
					c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}

				// Set write deadline to avoid blocking forever (reduced from 10s to 5s for faster failure detection)
				c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					// Don't log normal connection closures
					if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
						consecutiveFailures++
						if consecutiveFailures >= maxFailures {
							log.Printf("Client write failed %d times consecutively, disconnecting: %v", consecutiveFailures, err)
							return
						}
						log.Printf("Error writing to client (failure %d/%d): %v", consecutiveFailures, maxFailures, err)
					} else {
						return
					}
				} else {
					// Reset failure counter on successful write
					consecutiveFailures = 0
				}

			case <-ticker.C:
				// Send ping to keep connection alive
				c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}(client)

	// Goroutine to handle client disconnection (reads are mainly for detecting closure)
	go func(c *hub.Client) {
		defer func() {
			h.Unregister <- c // Ensure unregistration on exit/error
		}()

		// Set up pong handler to respond to pings from client
		c.Conn.SetPongHandler(func(string) error {
			c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		// Set initial read deadline
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		for {
			// Read messages (optional, needed to detect close and pings)
			_, _, err := c.Conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
					log.Printf("Client read error: %v", err)
				}
				// Don't log normal disconnections
				break // Exit loop on error/disconnection
			}
			// Process incoming client message here if needed in the future
			// log.Printf("Received message from client: %s", msg)
		}
	}(client)
}

// In-memory cache for klines
var klineCache = gocache.New(1*time.Minute, 10*time.Minute)

// binanceRestBase is the base URL used to build Binance REST klines requests.
// It defaults to the value in config but is a variable so tests can override it.
var binanceRestBase = config.BinanceRestURL

// --- REST API Handler ---

// HandleKlines proxies historical klines (OHLCV) requests to Binance REST API.
// Example: GET /api/v1/klines?symbol=BTCUSDT&interval=1h&limit=500
func HandleKlines(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Extract and validate 'symbol'
	symbol := strings.ToUpper(q.Get("symbol"))
	if symbol == "" {
		http.Error(w, "Query parameter 'symbol' is required", http.StatusBadRequest)
		return
	}

	// Extract and validate 'interval' (default to "1h")
	interval := q.Get("interval")
	if interval == "" {
		interval = "1h" // Default interval
	}
	// TODO: Add validation for allowed Binance intervals (1m, 3m, 5m, 1h, 4h, 1d, etc.)

	// Extract and validate 'limit' (default to 500, max 1000)
	limitStr := q.Get("limit")
	if limitStr == "" {
		limitStr = "500" // Default limit
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		http.Error(w, "Query parameter 'limit' must be a positive integer", http.StatusBadRequest)
		return
	}
	if limit > 1000 { // Binance API max limit
		limit = 1000
		limitStr = "1000"
	} else {
		limitStr = strconv.Itoa(limit) // Use validated limit as string
	}

	// Build cache key and check cache first
	cacheKey := fmt.Sprintf("kline-%s-%s-%s", symbol, interval, limitStr)
	if cached, found := klineCache.Get(cacheKey); found {
		if klinesCached, ok := cached.([]models.Kline); ok {
			out, err := json.Marshal(klinesCached)
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				// Indicate this was served from cache
				w.Header().Set("X-Cache", "HIT")
				w.WriteHeader(http.StatusOK)
				if _, err := w.Write(out); err != nil {
					log.Printf("Error writing cached response to client: %v", err)
				}
				return
			}
			// Fall through to fetch if marshal fails
			log.Printf("Failed to marshal cached klines: %v", err)
		}
	}

	// Check if symbol is not available on Binance (forex instruments from TwelveData)
	nonBinanceSymbols := map[string]bool{
		"CADJPY": true,
		"AUDNZD": true,
		"EURGBP": true,
	}

	// For non-Binance symbols, return empty array (no historical data available yet)
	if nonBinanceSymbols[symbol] {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]")) // Return empty klines array
		return
	}

	// Build Binance REST API URL (uses binanceRestBase so tests can override)
	u, err := url.Parse(binanceRestBase)
	if err != nil {
		log.Printf("Error parsing Binance base URL: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	params := url.Values{}
	params.Set("symbol", symbol)
	params.Set("interval", interval)
	params.Set("limit", limitStr)
	u.RawQuery = params.Encode()
	binanceURL := u.String()

	log.Printf("Fetching klines from Binance: %s", binanceURL)

	// Make the request to Binance
	resp, err := http.Get(binanceURL)
	if err != nil {
		log.Printf("Error fetching klines from Binance API: %v", err)
		http.Error(w, "Failed to fetch data from upstream provider", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Check Binance response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body) // Read body for logging
		log.Printf("Binance API returned non-OK status %d: %s", resp.StatusCode, string(bodyBytes))
		http.Error(w, fmt.Sprintf("Upstream provider returned status %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	// Read the upstream response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Binance response body: %v", err)
		http.Error(w, "Failed to read upstream response", http.StatusBadGateway)
		return
	}

	// Binance returns an array of arrays. Unmarshal into [][]interface{} then convert to []models.Kline
	var raw [][]interface{}
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		log.Printf("Error unmarshalling Binance klines response: %v", err)
		http.Error(w, "Failed to parse upstream response", http.StatusBadGateway)
		return
	}

	// Helper converters
	toStr := func(i interface{}) string {
		switch v := i.(type) {
		case string:
			return v
		case float64:
			return strconv.FormatFloat(v, 'f', -1, 64)
		default:
			return ""
		}
	}
	toInt64 := func(i interface{}) int64 {
		switch v := i.(type) {
		case float64:
			return int64(v)
		case string:
			if v == "" {
				return 0
			}
			// try parse as integer string
			if iv, err := strconv.ParseInt(v, 10, 64); err == nil {
				return iv
			}
			// try parse as float then cast
			if fv, err := strconv.ParseFloat(v, 64); err == nil {
				return int64(fv)
			}
			return 0
		default:
			return 0
		}
	}

	var klines []models.Kline
	for _, arr := range raw {
		// Expect at least 11 elements per Binance doc
		if len(arr) < 11 {
			continue
		}
		k := models.Kline{
			OpenTime:         toInt64(arr[0]),
			Open:             toStr(arr[1]),
			High:             toStr(arr[2]),
			Low:              toStr(arr[3]),
			Close:            toStr(arr[4]),
			Volume:           toStr(arr[5]),
			CloseTime:        toInt64(arr[6]),
			QuoteAssetVolume: toStr(arr[7]),
			Trades:           toInt64(arr[8]),
			TakerBuyBaseVol:  toStr(arr[9]),
			TakerBuyQuoteVol: toStr(arr[10]),
			Ignore:           "",
		}
		// If there is a 12th element, set Ignore as string
		if len(arr) > 11 {
			k.Ignore = toStr(arr[11])
		}
		klines = append(klines, k)
	}

	// Cache the normalized klines for subsequent requests
	klineCache.Set(cacheKey, klines, gocache.DefaultExpiration)

	// Marshal and return the normalized klines
	out, err := json.Marshal(klines)
	if err != nil {
		log.Printf("Error marshalling normalized klines: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	// Mark this response as a cache MISS since we just fetched and stored it
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(out); err != nil {
		log.Printf("Error writing response to client: %v", err)
	}
}

// In-memory cache for ticker data
var tickerCache = gocache.New(10*time.Second, 30*time.Second)

// HandleTicker fetches 24h ticker statistics from Binance API
// Example: GET /api/v1/ticker?symbols=BTCUSDT,ETHUSDT,SOLUSDT
func HandleTicker(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Extract symbols parameter (comma-separated)
	symbolsParam := q.Get("symbols")
	if symbolsParam == "" {
		http.Error(w, "Query parameter 'symbols' is required", http.StatusBadRequest)
		return
	}

	// Build cache key
	cacheKey := fmt.Sprintf("ticker-%s", symbolsParam)

	// Check cache first
	if cached, found := tickerCache.Get(cacheKey); found {
		if tickersCached, ok := cached.([]models.TickerResponse); ok {
			out, err := json.Marshal(tickersCached)
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache", "HIT")
				w.WriteHeader(http.StatusOK)
				if _, err := w.Write(out); err != nil {
					log.Printf("Error writing cached ticker response: %v", err)
				}
				return
			}
			log.Printf("Failed to marshal cached tickers: %v", err)
		}
	}

	// Separate symbols into Binance-supported and non-Binance symbols
	nonBinanceSymbols := map[string]bool{
		"CADJPY": true,
		"AUDNZD": true,
		"EURGBP": true,
	}

	requestedSymbols := strings.Split(symbolsParam, ",")
	var binanceSymbols []string
	binanceSymbolsMap := make(map[string]bool) // For quick lookup
	var nonBinanceList []string

	for _, sym := range requestedSymbols {
		sym = strings.TrimSpace(sym)
		if sym == "" {
			continue
		}
		if nonBinanceSymbols[sym] {
			nonBinanceList = append(nonBinanceList, sym)
		} else {
			binanceSymbols = append(binanceSymbols, sym)
			binanceSymbolsMap[sym] = true
		}
	}

	var tickers []models.TickerResponse

	// Fetch from Binance only for supported symbols
	if len(binanceSymbols) > 0 {
		// Strategy: For large symbol lists (>10), fetch ALL tickers and filter
		// For small lists, use the symbols parameter
		var binanceURL string

		if len(binanceSymbols) > 10 {
			// Fetch all tickers (no symbols parameter) - more efficient for large lists
			binanceURL = config.BinanceTicker24hURL
			log.Printf("Fetching ALL tickers from Binance (filtering %d symbols)", len(binanceSymbols))
		} else {
			// Use symbols parameter for small lists
			symbolsJSON := "[\"" + strings.Join(binanceSymbols, "\",\"") + "\"]"
			u, err := url.Parse(config.BinanceTicker24hURL)
			if err != nil {
				log.Printf("Error parsing Binance ticker URL: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			q := u.Query()
			q.Set("symbols", symbolsJSON)
			u.RawQuery = q.Encode()
			binanceURL = u.String()
			log.Printf("Fetching tickers from Binance: %s", binanceURL)
		}

		// Retry logic for network errors
		var resp *http.Response
		var err error
		maxRetries := 3

		for attempt := 1; attempt <= maxRetries; attempt++ {
			resp, err = http.Get(binanceURL)
			if err == nil {
				break // Success
			}

			// Log retry attempt
			if attempt < maxRetries {
				log.Printf("Binance API request failed (attempt %d/%d): %v. Retrying...", attempt, maxRetries, err)
				time.Sleep(time.Duration(attempt) * 500 * time.Millisecond) // Exponential backoff: 500ms, 1s, 1.5s
			}
		}

		if err != nil {
			log.Printf("Error fetching tickers from Binance API after %d attempts: %v", maxRetries, err)
			http.Error(w, "Failed to fetch data from upstream provider", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		// Check Binance response status
		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			log.Printf("Binance API returned non-OK status %d: %s", resp.StatusCode, string(bodyBytes))
			http.Error(w, fmt.Sprintf("Upstream provider returned status %d", resp.StatusCode), http.StatusBadGateway)
			return
		}

		// Read and parse Binance response
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("Error reading Binance response: %v", err)
			http.Error(w, "Failed to read upstream response", http.StatusBadGateway)
			return
		}

		// Unmarshal into Binance24hTicker format first
		var binanceTickers []models.Binance24hTicker
		if err := json.Unmarshal(bodyBytes, &binanceTickers); err != nil {
			log.Printf("Error unmarshalling Binance tickers response: %v", err)
			http.Error(w, "Failed to parse upstream response", http.StatusBadGateway)
			return
		}

		// Transform to TickerResponse format and filter to requested symbols
		for _, bt := range binanceTickers {
			// Only include if it was requested
			if binanceSymbolsMap[bt.Symbol] {
				tickers = append(tickers, models.TickerResponse{
					Symbol:             bt.Symbol,
					LastPrice:          bt.LastPrice,
					PriceChangePercent: bt.PriceChangePercent,
					HighPrice:          bt.HighPrice,
					LowPrice:           bt.LowPrice,
					Volume:             bt.QuoteVolume, // Use quoteVolume (USDT volume)
				})
			}
		}

		log.Printf("Filtered %d tickers from Binance response", len(tickers))
	}

	// Add tickers for non-Binance symbols using price cache
	priceCache := services.GetGlobalPriceCache()
	for _, sym := range nonBinanceList {
		price, err := priceCache.GetPrice(sym)
		priceStr := "0"
		if err == nil && price > 0 {
			priceStr = fmt.Sprintf("%.5f", price)
		}

		tickers = append(tickers, models.TickerResponse{
			Symbol:             sym,
			LastPrice:          priceStr,
			PriceChangePercent: "0.00", // TwelveData free tier doesn't provide 24h stats
			HighPrice:          "0",
			LowPrice:           "0",
			Volume:             "0",
		})
	}

	// Cache the result
	tickerCache.Set(cacheKey, tickers, gocache.DefaultExpiration)

	// Marshal and return
	out, err := json.Marshal(tickers)
	if err != nil {
		log.Printf("Error marshalling ticker response: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(out); err != nil {
		log.Printf("Error writing ticker response to client: %v", err)
	}
}

// --- News Cache ---
var newsCache = gocache.New(2*time.Minute, 5*time.Minute)

// RSS Feed Structures for Yahoo Finance
type rssChannel struct {
	Title string    `xml:"title"`
	Items []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
	GUID        string `xml:"guid"`
}

type rssFeed struct {
	Channel rssChannel `xml:"channel"`
}

// HandleNews fetches and caches news from Yahoo Finance RSS feed
func HandleNews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Add CORS headers for frontend
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET")

	// Check cache first
	cacheKey := "yahoo-finance-news"
	if cached, found := newsCache.Get(cacheKey); found {
		if articles, ok := cached.([]models.NewsArticle); ok {
			// Return cached data
			response := models.NewsResponse{
				Articles: articles,
				Count:    len(articles),
			}
			out, err := json.Marshal(response)
			if err != nil {
				log.Printf("Error marshalling cached news response: %v", err)
				http.Error(w, "Failed to generate response", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.WriteHeader(http.StatusOK)
			w.Write(out)
			return
		}
	}

	// Try multiple RSS feed sources and combine results from all successful sources
	feedURLs := []struct {
		url    string
		source string
	}{
		{config.CoinDeskRSSURL, "CoinDesk"},
		{config.CryptoNewsRSSURL, "CryptoNews"},
		{config.CoinTelegraphRSSURL, "CoinTelegraph"},
		// {config.FXStreetRSSURL, "FXStreet"},
		// {config.InvestingComForexRSSURL, "Investing.com"},
		{config.YahooFinanceForexRSSURL, "Yahoo Finance"},
	}

	var allArticles []models.NewsArticle
	successCount := 0

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Try each feed URL and collect all successful results
	for _, feedInfo := range feedURLs {
		req, err := http.NewRequest("GET", feedInfo.url, nil)
		if err != nil {
			log.Printf("Error creating request for %s RSS: %v", feedInfo.source, err)
			continue
		}

		// Add headers to mimic a browser request
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, */*")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Error fetching %s RSS: %v", feedInfo.source, err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			log.Printf("%s RSS returned status %d", feedInfo.source, resp.StatusCode)
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			maxLen := 500
			if len(bodyBytes) < maxLen {
				maxLen = len(bodyBytes)
			}
			log.Printf("Response body: %s", string(bodyBytes[:maxLen]))
			continue
		}

		// Read response body
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("Error reading %s RSS response: %v", feedInfo.source, err)
			continue
		}

		// Try to parse RSS XML
		var feed rssFeed
		if err := parseXML(body, &feed); err != nil {
			log.Printf("Error parsing %s RSS XML: %v", feedInfo.source, err)
			continue
		}

		// Success! Convert and add articles from this source
		log.Printf("Successfully fetched news from %s (%d articles)", feedInfo.source, len(feed.Channel.Items))
		successCount++

		for _, item := range feed.Channel.Items {
			// Parse pubDate - RSS feeds use various date formats
			// Try multiple formats in order of commonality
			dateStr := strings.TrimSpace(item.PubDate)

			// List of common RSS date formats
			dateFormats := []string{
				time.RFC1123Z,                    // "Mon, 02 Jan 2006 15:04:05 -0700"
				time.RFC1123,                     // "Mon, 02 Jan 2006 15:04:05 MST"
				"Mon, 02 Jan 2006 15:04:05 Z",    // RFC1123 with Z timezone and space
				time.RFC3339,                     // "2006-01-02T15:04:05Z07:00" (ISO8601)
				"2006-01-02T15:04:05Z",           // ISO8601 with Z
				"2006-01-02 15:04:05",            // Simple datetime format (YYYY-MM-DD HH:MM:SS)
				"Mon, 2 Jan 2006 15:04:05 MST",   // RFC1123 with single-digit day
				"Mon, 2 Jan 2006 15:04:05 Z",     // RFC1123 with single-digit day and Z timezone
				"Mon, 2 Jan 2006 15:04:05 -0700", // RFC1123Z with single-digit day
				"2 Jan 2006 15:04:05 MST",        // Without weekday
				"2 Jan 2006 15:04:05 -0700",      // Without weekday, with timezone offset
			}

			// Try each format
			var pubDate time.Time
			var err error
			for _, format := range dateFormats {
				pubDate, err = time.Parse(format, dateStr)
				if err == nil {
					break // Successfully parsed
				}
			}

			// If all formats fail, log and use current time as fallback
			if err != nil {
				log.Printf("Warning: Could not parse pubDate '%s' with any known format. Using current time as fallback.", item.PubDate)
				pubDate = time.Now()
			}

			allArticles = append(allArticles, models.NewsArticle{
				Title:       item.Title,
				Link:        item.Link,
				Description: stripHTMLTags(item.Description),
				PubDate:     pubDate,
				Source:      feedInfo.source,
				GUID:        item.GUID,
			})
		}
	}

	// If all sources failed, return error
	if successCount == 0 {
		log.Printf("All news feed sources failed")
		http.Error(w, "Failed to fetch news from all sources", http.StatusBadGateway)
		return
	}

	log.Printf("Combined news from %d sources: total %d articles", successCount, len(allArticles))

	// Sort articles by publication date (newest first)
	sort.Slice(allArticles, func(i, j int) bool {
		return allArticles[i].PubDate.After(allArticles[j].PubDate)
	})

	// Cache the result
	newsCache.Set(cacheKey, allArticles, gocache.DefaultExpiration)

	// Return response
	response := models.NewsResponse{
		Articles: allArticles,
		Count:    len(allArticles),
	}
	out, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshalling news response: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	w.Write(out)
}

// parseXML parses XML data using encoding/xml from stdlib
func parseXML(data []byte, v interface{}) error {
	return xml.Unmarshal(data, v)
}

// stripHTMLTags removes HTML tags from description
func stripHTMLTags(s string) string {
	// Simple HTML tag removal - replace common tags
	s = strings.ReplaceAll(s, "<p>", "")
	s = strings.ReplaceAll(s, "</p>", " ")
	s = strings.ReplaceAll(s, "<br>", " ")
	s = strings.ReplaceAll(s, "<br/>", " ")
	s = strings.ReplaceAll(s, "<br />", " ")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	// Remove any remaining tags
	for strings.Contains(s, "<") && strings.Contains(s, ">") {
		start := strings.Index(s, "<")
		end := strings.Index(s, ">")
		if start < end {
			s = s[:start] + s[end+1:]
		} else {
			break
		}
	}
	return strings.TrimSpace(s)
}

// --- Configuration Endpoints ---

// HandleConfigCurrencies returns the list of supported fiat currencies
// GET /api/v1/config/currencies
func HandleConfigCurrencies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currencies := []string{"USD", "EUR", "MYR", "JPY"}

	response := map[string]interface{}{
		"currencies": currencies,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// ProductType represents a tradable product type configuration
type ProductType struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

// HandleConfigProductTypes returns the list of supported product types
// GET /api/v1/config/product-types
func HandleConfigProductTypes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	productTypes := []ProductType{
		{
			Value:       "spot",
			Label:       "Spot",
			Description: "Trade assets at current market prices",
		},
		{
			Value:       "cfd",
			Label:       "CFD",
			Description: "Contracts for Difference trading",
		},
		{
			Value:       "futures",
			Label:       "Futures",
			Description: "Futures contracts trading",
		},
	}

	response := map[string]interface{}{
		"product_types": productTypes,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// Instrument represents a tradable instrument with metadata
type Instrument struct {
	Symbol       string `json:"symbol"`
	DisplayName  string `json:"displayName"`
	BaseCurrency string `json:"baseCurrency"`
	Category     string `json:"category"` // "major", "defi", "altcoin"
	IconUrl      string `json:"iconUrl"`  // CoinGecko image URL
}

// HandleInstruments returns the list of supported trading instruments
// GET /api/v1/instruments
func HandleInstruments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	instruments := []Instrument{
		// Major (7)
		{Symbol: "BTCUSDT", DisplayName: "BTC/USD", BaseCurrency: "BTC", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png"},
		{Symbol: "ETHUSDT", DisplayName: "ETH/USD", BaseCurrency: "ETH", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"},
		{Symbol: "BNBUSDT", DisplayName: "BNB/USD", BaseCurrency: "BNB", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png"},
		{Symbol: "SOLUSDT", DisplayName: "SOL/USD", BaseCurrency: "SOL", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/4128/small/solana.png"},
		{Symbol: "XRPUSDT", DisplayName: "XRP/USD", BaseCurrency: "XRP", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png"},
		{Symbol: "ADAUSDT", DisplayName: "ADA/USD", BaseCurrency: "ADA", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/975/small/cardano.png"},
		{Symbol: "AVAXUSDT", DisplayName: "AVAX/USD", BaseCurrency: "AVAX", Category: "major", IconUrl: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png"},

		// DeFi/Layer2 (8)
		{Symbol: "MATICUSDT", DisplayName: "MATIC/USD", BaseCurrency: "MATIC", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png"},
		{Symbol: "LINKUSDT", DisplayName: "LINK/USD", BaseCurrency: "LINK", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png"},
		{Symbol: "UNIUSDT", DisplayName: "UNI/USD", BaseCurrency: "UNI", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg"},
		{Symbol: "ATOMUSDT", DisplayName: "ATOM/USD", BaseCurrency: "ATOM", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png"},
		{Symbol: "DOTUSDT", DisplayName: "DOT/USD", BaseCurrency: "DOT", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png"},
		{Symbol: "ARBUSDT", DisplayName: "ARB/USD", BaseCurrency: "ARB", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg"},
		{Symbol: "OPUSDT", DisplayName: "OP/USD", BaseCurrency: "OP", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png"},
		{Symbol: "APTUSDT", DisplayName: "APT/USD", BaseCurrency: "APT", Category: "defi", IconUrl: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png"},

		// Altcoin (9)
		{Symbol: "DOGEUSDT", DisplayName: "DOGE/USD", BaseCurrency: "DOGE", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png"},
		{Symbol: "LTCUSDT", DisplayName: "LTC/USD", BaseCurrency: "LTC", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/2/small/litecoin.png"},
		{Symbol: "SHIBUSDT", DisplayName: "SHIB/USD", BaseCurrency: "SHIB", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/11939/small/shiba.png"},
		{Symbol: "NEARUSDT", DisplayName: "NEAR/USD", BaseCurrency: "NEAR", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/10365/small/near.jpg"},
		{Symbol: "ICPUSDT", DisplayName: "ICP/USD", BaseCurrency: "ICP", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png"},
		{Symbol: "FILUSDT", DisplayName: "FIL/USD", BaseCurrency: "FIL", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png"},
		{Symbol: "SUIUSDT", DisplayName: "SUI/USD", BaseCurrency: "SUI", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg"},
		{Symbol: "STXUSDT", DisplayName: "STX/USD", BaseCurrency: "STX", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png"},
		{Symbol: "TONUSDT", DisplayName: "TON/USD", BaseCurrency: "TON", Category: "altcoin", IconUrl: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png"},
	}

	response := map[string]interface{}{
		"instruments": instruments,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

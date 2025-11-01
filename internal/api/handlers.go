package api

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub" // Import local hub package
	"brokerageProject/internal/models"
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
	client := &hub.Client{
		Conn: conn,
		Send: make(chan []byte, 64), // per-client buffer
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
		for msg := range c.Send {
			// Set write deadline to avoid blocking forever
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("Error writing to client: %v", err)
				return
			}
		}
	}(client)

	// Goroutine to handle client disconnection (reads are mainly for detecting closure)
	go func(c *hub.Client) {
		defer func() {
			h.Unregister <- c // Ensure unregistration on exit/error
		}()
		for {
			// Read messages (optional, needed to detect close)
			_, _, err := c.Conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Client read error: %v", err)
				} else {
					log.Println("Client disconnected normally")
				}
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

	// Build Binance API URL
	binanceURL := fmt.Sprintf("%s?symbols=[\"%s\"]", config.BinanceTicker24hURL,
		strings.ReplaceAll(symbolsParam, ",", "\",\""))

	log.Printf("Fetching tickers from Binance: %s", binanceURL)

	// Make the request to Binance
	resp, err := http.Get(binanceURL)
	if err != nil {
		log.Printf("Error fetching tickers from Binance API: %v", err)
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

	// Read and parse response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Binance ticker response body: %v", err)
		http.Error(w, "Failed to read upstream response", http.StatusBadGateway)
		return
	}

	var binanceTickers []models.Binance24hTicker
	if err := json.Unmarshal(bodyBytes, &binanceTickers); err != nil {
		log.Printf("Error unmarshalling Binance ticker response: %v", err)
		http.Error(w, "Failed to parse upstream response", http.StatusBadGateway)
		return
	}

	// Convert to simplified response format
	var tickers []models.TickerResponse
	for _, bt := range binanceTickers {
		tickers = append(tickers, models.TickerResponse{
			Symbol:             bt.Symbol,
			LastPrice:          bt.LastPrice,
			PriceChangePercent: bt.PriceChangePercent,
			HighPrice:          bt.HighPrice,
			LowPrice:           bt.LowPrice,
			Volume:             bt.Volume,
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
		{config.FXStreetRSSURL, "FXStreet"},
		{config.InvestingComForexRSSURL, "Investing.com"},
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
			// Parse pubDate (RFC1123 format: "Mon, 02 Jan 2006 15:04:05 MST")
			// Handle "Z" timezone by replacing with "+0000"
			dateStr := strings.Replace(item.PubDate, " Z", " +0000", 1)

			pubDate, err := time.Parse(time.RFC1123, dateStr)
			if err != nil {
				// Try RFC1123Z if RFC1123 fails
				pubDate, err = time.Parse(time.RFC1123Z, dateStr)
				if err != nil {
					log.Printf("Error parsing pubDate '%s': %v. Check the output from backend.", item.PubDate, err)
					pubDate = time.Now() // fallback to current time
				}
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

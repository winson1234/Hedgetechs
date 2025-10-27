package api

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub" // Import local hub package
	"brokerageProject/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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

package twelvedata

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Client manages persistent WebSocket connection to Twelve Data
type Client struct {
	apiKey    string
	conn      *websocket.Conn
	onTick    func(symbol string, price float64) // Callback invoked for each price update
	mu        sync.Mutex                         // Protects conn during reconnection
	isRunning bool
	stopChan  chan struct{}
}

// SubscribeMsg is sent to subscribe to symbols after connection
type SubscribeMsg struct {
	Action string `json:"action"`
	Params Params `json:"params"`
}

// Params contains the symbols to subscribe to
type Params struct {
	Symbols string `json:"symbols"`
}

// PriceUpdate represents incoming price data from Twelve Data
type PriceUpdate struct {
	Event  string  `json:"event"`
	Symbol string  `json:"symbol"`
	Price  float64 `json:"price"`
	Type   string  `json:"type"` // "price" or "heartbeat"
}

// NewClient creates a new Twelve Data WebSocket client
// onTick callback is invoked whenever a price update is received
func NewClient(apiKey string, onTick func(string, float64)) *Client {
	return &Client{
		apiKey:   apiKey,
		onTick:   onTick,
		stopChan: make(chan struct{}),
	}
}

// Start initiates the WebSocket connection and begins listening for price updates
func (c *Client) Start() {
	c.isRunning = true
	go c.connect()
}

// Stop gracefully shuts down the WebSocket connection
func (c *Client) Stop() {
	c.isRunning = false
	close(c.stopChan)
	c.mu.Lock()
	if c.conn != nil {
		c.conn.Close()
	}
	c.mu.Unlock()
}

// connect establishes WebSocket connection with auto-reconnect on failure
func (c *Client) connect() {
	for c.isRunning {
		url := "wss://ws.twelvedata.com/v1/quotes/price?apikey=" + c.apiKey
		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Printf("[TwelveData] Connection failed: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[TwelveData] Connected successfully")
		c.mu.Lock()
		c.conn = conn
		c.mu.Unlock()

		// Subscribe to all 6 symbols immediately after connecting
		if err := c.subscribe(); err != nil {
			log.Printf("[TwelveData] Subscription failed: %v. Reconnecting...", err)
			conn.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("[TwelveData] Subscribed to WTI/USD, BZ/USD, NG/USD, CAD/JPY, AUD/NZD, EUR/GBP")

		// Start reading messages (blocks until connection drops)
		c.readLoop()

		// If we reach here, connection was lost
		log.Println("[TwelveData] Connection lost. Reconnecting in 5s...")
		time.Sleep(5 * time.Second)
	}
}

// subscribe sends the subscription message for all 6 symbols
func (c *Client) subscribe() error {
	msg := SubscribeMsg{
		Action: "subscribe",
		Params: Params{
			Symbols: "WTI/USD,BZ/USD,NG/USD,CAD/JPY,AUD/NZD,EUR/GBP",
		},
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return nil
	}

	return c.conn.WriteJSON(msg)
}

// readLoop continuously reads messages from WebSocket until error or stop signal
func (c *Client) readLoop() {
	defer func() {
		c.mu.Lock()
		if c.conn != nil {
			c.conn.Close()
		}
		c.mu.Unlock()
	}()

	for {
		select {
		case <-c.stopChan:
			return
		default:
		}

		c.mu.Lock()
		conn := c.conn
		c.mu.Unlock()

		if conn == nil {
			return
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[TwelveData] Read error: %v", err)
			return
		}

		var update PriceUpdate
		if err := json.Unmarshal(message, &update); err != nil {
			// Skip malformed messages
			continue
		}

		// Only process actual price updates (ignore heartbeats)
		if update.Event == "price" && update.Price > 0 {
			internalSymbol := mapSymbolToInternal(update.Symbol)
			log.Printf("[TwelveData] Price Update: %s = %.5f", internalSymbol, update.Price)
			c.onTick(internalSymbol, update.Price)
		}
	}
}

// mapSymbolToInternal converts Twelve Data symbols to internal format
// WTI/USD -> WTI
// BZ/USD -> BRENT
// NG/USD -> NATGAS
// CAD/JPY -> CADJPY
// AUD/NZD -> AUDNZD
// EUR/GBP -> EURGBP
func mapSymbolToInternal(tdSymbol string) string {
	switch tdSymbol {
	case "WTI/USD":
		return "WTI"
	case "BZ/USD":
		return "BRENT"
	case "NG/USD":
		return "NATGAS"
	default:
		// For forex pairs, just remove the slash
		return strings.ReplaceAll(tdSymbol, "/", "")
	}
}

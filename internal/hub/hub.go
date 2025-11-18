package hub

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// Hub manages the set of active clients and broadcasts messages to them.
type Hub struct {
	// clients map now holds Client pointers which contain the websocket.Conn and a per-client send channel.
	clients    map[*Client]bool // Registered clients.
	Broadcast  chan []byte      // Inbound messages (from Binance client). Public for binance client to send to.
	Register   chan *Client     // Register requests from clients.
	Unregister chan *Client     // Unregister requests from clients.
	mu         sync.Mutex       // Mutex to protect concurrent access to clients map
}

// Client represents a single WebSocket connection and a buffered channel for outbound messages.
type Client struct {
	Conn *websocket.Conn
	Send chan []byte
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		// Buffered broadcast channel to absorb bursts of high-frequency trading data
		// Increased to 8192 to handle 24 concurrent instruments (~340 msg/sec peak)
		Broadcast:  make(chan []byte, 8192),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// BroadcastMessage sends a message to all connected clients via the Broadcast channel
// This method provides a cleaner interface for sending messages from other packages
func (h *Hub) BroadcastMessage(message []byte) {
	select {
	case h.Broadcast <- message:
		// Successfully queued for broadcast
	default:
		log.Printf("WARNING: Broadcast channel full, dropping message")
	}
}

// Run starts the hub's message processing loops.
func (h *Hub) Run() {
	log.Println("Hub started")
	for {
		select {
		case client := <-h.Register:
			// Safely add client to the map
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println("Client registered to hub")
		case client := <-h.Unregister:
			// Safely remove client from the map
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				// Close the client's send channel to signal its writePump to exit
				close(client.Send)
				// Close the websocket connection
				client.Conn.Close()
				log.Println("Client unregistered from hub")
			}
			h.mu.Unlock()
		case message := <-h.Broadcast:
			// Safely iterate over clients and send message
			h.mu.Lock()
			for client := range h.clients {
				// Non-blocking send to the client's buffer. If the client's buffer is full, skip and log.
				select {
				case client.Send <- message:
					// enqueued
				default:
					bufferCap := cap(client.Send)
					bufferLen := len(client.Send)
					log.Printf("WARNING: Client send buffer full (%d/%d messages), dropping message for client %s", bufferLen, bufferCap, client.Conn.RemoteAddr())
					// do not unregister here; client writePump will detect issues and unregister if needed
				}
			}
			h.mu.Unlock() // Unlock before potentially lengthy unregister operations
		}
	}
}

// SubscribeToRedisForex subscribes to Redis forex price updates and broadcasts to WebSocket clients
// Rate-limited to max 2 broadcasts per second per symbol to prevent flooding
func (h *Hub) SubscribeToRedisForex(ctx context.Context, redisClient *redis.Client) {
	log.Println("[Hub] Starting Redis forex price subscription...")

	// Subscribe to Redis Pub/Sub channel
	pubsub := redisClient.Subscribe(ctx, "fx_price_updates")
	defer pubsub.Close()

	// Verify subscription
	_, err := pubsub.Receive(ctx)
	if err != nil {
		log.Printf("[Hub] ERROR: Failed to subscribe to Redis channel: %v", err)
		return
	}
	log.Println("[Hub] Successfully subscribed to fx_price_updates channel")

	// Rate limiter: Track last broadcast time per symbol (max 2/sec = 500ms interval)
	lastBroadcast := make(map[string]time.Time)
	var rateMu sync.Mutex
	const minInterval = 500 * time.Millisecond

	// Listen for messages
	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			log.Println("[Hub] Redis subscription shutting down...")
			return
		case msg := <-ch:
			// Parse incoming message
			var tick struct {
				Symbol    string  `json:"symbol"`
				Bid       float64 `json:"bid"`
				Ask       float64 `json:"ask"`
				Timestamp int64   `json:"timestamp"`
			}

			if err := json.Unmarshal([]byte(msg.Payload), &tick); err != nil {
				log.Printf("[Hub] ERROR parsing Redis message: %v", err)
				continue
			}

			// Rate limiting check
			rateMu.Lock()
			lastTime, exists := lastBroadcast[tick.Symbol]
			now := time.Now()
			if exists && now.Sub(lastTime) < minInterval {
				rateMu.Unlock()
				// Skip this update (too soon since last broadcast)
				continue
			}
			lastBroadcast[tick.Symbol] = now
			rateMu.Unlock()

			// Build WebSocket message
			wsMessage := map[string]interface{}{
				"type":      "forex_quote",
				"symbol":    tick.Symbol,
				"bid":       tick.Bid,
				"ask":       tick.Ask,
				"timestamp": tick.Timestamp,
			}

			wsJSON, err := json.Marshal(wsMessage)
			if err != nil {
				log.Printf("[Hub] ERROR marshalling WebSocket message: %v", err)
				continue
			}

			// Broadcast to all connected WebSocket clients (non-blocking)
			select {
			case h.Broadcast <- wsJSON:
				// Successfully queued for broadcast
			default:
				log.Printf("[Hub] WARNING: Broadcast channel full, dropping forex quote for %s", tick.Symbol)
			}
		}
	}
}

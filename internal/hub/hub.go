package hub

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
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
		// Buffered broadcast channel to absorb short bursts when clients are slow or absent
		Broadcast:  make(chan []byte, 256),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
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
					log.Printf("Client send buffer full, skipping client")
					// do not unregister here; client writePump will detect issues and unregister if needed
				}
			}
			h.mu.Unlock() // Unlock before potentially lengthy unregister operations
		}
	}
}

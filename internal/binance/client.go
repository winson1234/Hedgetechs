package binance

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub" // Import local hub package
	"brokerageProject/internal/models"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

// StreamTrades connects to the Binance WebSocket trade stream and forwards price updates to the provided hub.
func StreamTrades(h *hub.Hub) {
	// Exponential backoff parameters
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		// Attempt to connect
		conn, _, err := websocket.DefaultDialer.Dial(config.BinanceWebSocketURL, nil)
		if err != nil {
			log.Printf("Binance dial error: %v. Reconnecting in %s", err, backoff)
			time.Sleep(backoff)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		// Connected successfully
		log.Println("Connected to Binance WebSocket:", config.BinanceWebSocketURL)
		// Reset backoff after successful connection
		backoff = 1 * time.Second

		// Optionally notify hub about connection status
		statusMsg := map[string]string{"type": "status", "status": "connected"}
		if b, err := json.Marshal(statusMsg); err == nil {
			select {
			case h.Broadcast <- b:
			default:
				// drop if hub busy
			}
		}

		// Read loop
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("Binance read error:", err)
				// Notify hub about disconnection
				statusMsg := map[string]string{"type": "status", "status": "disconnected"}
				if b, err := json.Marshal(statusMsg); err == nil {
					select {
					case h.Broadcast <- b:
					default:
					}
				}
				// Close the connection and break to outer loop to reconnect
				conn.Close()
				break
			}

			// Parse the combined stream wrapper message
			var combinedMsg CombinedStreamMessage
			err = json.Unmarshal(message, &combinedMsg)
			if err != nil {
				log.Println("Binance combined stream JSON Unmarshal error:", err, string(message))
				continue // Skip malformed messages
			}

			// Extract the trade data from the wrapper
			tradeMsg := combinedMsg.Data

			// Ensure it's a trade event (though the stream should only send trades)
			if tradeMsg.EventType == "trade" {
				// Create the simplified message for our frontend
				priceUpdate := models.PriceUpdateMessage{
					Symbol: tradeMsg.Symbol,
					Price:  tradeMsg.Price,
					Time:   tradeMsg.TradeTime,
				}
				// Marshal the simplified message back to JSON
				updateJSON, err := json.Marshal(priceUpdate)
				if err != nil {
					log.Println("Local JSON Marshal error:", err)
					continue
				}
				// Send the simplified JSON to the hub for broadcasting
				// Use a non-blocking send in case the hub channel is full
				select {
				case h.Broadcast <- updateJSON:
					// Message sent successfully
				default:
					log.Println("Hub broadcast channel full, dropping message.")
				}
			}
		}

		// Wait a short moment before attempting to reconnect to avoid tight loop
		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
		log.Printf("Attempting to reconnect to Binance in %s...", backoff)
	}
}

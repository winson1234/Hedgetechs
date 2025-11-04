package binance

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub" // Import local hub package
	"brokerageProject/internal/models"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// StreamTrades connects to the Binance WebSocket trade stream and forwards price updates to the provided hub.
func StreamTrades(h *hub.Hub) {
	// Exponential backoff parameters
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		// Attempt to connect with proper headers
		headers := http.Header{}
		headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		headers.Add("Origin", "https://www.binance.com")

		conn, _, err := websocket.DefaultDialer.Dial(config.BinanceWebSocketURL, headers)
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
				// Create the message for our frontend with full trade details
				priceUpdate := models.PriceUpdateMessage{
					Symbol:       tradeMsg.Symbol,
					Price:        tradeMsg.Price,
					Time:         tradeMsg.TradeTime,
					Quantity:     tradeMsg.Quantity,
					IsBuyerMaker: tradeMsg.IsMarketMaker,
				}
				// Marshal the message back to JSON
				updateJSON, err := json.Marshal(priceUpdate)
				if err != nil {
					log.Println("Local JSON Marshal error:", err)
					continue
				}
				// Send the JSON to the hub for broadcasting
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

// StreamDepth connects to the Binance WebSocket depth stream and forwards order book updates to the provided hub.
func StreamDepth(h *hub.Hub) {
	// Exponential backoff parameters
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		// Attempt to connect with proper headers
		headers := http.Header{}
		headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		headers.Add("Origin", "https://www.binance.com")

		conn, _, err := websocket.DefaultDialer.Dial(config.BinanceDepthStreamURL, headers)
		if err != nil {
			log.Printf("Binance depth dial error: %v. Reconnecting in %s", err, backoff)
			time.Sleep(backoff)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		// Connected successfully
		log.Println("Connected to Binance Depth WebSocket:", config.BinanceDepthStreamURL)
		// Reset backoff after successful connection
		backoff = 1 * time.Second

		// Read loop
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("Binance depth read error:", err)
				conn.Close()
				break
			}

			// Parse the combined stream wrapper message for depth
			var combinedMsg struct {
				Stream string                     `json:"stream"` // e.g., "btcusdt@depth20@100ms"
				Data   models.BinanceDepthMessage `json:"data"`
			}
			err = json.Unmarshal(message, &combinedMsg)
			if err != nil {
				log.Println("Binance depth JSON Unmarshal error:", err, string(message))
				continue
			}

			// Extract symbol from stream name (e.g., "btcusdt@depth20@100ms" -> "BTCUSDT")
			symbol := extractSymbolFromDepthStream(combinedMsg.Stream)

			// Create the order book update message for frontend
			orderBookUpdate := models.OrderBookUpdate{
				Symbol: symbol,
				Bids:   combinedMsg.Data.Bids,
				Asks:   combinedMsg.Data.Asks,
			}

			// Marshal to JSON
			updateJSON, err := json.Marshal(orderBookUpdate)
			if err != nil {
				log.Println("Order book JSON Marshal error:", err)
				continue
			}

			// Send to hub for broadcasting
			select {
			case h.Broadcast <- updateJSON:
				// Message sent successfully
			default:
				log.Println("Hub broadcast channel full, dropping order book message.")
			}
		}

		// Wait before reconnecting
		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
		log.Printf("Attempting to reconnect to Binance Depth in %s...", backoff)
	}
}

// extractSymbolFromDepthStream extracts the symbol from depth stream name
// e.g., "btcusdt@depth20@100ms" -> "BTCUSDT"
func extractSymbolFromDepthStream(stream string) string {
	// Split by '@' and take the first part
	parts := []rune(stream)
	symbolEnd := 0
	for i, r := range parts {
		if r == '@' {
			symbolEnd = i
			break
		}
	}
	if symbolEnd > 0 {
		symbol := string(parts[:symbolEnd])
		// Convert to uppercase for consistency
		return toUpper(symbol)
	}
	return "UNKNOWN"
}

// toUpper converts a string to uppercase
func toUpper(s string) string {
	result := make([]rune, len(s))
	for i, r := range s {
		if r >= 'a' && r <= 'z' {
			result[i] = r - 32
		} else {
			result[i] = r
		}
	}
	return string(result)
}

package binance

import (
	"brokerageProject/internal/config"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Provider implements the market_data.Provider interface for Binance WebSocket streams.
// This is a thin wrapper around the existing StreamTrades functionality,
// adapted to fit the pluggable provider pattern.
type Provider struct {
	onTick    func(string, float64)
	stopChan  chan struct{}
	wg        sync.WaitGroup
	mu        sync.Mutex
	isRunning bool
}

// NewProvider creates a new Binance WebSocket provider
func NewProvider() *Provider {
	return &Provider{
		stopChan: make(chan struct{}),
	}
}

// Subscribe implements the market_data.Provider interface
// For Binance, symbols are ignored since we use a hardcoded combined stream
func (p *Provider) Subscribe(symbols []string, onTick func(string, float64)) error {
	p.mu.Lock()
	p.onTick = onTick
	p.isRunning = true
	p.mu.Unlock()

	// Start the trade stream in a goroutine
	p.wg.Add(1)
	go p.streamTrades()

	log.Printf("[Binance Provider] Subscribed to real-time crypto stream (%d symbols via combined stream)", 26)
	return nil
}

// Stop gracefully shuts down the provider
func (p *Provider) Stop() {
	p.mu.Lock()
	if !p.isRunning {
		p.mu.Unlock()
		return
	}
	p.isRunning = false
	p.mu.Unlock()

	close(p.stopChan)
	p.wg.Wait()
	log.Println("[Binance Provider] Stopped")
}

// streamTrades connects to Binance WebSocket and extracts price updates
func (p *Provider) streamTrades() {
	defer p.wg.Done()

	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	dialer := &websocket.Dialer{
		HandshakeTimeout: 45 * time.Second,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}

	for {
		// Check if we should stop
		select {
		case <-p.stopChan:
			return
		default:
		}

		// Prepare headers
		headers := http.Header{}
		headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		headers.Add("Accept-Encoding", "gzip, deflate, br")
		headers.Add("Accept-Language", "en-US,en;q=0.9")
		headers.Add("Cache-Control", "no-cache")
		headers.Add("Pragma", "no-cache")

		// Attempt connection
		conn, resp, err := dialer.Dial(config.BinanceWebSocketURL, headers)
		if err != nil {
			if resp != nil {
				log.Printf("[Binance Provider] Dial error: %v (HTTP %d). Reconnecting in %s", err, resp.StatusCode, backoff)
			} else {
				log.Printf("[Binance Provider] Dial error: %v. Reconnecting in %s", err, backoff)
			}
			time.Sleep(backoff)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		log.Println("[Binance Provider] Connected to WebSocket:", config.BinanceWebSocketURL)
		backoff = 1 * time.Second

		// Read loop
		p.readLoop(conn)

		// Connection lost, check if we should reconnect
		p.mu.Lock()
		running := p.isRunning
		p.mu.Unlock()

		if !running {
			return
		}

		log.Printf("[Binance Provider] Connection lost. Reconnecting in %s...", backoff)
		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}

// readLoop reads messages from the WebSocket connection
func (p *Provider) readLoop(conn *websocket.Conn) {
	defer conn.Close()

	for {
		// Check if we should stop
		select {
		case <-p.stopChan:
			return
		default:
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[Binance Provider] Read error: %v", err)
			return
		}

		// Parse combined stream message
		var combinedMsg CombinedStreamMessage
		if err := json.Unmarshal(message, &combinedMsg); err != nil {
			// Skip malformed messages
			continue
		}

		tradeMsg := combinedMsg.Data

		// Only process trade events
		if tradeMsg.EventType == "trade" {
			// Extract price
			price := 0.0
			if _, err := fmt.Sscanf(tradeMsg.Price, "%f", &price); err != nil {
				continue
			}

			// Call the onTick callback
			p.mu.Lock()
			if p.onTick != nil && price > 0 {
				p.onTick(tradeMsg.Symbol, price)
			}
			p.mu.Unlock()
		}
	}
}

package binance

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// PollMarketData polls Binance REST API for market data (alternative to WebSocket)
func PollMarketData(h *hub.Hub, symbols []string) {
	log.Println("Starting REST API polling for market data")
	log.Printf("Polling symbols: %v", symbols)

	// Use a longer interval to avoid rate limiting (3 seconds)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	// Track last prices to detect changes
	lastPrices := make(map[string]string)
	var mu sync.Mutex

	for range ticker.C {
		// Poll all symbols concurrently
		var wg sync.WaitGroup
		for _, symbol := range symbols {
			wg.Add(1)
			go func(sym string) {
				defer wg.Done()
				pollSymbolTicker(h, client, sym, lastPrices, &mu)
			}(symbol)
		}
		wg.Wait()
	}
}

// pollSymbolTicker polls ticker data for a single symbol
func pollSymbolTicker(h *hub.Hub, client *http.Client, symbol string, lastPrices map[string]string, mu *sync.Mutex) {
	url := fmt.Sprintf("%s?symbol=%s", config.BinanceTicker24hURL, symbol)

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[REST Poll] Error fetching %s: %v", symbol, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[REST Poll] Bad status %d for %s", resp.StatusCode, symbol)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[REST Poll] Error reading %s: %v", symbol, err)
		return
	}

	// Parse the ticker response
	var tickerData struct {
		Symbol             string `json:"symbol"`
		LastPrice          string `json:"lastPrice"`
		Volume             string `json:"volume"`
		PriceChange        string `json:"priceChange"`
		PriceChangePercent string `json:"priceChangePercent"`
	}

	if err := json.Unmarshal(body, &tickerData); err != nil {
		log.Printf("[REST Poll] Parse error for %s: %v", symbol, err)
		return
	}

	// Check if price changed
	mu.Lock()
	lastPrice, exists := lastPrices[symbol]
	priceChanged := !exists || lastPrice != tickerData.LastPrice
	lastPrices[symbol] = tickerData.LastPrice
	mu.Unlock()

	// Only broadcast if price changed or first time
	if priceChanged {
		// Create a price update message matching WebSocket format
		priceUpdate := models.PriceUpdateMessage{
			Symbol:       tickerData.Symbol,
			Price:        tickerData.LastPrice,
			Time:         time.Now().UnixMilli(),
			Quantity:     tickerData.Volume,
			IsBuyerMaker: false,
		}

		// Send to hub
		updateJSON, err := json.Marshal(priceUpdate)
		if err != nil {
			log.Printf("[REST Poll] Marshal error for %s: %v", symbol, err)
			return
		}

		select {
		case h.Broadcast <- updateJSON:
			// Success - only log first time or significant changes
			if !exists {
				log.Printf("[REST Poll] Initial price for %s: %s", symbol, tickerData.LastPrice)
			}
		default:
			// Hub channel full, skip this update
		}
	}
}

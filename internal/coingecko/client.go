package coingecko

import (
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

// CoinGecko API mapping for our symbols
var symbolToCoinGeckoID = map[string]string{
	"BTCUSDT": "bitcoin",
	"ETHUSDT": "ethereum",
	"SOLUSDT": "solana",
	"EURUSDT": "tether-eurt", // EUR Tether as proxy for EUR/USD
}

// PollCoinGeckoPrices polls CoinGecko API for cryptocurrency prices
func PollCoinGeckoPrices(h *hub.Hub, symbols []string) {
	log.Println("Starting CoinGecko API polling for market data")
	log.Printf("Polling symbols: %v", symbols)

	// CoinGecko free tier: 10-30 calls/minute, so use 10-second intervals
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	// Build coin IDs list for batch request
	var coinIDs []string
	symbolToID := make(map[string]string)
	for _, symbol := range symbols {
		if coinID, ok := symbolToCoinGeckoID[symbol]; ok {
			coinIDs = append(coinIDs, coinID)
			symbolToID[coinID] = symbol
		}
	}

	// Track last prices to detect changes
	lastPrices := make(map[string]float64)
	var mu sync.Mutex

	// Initial fetch
	pollCoinGecko(h, client, coinIDs, symbolToID, lastPrices, &mu)

	for range ticker.C {
		pollCoinGecko(h, client, coinIDs, symbolToID, lastPrices, &mu)
	}
}

// pollCoinGecko fetches prices from CoinGecko API
func pollCoinGecko(h *hub.Hub, client *http.Client, coinIDs []string, symbolToID map[string]string, lastPrices map[string]float64, mu *sync.Mutex) {
	// Build URL for batch price request
	// Format: https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd
	url := "https://api.coingecko.com/api/v3/simple/price?ids="
	for i, coinID := range coinIDs {
		if i > 0 {
			url += ","
		}
		url += coinID
	}
	url += "&vs_currencies=usd&include_24hr_change=true"

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[CoinGecko] Error fetching prices: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[CoinGecko] Bad status %d: %s", resp.StatusCode, string(body))
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[CoinGecko] Error reading response: %v", err)
		return
	}

	// Parse response
	// Format: {"bitcoin":{"usd":50000,"usd_24h_change":2.5},"ethereum":{"usd":3000,"usd_24h_change":1.2}}
	var priceData map[string]map[string]interface{}
	if err := json.Unmarshal(body, &priceData); err != nil {
		log.Printf("[CoinGecko] Parse error: %v", err)
		return
	}

	// Process each coin
	for coinID, data := range priceData {
		symbol, ok := symbolToID[coinID]
		if !ok {
			continue
		}

		usdPrice, ok := data["usd"].(float64)
		if !ok {
			continue
		}

		// Check if price changed
		mu.Lock()
		lastPrice, exists := lastPrices[symbol]
		priceChanged := !exists || lastPrice != usdPrice
		lastPrices[symbol] = usdPrice
		mu.Unlock()

		// Broadcast if price changed
		if priceChanged {
			priceUpdate := models.PriceUpdateMessage{
				Symbol:       symbol,
				Price:        fmt.Sprintf("%.2f", usdPrice),
				Time:         time.Now().UnixMilli(),
				Quantity:     "0",
				IsBuyerMaker: false,
			}

			updateJSON, err := json.Marshal(priceUpdate)
			if err != nil {
				log.Printf("[CoinGecko] Marshal error for %s: %v", symbol, err)
				continue
			}

			select {
			case h.Broadcast <- updateJSON:
				if !exists {
					log.Printf("[CoinGecko] Initial price for %s: $%.2f", symbol, usdPrice)
				}
			default:
				// Hub channel full, skip
			}
		}
	}
}

package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// CoinbaseChargeRequest represents the request to create a crypto charge
type CoinbaseChargeRequest struct {
	AccountID string  `json:"accountId"`
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
}

// CoinbaseChargeResponse represents Coinbase Commerce charge creation response
type CoinbaseChargeResponse struct {
	Data struct {
		ID         string `json:"id"`
		HostedURL  string `json:"hosted_url"`
		Code       string `json:"code"`
		PricingType string `json:"pricing_type"`
	} `json:"data"`
}

// CoinbaseWebhookEvent represents the webhook event from Coinbase
type CoinbaseWebhookEvent struct {
	ID     int    `json:"id"`
	Type   string `json:"type"` // e.g., "charge:confirmed"
	Event  struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			ID       string `json:"id"`
			Code     string `json:"code"`
			Metadata struct {
				AccountID       string `json:"account_id"`
				OriginalAmount  string `json:"original_amount"`
				OriginalCurrency string `json:"original_currency"`
			} `json:"metadata"`
			Timeline []struct {
				Status string `json:"status"`
				Time   string `json:"time"`
			} `json:"timeline"`
		} `json:"data"`
	} `json:"event"`
}

// HandleCreateCryptoCharge creates a new Coinbase Commerce charge
func HandleCreateCryptoCharge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req CoinbaseChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.AccountID == "" || req.Amount <= 0 || req.Currency == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Get Coinbase Commerce API key from environment
	apiKey := os.Getenv("COINBASE_COMMERCE_API_KEY")
	if apiKey == "" {
		http.Error(w, "Coinbase Commerce API key not configured", http.StatusInternalServerError)
		return
	}

	// Create charge request payload for Coinbase Commerce API
	chargePayload := map[string]interface{}{
		"name":         "Trading Account Deposit",
		"description":  fmt.Sprintf("Deposit to account %s", req.AccountID),
		"pricing_type": "fixed_price",
		"local_price": map[string]interface{}{
			"amount":   fmt.Sprintf("%.2f", req.Amount),
			"currency": req.Currency,
		},
		"metadata": map[string]string{
			"account_id":        req.AccountID,
			"original_amount":   fmt.Sprintf("%.2f", req.Amount),
			"original_currency": req.Currency,
		},
		"redirect_url": os.Getenv("APP_URL") + "/wallet",
		"cancel_url":   os.Getenv("APP_URL") + "/wallet",
	}

	payloadBytes, err := json.Marshal(chargePayload)
	if err != nil {
		http.Error(w, "Failed to create charge payload", http.StatusInternalServerError)
		return
	}

	// Make API request to Coinbase Commerce
	coinbaseReq, err := http.NewRequest("POST", "https://api.commerce.coinbase.com/charges", bytes.NewBuffer(payloadBytes))
	if err != nil {
		http.Error(w, "Failed to create Coinbase request", http.StatusInternalServerError)
		return
	}

	coinbaseReq.Header.Set("Content-Type", "application/json")
	coinbaseReq.Header.Set("X-CC-Api-Key", apiKey)
	coinbaseReq.Header.Set("X-CC-Version", "2018-03-22")

	client := &http.Client{}
	resp, err := client.Do(coinbaseReq)
	if err != nil {
		http.Error(w, "Failed to connect to Coinbase Commerce", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read Coinbase response", http.StatusInternalServerError)
		return
	}

	if resp.StatusCode != http.StatusCreated {
		http.Error(w, fmt.Sprintf("Coinbase API error: %s", string(body)), http.StatusBadGateway)
		return
	}

	// Parse Coinbase response
	var chargeResp CoinbaseChargeResponse
	if err := json.Unmarshal(body, &chargeResp); err != nil {
		http.Error(w, "Failed to parse Coinbase response", http.StatusInternalServerError)
		return
	}

	// Return hosted URL and charge ID to frontend
	response := map[string]string{
		"hosted_url": chargeResp.Data.HostedURL,
		"charge_id":  chargeResp.Data.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleCryptoWebhook handles webhook events from Coinbase Commerce
func HandleCryptoWebhook(hub interface{ Broadcast([]byte) }, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the raw body for signature verification
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// Verify webhook signature
	webhookSecret := os.Getenv("COINBASE_WEBHOOK_SECRET")
	if webhookSecret == "" {
		http.Error(w, "Webhook secret not configured", http.StatusInternalServerError)
		return
	}

	signature := r.Header.Get("X-CC-Webhook-Signature")
	if signature == "" {
		http.Error(w, "Missing webhook signature", http.StatusUnauthorized)
		return
	}

	// Compute expected signature
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if signature != expectedSignature {
		http.Error(w, "Invalid webhook signature", http.StatusUnauthorized)
		return
	}

	// Parse webhook event
	var event CoinbaseWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "Invalid webhook payload", http.StatusBadRequest)
		return
	}

	// Handle charge:confirmed event
	if event.Event.Type == "charge:confirmed" {
		// Extract metadata
		metadata := event.Event.Data.Metadata
		accountID := metadata.AccountID
		originalAmount := metadata.OriginalAmount
		originalCurrency := metadata.OriginalCurrency
		chargeID := event.Event.Data.ID

		// Create WebSocket message to notify frontend
		wsMessage := map[string]interface{}{
			"type": "DEPOSIT_COMPLETED",
			"payload": map[string]interface{}{
				"accountId":       accountID,
				"amount":          originalAmount,
				"currency":        originalCurrency,
				"paymentIntentId": chargeID,
				"method":          "crypto",
			},
		}

		messageBytes, err := json.Marshal(wsMessage)
		if err != nil {
			http.Error(w, "Failed to create WebSocket message", http.StatusInternalServerError)
			return
		}

		// Broadcast to all connected WebSocket clients
		// The frontend will filter by accountId
		hub.Broadcast(messageBytes)

		// Log successful processing
		fmt.Printf("Crypto deposit confirmed: Account=%s, Amount=%s %s, ChargeID=%s\n",
			accountID, originalAmount, originalCurrency, chargeID)
	}

	// Respond with 200 OK
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}

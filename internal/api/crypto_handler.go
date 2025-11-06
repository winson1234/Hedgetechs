package api

import (
	"brokerageProject/internal/hub"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// NOWPaymentsChargeRequest represents the request to create a crypto charge
type NOWPaymentsChargeRequest struct {
	AccountID string  `json:"accountId"`
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
}

// NOWPaymentsCreateInvoiceRequest represents NOWPayments API invoice creation request
type NOWPaymentsCreateInvoiceRequest struct {
	PriceAmount      float64 `json:"price_amount"`
	PriceCurrency    string  `json:"price_currency"`
	OrderID          string  `json:"order_id"`
	OrderDescription string  `json:"order_description"`
	IPNCallbackURL   string  `json:"ipn_callback_url"`
	SuccessURL       string  `json:"success_url,omitempty"`
	CancelURL        string  `json:"cancel_url,omitempty"`
}

// NOWPaymentsInvoiceResponse represents NOWPayments invoice creation response
type NOWPaymentsInvoiceResponse struct {
	ID               string  `json:"id"`
	TokenID          string  `json:"token_id"`
	OrderID          string  `json:"order_id"`
	OrderDescription string  `json:"order_description"`
	PriceAmount      string  `json:"price_amount"` // Note: returned as string
	PriceCurrency    string  `json:"price_currency"`
	PayCurrency      *string `json:"pay_currency"`
	IPNCallbackURL   string  `json:"ipn_callback_url"`
	InvoiceURL       string  `json:"invoice_url"` // This is the hosted payment page URL
	SuccessURL       string  `json:"success_url"`
	CancelURL        string  `json:"cancel_url"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

// NOWPaymentsWebhookEvent represents the IPN webhook event from NOWPayments
type NOWPaymentsWebhookEvent struct {
	PaymentID        string  `json:"payment_id"`
	PaymentStatus    string  `json:"payment_status"` // "finished", "confirmed", "sending", etc.
	PayAddress       string  `json:"pay_address"`
	PriceAmount      float64 `json:"price_amount"`
	PriceCurrency    string  `json:"price_currency"`
	PayAmount        float64 `json:"pay_amount"`
	PayCurrency      string  `json:"pay_currency"`
	OrderID          string  `json:"order_id"`
	OrderDescription string  `json:"order_description"`
	PurchaseID       string  `json:"purchase_id"`
	OutcomeAmount    float64 `json:"outcome_amount"`
	OutcomeCurrency  string  `json:"outcome_currency"`
}

// HandleCreateCryptoCharge creates a new NOWPayments payment
func HandleCreateCryptoCharge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req NOWPaymentsChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.AccountID == "" || req.Amount <= 0 || req.Currency == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Get NOWPayments API key from environment
	apiKey := os.Getenv("NOWPAYMENTS_API_KEY")
	if apiKey == "" {
		http.Error(w, "NOWPayments API key not configured", http.StatusInternalServerError)
		return
	}

	// Get app URL for callbacks
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}

	// Generate unique order ID
	orderID := fmt.Sprintf("deposit-%s-%d", req.AccountID, os.Getpid())

	// Create invoice request payload for NOWPayments API
	invoicePayload := NOWPaymentsCreateInvoiceRequest{
		PriceAmount:      req.Amount,
		PriceCurrency:    req.Currency,
		OrderID:          orderID,
		OrderDescription: fmt.Sprintf("Deposit to trading account %s", req.AccountID),
		IPNCallbackURL:   appURL + "/api/v1/crypto/webhook",
		SuccessURL:       appURL + "/wallet",
		CancelURL:        appURL + "/wallet",
	}

	payloadBytes, err := json.Marshal(invoicePayload)
	if err != nil {
		http.Error(w, "Failed to create payment payload", http.StatusInternalServerError)
		return
	}

	// Log the request for debugging
	fmt.Printf("NOWPayments API request payload: %s\n", string(payloadBytes))

	// Make API request to NOWPayments (using invoice endpoint)
	nowPaymentsReq, err := http.NewRequest("POST", "https://api.nowpayments.io/v1/invoice", bytes.NewBuffer(payloadBytes))
	if err != nil {
		http.Error(w, "Failed to create NOWPayments request", http.StatusInternalServerError)
		return
	}

	nowPaymentsReq.Header.Set("Content-Type", "application/json")
	nowPaymentsReq.Header.Set("x-api-key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(nowPaymentsReq)
	if err != nil {
		http.Error(w, "Failed to connect to NOWPayments", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read NOWPayments response", http.StatusInternalServerError)
		return
	}

	// Log the response for debugging
	fmt.Printf("NOWPayments API response status: %d\n", resp.StatusCode)
	fmt.Printf("NOWPayments API response body: %s\n", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		// Return error as JSON instead of plain text
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("NOWPayments API error (status %d): %s", resp.StatusCode, string(body)),
		})
		return
	}

	// Parse NOWPayments invoice response
	var invoiceResp NOWPaymentsInvoiceResponse
	if err := json.Unmarshal(body, &invoiceResp); err != nil {
		fmt.Printf("Failed to parse NOWPayments response: %v\n", err)
		http.Error(w, "Failed to parse NOWPayments response", http.StatusInternalServerError)
		return
	}

	// Return hosted URL and invoice ID to frontend
	response := map[string]string{
		"hosted_url": invoiceResp.InvoiceURL,
		"charge_id":  invoiceResp.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleCryptoWebhook handles IPN webhook events from NOWPayments
func HandleCryptoWebhook(hub *hub.Hub, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the raw body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// Parse webhook event
	var event NOWPaymentsWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "Invalid webhook payload", http.StatusBadRequest)
		return
	}

	// NOWPayments sends multiple status updates. We only process "finished" status
	// "finished" means payment is confirmed and credited
	if event.PaymentStatus == "finished" {
		// Extract order ID to get account metadata
		// Order ID format: "deposit-{accountId}-{timestamp}"
		orderID := event.OrderID

		// For now, log the payment confirmation
		// In production, you would parse the order ID or use database lookup
		fmt.Printf("Crypto deposit confirmed: OrderID=%s, PaymentID=%s, Amount=%.2f %s, Status=%s\n",
			orderID, event.PaymentID, event.PriceAmount, event.PriceCurrency, event.PaymentStatus)

		// Note: NOWPayments doesn't support custom metadata in the same way as Coinbase
		// You'll need to store the order_id -> account_id mapping in a database
		// For demo purposes, we'll just log it here

		// If you want to notify frontend via WebSocket, you would do:
		// 1. Look up account_id from order_id in your database
		// 2. Send WebSocket message like below (commented out for now):

		/*
			wsMessage := map[string]interface{}{
				"type": "DEPOSIT_COMPLETED",
				"payload": map[string]interface{}{
					"accountId":       "account_id_from_db",
					"amount":          fmt.Sprintf("%.2f", event.PriceAmount),
					"currency":        event.PriceCurrency,
					"paymentIntentId": event.PaymentID,
					"method":          "crypto",
				},
			}

			messageBytes, err := json.Marshal(wsMessage)
			if err == nil {
				hub.Broadcast <- messageBytes
			}
		*/
	}

	// Respond with 200 OK to acknowledge receipt
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})
}

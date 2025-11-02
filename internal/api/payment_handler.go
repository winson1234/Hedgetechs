package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"
)

// InitializeStripe sets up the Stripe API key
// Call this after loading environment variables
func InitializeStripe() {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	if stripe.Key == "" {
		log.Println("WARNING: STRIPE_SECRET_KEY environment variable not set")
	} else {
		log.Printf("Stripe initialized successfully")
	}
}

// CreatePaymentIntentRequest defines the request body for creating a payment intent
type CreatePaymentIntentRequest struct {
	Amount             int64             `json:"amount"`               // Amount in cents (e.g., 1000 = $10.00)
	Currency           string            `json:"currency"`             // Currency code (e.g., "usd")
	PaymentMethodTypes []string          `json:"payment_method_types"` // Payment method types (e.g., ["card"], ["fpx"])
	Metadata           map[string]string `json:"metadata"`             // Metadata to store with payment intent (account_id, etc.)
}

// CreatePaymentIntentResponse defines the response structure
type CreatePaymentIntentResponse struct {
	ClientSecret string `json:"clientSecret"`
}

// ErrorResponse defines the error response structure
type ErrorResponse struct {
	Error string `json:"error"`
}

// HandleCreatePaymentIntent creates a Stripe Payment Intent and returns the client secret
func HandleCreatePaymentIntent(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req CreatePaymentIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding payment intent request: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid request body"})
		return
	}

	// Log received request for debugging
	log.Printf("Received payment intent request: Amount=%d, Currency=%s, PaymentMethodTypes=%v, Metadata=%v",
		req.Amount, req.Currency, req.PaymentMethodTypes, req.Metadata)

	// Validate amount (minimum $5.00 = 500 cents)
	if req.Amount < 500 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Minimum deposit amount is $5.00"})
		return
	}

	// Validate currency
	if req.Currency == "" {
		req.Currency = "usd" // Default to USD
	}

	// Check if Stripe is configured
	if stripe.Key == "" {
		log.Println("STRIPE_SECRET_KEY not configured")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Payment processor not configured"})
		return
	}

	// Create Stripe Payment Intent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(req.Amount),
		Currency: stripe.String(req.Currency),
	}

	// Add metadata if provided (to track account_id, original_amount, etc.)
	if len(req.Metadata) > 0 {
		log.Printf("Adding metadata to payment intent: %v", req.Metadata)
		// Stripe Go SDK requires using AddMetadata for each key-value pair
		for key, value := range req.Metadata {
			params.AddMetadata(key, value)
		}
	}

	// If payment method types are specified, use them; otherwise use automatic payment methods
	if len(req.PaymentMethodTypes) > 0 {
		params.PaymentMethodTypes = stripe.StringSlice(req.PaymentMethodTypes)
	} else {
		// Default to automatic payment methods (card, link)
		params.AutomaticPaymentMethods = &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		}
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		log.Printf("Error creating payment intent: %v", err)
		log.Printf("Payment intent params: Amount=%d, Currency=%s, Metadata=%v", req.Amount, req.Currency, req.Metadata)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: fmt.Sprintf("Failed to create payment intent: %v", err)})
		return
	}

	// Log successful creation with metadata
	log.Printf("Created payment intent: %s for amount: %d %s with metadata: %v", pi.ID, req.Amount, req.Currency, pi.Metadata)

	// Return the client secret
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(CreatePaymentIntentResponse{
		ClientSecret: pi.ClientSecret,
	})
}

// PaymentStatusResponse defines the response structure for payment status
type PaymentStatusResponse struct {
	Status           string `json:"status"`
	PaymentIntentID  string `json:"payment_intent_id"`
	Amount           int64  `json:"amount,omitempty"`
	Currency         string `json:"currency,omitempty"`
	LastPaymentError string `json:"last_payment_error,omitempty"`
}

// HandlePaymentStatus checks the status of a Stripe Payment Intent
func HandlePaymentStatus(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only allow GET requests
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Method not allowed"})
		return
	}

	// Get payment intent ID from query parameter
	paymentIntentID := r.URL.Query().Get("payment_intent_id")
	if paymentIntentID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "payment_intent_id parameter is required"})
		return
	}

	// Check if Stripe is configured
	if stripe.Key == "" {
		log.Println("STRIPE_SECRET_KEY not configured")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Payment processor not configured"})
		return
	}

	// Retrieve the payment intent from Stripe
	pi, err := paymentintent.Get(paymentIntentID, nil)
	if err != nil {
		log.Printf("Error retrieving payment intent %s: %v", paymentIntentID, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Failed to retrieve payment status"})
		return
	}

	// Prepare response
	response := PaymentStatusResponse{
		Status:          string(pi.Status),
		PaymentIntentID: pi.ID,
		Amount:          pi.Amount,
		Currency:        string(pi.Currency),
	}

	// Include error message if payment failed
	if pi.LastPaymentError != nil {
		response.LastPaymentError = pi.LastPaymentError.Msg
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)

	log.Printf("Payment status check for %s: %s", paymentIntentID, pi.Status)
}

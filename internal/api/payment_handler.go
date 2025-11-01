package api

import (
	"encoding/json"
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
	Amount   int64  `json:"amount"`   // Amount in cents (e.g., 1000 = $10.00)
	Currency string `json:"currency"` // Currency code (e.g., "usd")
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
		// Automatic payment methods (cards, etc.)
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		log.Printf("Error creating payment intent: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Failed to create payment intent"})
		return
	}

	// Return the client secret
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(CreatePaymentIntentResponse{
		ClientSecret: pi.ClientSecret,
	})

	log.Printf("Created payment intent: %s for amount: %d %s", pi.ID, req.Amount, req.Currency)
}

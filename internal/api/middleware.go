package api

import (
	"net/http"
	"strings"
)

// CORS middleware to allow requests from the frontend
func CORSMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := false

		// List of allowed origins (exact match)
		allowedOrigins := map[string]bool{
			"http://localhost:5173": true, // Vite dev server
			"http://localhost:4173": true, // Vite preview
			"http://127.0.0.1:5173": true,
			"http://127.0.0.1:4173": true,
		}

		// Check exact match first
		if allowedOrigins[origin] {
			allowed = true
		} else if strings.HasSuffix(origin, ".pages.dev") {
			// Allow all Cloudflare Pages subdomains (*.pages.dev)
			allowed = true
		}

		// Set CORS headers if origin is allowed
		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "3600")
		}

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// Simple logging middleware placeholder. Implement or expand as needed.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: add logging here
		next.ServeHTTP(w, r)
	})
}

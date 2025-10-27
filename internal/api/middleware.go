package api

import "net/http"

// Simple logging middleware placeholder. Implement or expand as needed.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: add logging here
		next.ServeHTTP(w, r)
	})
}

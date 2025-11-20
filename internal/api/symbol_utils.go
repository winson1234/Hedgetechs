package api

import "strings"

// normalizeSymbol normalizes trading symbols for database insertion.
// Forex symbols in the database are stored WITHOUT the "USDT" suffix (e.g., AUDJPY, EURUSD),
// while crypto symbols keep the "USDT" suffix (e.g., BTCUSDT, ETHUSDT).
//
// This function strips "USDT" from forex pairs (6-character currency pairs like AUDJPY)
// but preserves "USDT" for crypto symbols (3-4 character base assets like BTC, ETH, SHIB).
func normalizeSymbol(symbol string) string {
	// If symbol ends with USDT, check if base is a forex pair
	if strings.HasSuffix(symbol, "USDT") {
		base := strings.TrimSuffix(symbol, "USDT")

		// Forex pairs are exactly 6 uppercase letters (e.g., AUDJPY, EURUSD, GBPJPY)
		// Crypto pairs have 3-4 character bases (e.g., BTC, ETH, SHIB, MATIC)
		if len(base) == 6 && isAllUppercaseLetters(base) {
			// This is a forex pair - strip USDT for database compatibility
			return base
		}
	}

	// For crypto symbols and other cases, return as-is
	return symbol
}

// isAllUppercaseLetters checks if a string contains only uppercase letters A-Z
func isAllUppercaseLetters(s string) bool {
	for _, r := range s {
		if r < 'A' || r > 'Z' {
			return false
		}
	}
	return true
}

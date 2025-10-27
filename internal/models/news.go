package models

import "time"

// NewsArticle represents a news article from crypto sources (CoinDesk, CryptoNews, CoinTelegraph)
// and forex sources (FXStreet, Investing.com, Yahoo Finance)
type NewsArticle struct {
	Title       string    `json:"title"`
	Link        string    `json:"link"`
	Description string    `json:"description"`
	PubDate     time.Time `json:"pubDate"`
	Source      string    `json:"source"`
	GUID        string    `json:"guid,omitempty"`
}

// NewsResponse represents the response structure for news API
type NewsResponse struct {
	Articles []NewsArticle `json:"articles"`
	Count    int           `json:"count"`
}

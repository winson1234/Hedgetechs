package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GetNotifications handles GET /api/v1/notifications
// Returns all notifications for the authenticated user
func GetNotifications(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Get query parameters
	unreadOnly := r.URL.Query().Get("unread_only") == "true"
	limitStr := r.URL.Query().Get("limit")
	limit := 50 // default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("GetNotifications: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Build query
	query := `SELECT id, user_id, type, title, message, is_read, metadata, created_at, read_at
			  FROM notifications
			  WHERE user_id = $1`
	args := []interface{}{userID}

	if unreadOnly {
		query += ` AND is_read = false`
	}

	query += ` ORDER BY created_at DESC LIMIT $2`
	args = append(args, limit)

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		log.Printf("GetNotifications: Failed to query notifications: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch notifications")
		return
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var notification models.Notification
		var metadataJSON []byte
		var readAt *time.Time

		err := rows.Scan(
			&notification.ID, &notification.UserID, &notification.Type,
			&notification.Title, &notification.Message, &notification.IsRead,
			&metadataJSON, &notification.CreatedAt, &readAt,
		)
		if err != nil {
			log.Printf("GetNotifications: Failed to scan notification: %v", err)
			continue
		}

		// Parse metadata JSON
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &notification.Metadata); err != nil {
				log.Printf("GetNotifications: Failed to parse metadata: %v", err)
				notification.Metadata = make(map[string]interface{})
			}
		} else {
			notification.Metadata = make(map[string]interface{})
		}

		notification.ReadAt = readAt
		notifications = append(notifications, notification)
	}

	if err := rows.Err(); err != nil {
		log.Printf("GetNotifications: Row iteration error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "error processing notifications")
		return
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"notifications": notifications,
	})
}

// GetUnreadCount handles GET /api/v1/notifications/unread-count
// Returns the count of unread notifications for the authenticated user
func GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("GetUnreadCount: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var count int
	err = pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
		userID,
	).Scan(&count)
	if err != nil {
		log.Printf("GetUnreadCount: Failed to count unread notifications: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to count notifications")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"count":   count,
	})
}

// MarkNotificationRead handles PATCH /api/v1/notifications/:id/read
// Marks a specific notification as read
func MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Extract notification ID from URL path
	notificationIDStr := r.URL.Query().Get("id")
	if notificationIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "notification ID is required")
		return
	}

	notificationID, err := uuid.Parse(notificationIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid notification ID format")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("MarkNotificationRead: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify notification belongs to user and update
	var notificationUserID int64
	var alreadyRead bool
	err = pool.QueryRow(ctx,
		`SELECT user_id, is_read FROM notifications WHERE id = $1`,
		notificationID,
	).Scan(&notificationUserID, &alreadyRead)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "notification not found")
			return
		}
		log.Printf("MarkNotificationRead: Failed to fetch notification: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch notification")
		return
	}

	if notificationUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "notification does not belong to user")
		return
	}

	if alreadyRead {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "notification already marked as read",
		})
		return
	}

	// Mark as read
	_, err = pool.Exec(ctx,
		`UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1`,
		notificationID,
	)
	if err != nil {
		log.Printf("MarkNotificationRead: Failed to update notification: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update notification")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "notification marked as read",
	})
}

// MarkAllNotificationsRead handles PATCH /api/v1/notifications/mark-all-read
// Marks all notifications for the user as read
func MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("MarkAllNotificationsRead: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	_, err = pool.Exec(ctx,
		`UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`,
		userID,
	)
	if err != nil {
		log.Printf("MarkAllNotificationsRead: Failed to update notifications: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update notifications")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "all notifications marked as read",
	})
}

// CreateNotification creates a notification in the database
// This is a helper function used by other APIs
func CreateNotification(ctx context.Context, pool *pgxpool.Pool, userID int64, notificationType, title, message string, metadata map[string]interface{}) error {
	// Validate userID
	if userID <= 0 {
		log.Printf("CreateNotification: Invalid user_id=%d, skipping notification creation", userID)
		return fmt.Errorf("invalid user_id: %d", userID)
	}

	var metadataJSON []byte
	var err error
	if len(metadata) > 0 {
		metadataJSON, err = json.Marshal(metadata)
		if err != nil {
			log.Printf("CreateNotification: Failed to marshal metadata: %v", err)
			metadataJSON = []byte("{}")
		}
	} else {
		metadataJSON = []byte("{}")
	}

	// Convert metadata JSON to string for PostgreSQL jsonb type
	// PostgreSQL jsonb columns can accept string input directly
	var metadataValue interface{}
	if len(metadataJSON) > 0 && string(metadataJSON) != "{}" {
		metadataValue = string(metadataJSON) // Convert to string for jsonb
	} else {
		metadataValue = nil
	}

	// Log notification creation attempt
	log.Printf("CreateNotification: Creating notification for user_id=%d, type=%s, title=%s", userID, notificationType, title)

	_, err = pool.Exec(ctx,
		`INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		userID, notificationType, title, message, metadataValue,
	)
	if err != nil {
		log.Printf("CreateNotification: Failed to create notification: %v (user_id=%d, type=%s, title=%s)", 
			err, userID, notificationType, title)
		return err
	}

	log.Printf("CreateNotification: Successfully created notification for user_id=%d, type=%s, title=%s", 
		userID, notificationType, title)
	return nil
}


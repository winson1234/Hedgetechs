package utils

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditLogger provides methods for logging audit events to the database
type AuditLogger struct {
	db *pgxpool.Pool
}

// NewAuditLogger creates a new audit logger instance
func NewAuditLogger(db *pgxpool.Pool) *AuditLogger {
	return &AuditLogger{db: db}
}

// Log writes an audit log entry to the database
func (al *AuditLogger) Log(ctx context.Context, entry *models.AuditLogEntry) error {
	// Convert metadata to JSONB
	var metadataJSON []byte
	var err error
	if len(entry.Metadata) > 0 {
		metadataJSON, err = json.Marshal(entry.Metadata)
		if err != nil {
			log.Printf("Error marshaling audit log metadata: %v", err)
			return err
		}
	}

	// Insert audit log into database
	query := `
		INSERT INTO public.audit_logs (
			user_id, action, resource_type, resource_id,
			ip_address, user_agent, metadata, status, error_message
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		) RETURNING id
	`

	var auditID uuid.UUID
	err = al.db.QueryRow(ctx, query,
		entry.UserID,
		entry.Action,
		entry.ResourceType,
		entry.ResourceID,
		entry.IPAddress,
		entry.UserAgent,
		metadataJSON,
		entry.Status,
		entry.ErrorMessage,
	).Scan(&auditID)

	if err != nil {
		log.Printf("Error inserting audit log: %v", err)
		return err
	}

	return nil
}

// LogFromRequest creates and logs an audit entry from an HTTP request
func (al *AuditLogger) LogFromRequest(ctx context.Context, r *http.Request, entry *models.AuditLogEntry) error {
	// Extract IP address from request
	ip := GetClientIP(r)
	if ip != "" {
		entry = entry.WithIPAddress(ip)
	}

	// Extract user agent from request
	ua := r.UserAgent()
	if ua != "" {
		entry = entry.WithUserAgent(ua)
	}

	// Add request method and path to metadata
	entry = entry.
		WithMetadata("method", r.Method).
		WithMetadata("path", r.URL.Path)

	// Log to database
	return al.Log(ctx, entry)
}

// GetClientIP extracts the client's IP address from the request
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies/load balancers)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		return xff
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// Helper functions for common audit scenarios

// LogAccountCreated logs an account creation event
func (al *AuditLogger) LogAccountCreated(ctx context.Context, r *http.Request, userID, accountID uuid.UUID, accountNumber, accountType string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionAccountCreated, models.ResourceTypeAccount).
		WithResourceID(accountID).
		WithMetadata("account_number", accountNumber).
		WithMetadata("account_type", accountType)

	return al.LogFromRequest(ctx, r, entry)
}

// LogAccountViewed logs an account view event
func (al *AuditLogger) LogAccountViewed(ctx context.Context, r *http.Request, userID, accountID uuid.UUID) error {
	entry := models.NewAuditLogEntry(userID, models.ActionAccountViewed, models.ResourceTypeAccount).
		WithResourceID(accountID)

	return al.LogFromRequest(ctx, r, entry)
}

// LogAccountMetadataUpdated logs an account metadata update event
func (al *AuditLogger) LogAccountMetadataUpdated(ctx context.Context, r *http.Request, userID, accountID uuid.UUID, nickname, color, icon string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionAccountMetadataUpdated, models.ResourceTypeAccount).
		WithResourceID(accountID).
		WithMetadata("nickname", nickname).
		WithMetadata("color", color).
		WithMetadata("icon", icon)

	return al.LogFromRequest(ctx, r, entry)
}

// LogTransactionCreated logs a transaction creation event
func (al *AuditLogger) LogTransactionCreated(ctx context.Context, r *http.Request, userID, accountID, transactionID uuid.UUID, txType, amount, currency string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionTransactionCreated, models.ResourceTypeTransaction).
		WithResourceID(transactionID).
		WithMetadata("account_id", accountID.String()).
		WithMetadata("type", txType).
		WithMetadata("amount", amount).
		WithMetadata("currency", currency)

	return al.LogFromRequest(ctx, r, entry)
}

// LogOrderCreated logs an order creation event
func (al *AuditLogger) LogOrderCreated(ctx context.Context, r *http.Request, userID, accountID, orderID uuid.UUID, symbol, side, quantity, price string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionOrderCreated, models.ResourceTypeOrder).
		WithResourceID(orderID).
		WithMetadata("account_id", accountID.String()).
		WithMetadata("symbol", symbol).
		WithMetadata("side", side).
		WithMetadata("quantity", quantity).
		WithMetadata("price", price)

	return al.LogFromRequest(ctx, r, entry)
}

// LogPendingOrderCreated logs a pending order creation event
func (al *AuditLogger) LogPendingOrderCreated(ctx context.Context, r *http.Request, userID, accountID, orderID uuid.UUID, symbol, orderType, side, quantity, triggerPrice string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionPendingOrderCreated, models.ResourceTypePendingOrder).
		WithResourceID(orderID).
		WithMetadata("account_id", accountID.String()).
		WithMetadata("symbol", symbol).
		WithMetadata("order_type", orderType).
		WithMetadata("side", side).
		WithMetadata("quantity", quantity).
		WithMetadata("trigger_price", triggerPrice)

	return al.LogFromRequest(ctx, r, entry)
}

// LogPendingOrderExecuted logs a pending order execution event (called by backend worker)
func (al *AuditLogger) LogPendingOrderExecuted(ctx context.Context, userID, accountID, orderID uuid.UUID, symbol, executedPrice string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionPendingOrderExecuted, models.ResourceTypePendingOrder).
		WithResourceID(orderID).
		WithMetadata("account_id", accountID.String()).
		WithMetadata("symbol", symbol).
		WithMetadata("executed_price", executedPrice)

	return al.Log(ctx, entry)
}

// LogPendingOrderCancelled logs a pending order cancellation event
func (al *AuditLogger) LogPendingOrderCancelled(ctx context.Context, r *http.Request, userID, accountID, orderID uuid.UUID) error {
	entry := models.NewAuditLogEntry(userID, models.ActionPendingOrderCancelled, models.ResourceTypePendingOrder).
		WithResourceID(orderID).
		WithMetadata("account_id", accountID.String())

	return al.LogFromRequest(ctx, r, entry)
}

// LogUnauthorizedAccess logs an unauthorized access attempt
func (al *AuditLogger) LogUnauthorizedAccess(ctx context.Context, r *http.Request, userID uuid.UUID, reason string) error {
	entry := models.NewAuditLogEntry(userID, models.ActionUnauthorizedAccess, "security").
		WithFailure(reason)

	return al.LogFromRequest(ctx, r, entry)
}

// LogRateLimitExceeded logs a rate limit exceeded event
func (al *AuditLogger) LogRateLimitExceeded(ctx context.Context, r *http.Request, userID uuid.UUID) error {
	entry := models.NewAuditLogEntry(userID, models.ActionRateLimitExceeded, "security")

	return al.LogFromRequest(ctx, r, entry)
}

// LogFailure logs a failed operation
func (al *AuditLogger) LogFailure(ctx context.Context, r *http.Request, entry *models.AuditLogEntry, errorMsg string) error {
	entry = entry.WithFailure(errorMsg)
	return al.LogFromRequest(ctx, r, entry)
}

// Global audit logger instance (initialized in main.go)
var GlobalAuditLogger *AuditLogger

// InitGlobalAuditLogger initializes the global audit logger
func InitGlobalAuditLogger(db *pgxpool.Pool) {
	GlobalAuditLogger = NewAuditLogger(db)
	log.Println("✅ Audit logger initialized")
}

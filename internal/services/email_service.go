package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/resend/resend-go/v2"
)

// EmailSender defines the interface for sending emails
type EmailSender interface {
	SendOTP(ctx context.Context, email, otp string) error
}

// ============================================================================
// Console Sender (Development Mode)
// ============================================================================

// ConsoleSender logs OTP codes to stdout - for development only
type ConsoleSender struct{}

// NewConsoleSender creates a new console email sender for development
func NewConsoleSender() EmailSender {
	log.Println("[EMAIL] Using Console Email Sender (Development Mode)")
	return &ConsoleSender{}
}

// SendOTP logs the OTP to console instead of sending an email
func (s *ConsoleSender) SendOTP(ctx context.Context, email, otp string) error {
	// Log to stdout with clear formatting
	log.Printf("\n"+
		"╔═══════════════════════════════════════════════════════════════╗\n"+
		"║                    [DEV MODE] OTP EMAIL                       ║\n"+
		"╠═══════════════════════════════════════════════════════════════╣\n"+
		"║ To:      %-52s ║\n"+
		"║ Code:    %-52s ║\n"+
		"║ Expires: %-52s ║\n"+
		"╚═══════════════════════════════════════════════════════════════╝\n",
		email, otp, "10 minutes")

	return nil
}

// ============================================================================
// Resend Sender (Production Mode)
// ============================================================================

// ResendSender sends emails via the Resend API
type ResendSender struct {
	client      *resend.Client
	fromAddress string
}

// NewResendSender creates a new Resend email sender for production
func NewResendSender(apiKey, fromAddress string) (EmailSender, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("RESEND_API_KEY is required for production email sending")
	}
	if fromAddress == "" {
		return nil, fmt.Errorf("EMAIL_FROM_ADDRESS is required for production email sending")
	}

	// Validate email format (must contain @ and domain)
	if !contains(fromAddress, "@") {
		return nil, fmt.Errorf("EMAIL_FROM_ADDRESS must be a valid email (e.g., noreply@%s)", fromAddress)
	}

	client := resend.NewClient(apiKey)
	log.Printf("[EMAIL] Using Resend Email Sender (Production Mode) - From: %s", fromAddress)

	return &ResendSender{
		client:      client,
		fromAddress: fromAddress,
	}, nil
}

// contains is a helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
		findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// SendOTP sends an OTP code via Resend API
func (s *ResendSender) SendOTP(ctx context.Context, email, otp string) error {
	// Build email content
	subject := "Your Verification Code"
	htmlBody := s.buildOTPEmailHTML(otp)
	textBody := s.buildOTPEmailText(otp)

	// Create email params
	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{email},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	}

	// Send email with timeout
	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sent, err := s.client.Emails.SendWithContext(sendCtx, params)
	if err != nil {
		return fmt.Errorf("failed to send OTP email via Resend: %w", err)
	}

	log.Printf("[EMAIL] OTP sent successfully to %s (Message ID: %s)", email, sent.Id)
	return nil
}

// buildOTPEmailHTML creates the HTML version of the OTP email
func (s *ResendSender) buildOTPEmailHTML(otp string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-top: 0;">Your Verification Code</h2>
        <p>You requested a verification code to reset your password. Please use the code below:</p>

        <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3498db; font-size: 32px; letter-spacing: 5px; margin: 0;">%s</h1>
        </div>

        <p><strong>This code will expire in 10 minutes.</strong></p>

        <p>If you didn't request this code, you can safely ignore this email.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="font-size: 12px; color: #888;">
            This is an automated message, please do not reply to this email.
        </p>
    </div>
</body>
</html>
`, otp)
}

// buildOTPEmailText creates the plain text version of the OTP email
func (s *ResendSender) buildOTPEmailText(otp string) string {
	return fmt.Sprintf(`Your Verification Code

You requested a verification code to reset your password. Please use the code below:

%s

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

---
This is an automated message, please do not reply to this email.
`, otp)
}

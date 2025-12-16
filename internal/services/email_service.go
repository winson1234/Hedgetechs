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
	SendDepositApproved(ctx context.Context, email, referenceID, currency string, amount float64) error
	SendDepositRejected(ctx context.Context, email, referenceID, currency string, amount float64, reason string) error
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

// SendDepositApproved logs deposit approval notification to console
func (s *ConsoleSender) SendDepositApproved(ctx context.Context, email, referenceID, currency string, amount float64) error {
	log.Printf("\n"+
		"╔═══════════════════════════════════════════════════════════════╗\n"+
		"║              [DEV MODE] DEPOSIT APPROVED EMAIL                ║\n"+
		"╠═══════════════════════════════════════════════════════════════╣\n"+
		"║ To:         %-49s ║\n"+
		"║ Reference:  %-49s ║\n"+
		"║ Amount:     %-49s ║\n"+
		"║ Status:     %-49s ║\n"+
		"╚═══════════════════════════════════════════════════════════════╝\n",
		email, referenceID, fmt.Sprintf("%.2f %s", amount, currency), "✓ APPROVED - Wallet Credited")

	return nil
}

// SendDepositRejected logs deposit rejection notification to console
func (s *ConsoleSender) SendDepositRejected(ctx context.Context, email, referenceID, currency string, amount float64, reason string) error {
	log.Printf("\n"+
		"╔═══════════════════════════════════════════════════════════════╗\n"+
		"║              [DEV MODE] DEPOSIT REJECTED EMAIL                ║\n"+
		"╠═══════════════════════════════════════════════════════════════╣\n"+
		"║ To:         %-49s ║\n"+
		"║ Reference:  %-49s ║\n"+
		"║ Amount:     %-49s ║\n"+
		"║ Status:     %-49s ║\n"+
		"║ Reason:     %-49s ║\n"+
		"╚═══════════════════════════════════════════════════════════════╝\n",
		email, referenceID, fmt.Sprintf("%.2f %s", amount, currency), "✗ REJECTED", reason)

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

// SendDepositApproved sends a deposit approval notification via Resend API
func (s *ResendSender) SendDepositApproved(ctx context.Context, email, referenceID, currency string, amount float64) error {
	subject := "Deposit Approved - Funds Credited"
	htmlBody := s.buildDepositApprovedEmailHTML(referenceID, currency, amount)
	textBody := s.buildDepositApprovedEmailText(referenceID, currency, amount)

	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{email},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	}

	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sent, err := s.client.Emails.SendWithContext(sendCtx, params)
	if err != nil {
		return fmt.Errorf("failed to send deposit approved email via Resend: %w", err)
	}

	log.Printf("[EMAIL] Deposit approved notification sent to %s (Message ID: %s)", email, sent.Id)
	return nil
}

// SendDepositRejected sends a deposit rejection notification via Resend API
func (s *ResendSender) SendDepositRejected(ctx context.Context, email, referenceID, currency string, amount float64, reason string) error {
	subject := "Deposit Not Approved"
	htmlBody := s.buildDepositRejectedEmailHTML(referenceID, currency, amount, reason)
	textBody := s.buildDepositRejectedEmailText(referenceID, currency, amount, reason)

	params := &resend.SendEmailRequest{
		From:    s.fromAddress,
		To:      []string{email},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	}

	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sent, err := s.client.Emails.SendWithContext(sendCtx, params)
	if err != nil {
		return fmt.Errorf("failed to send deposit rejected email via Resend: %w", err)
	}

	log.Printf("[EMAIL] Deposit rejected notification sent to %s (Message ID: %s)", email, sent.Id)
	return nil
}

// buildDepositApprovedEmailHTML creates the HTML version of deposit approval email
func (s *ResendSender) buildDepositApprovedEmailHTML(referenceID, currency string, amount float64) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit Approved</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2ecc71; margin-top: 0;">✓ Deposit Approved</h2>
        <p>Good news! Your deposit has been approved and the funds have been credited to your wallet.</p>

        <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <table style="width: 100%%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Reference ID:</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">%s</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #2ecc71; font-size: 18px;"><strong>%.2f %s</strong></td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>Status:</strong></td>
                    <td style="padding: 10px 0; text-align: right; color: #2ecc71;"><strong>Approved</strong></td>
                </tr>
            </table>
        </div>

        <p>You can now use these funds for trading. Thank you for choosing our platform!</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="font-size: 12px; color: #888;">
            This is an automated message, please do not reply to this email.
        </p>
    </div>
</body>
</html>
`, referenceID, amount, currency)
}

// buildDepositApprovedEmailText creates the plain text version of deposit approval email
func (s *ResendSender) buildDepositApprovedEmailText(referenceID, currency string, amount float64) string {
	return fmt.Sprintf(`Deposit Approved

Good news! Your deposit has been approved and the funds have been credited to your wallet.

Reference ID: %s
Amount: %.2f %s
Status: Approved

You can now use these funds for trading. Thank you for choosing our platform!

---
This is an automated message, please do not reply to this email.
`, referenceID, amount, currency)
}

// buildDepositRejectedEmailHTML creates the HTML version of deposit rejection email
func (s *ResendSender) buildDepositRejectedEmailHTML(referenceID, currency string, amount float64, reason string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit Not Approved</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #e74c3c; margin-top: 0;">Deposit Not Approved</h2>
        <p>We regret to inform you that your deposit request could not be approved.</p>

        <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <table style="width: 100%%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Reference ID:</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">%s</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">%.2f %s</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #e74c3c;"><strong>Rejected</strong></td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>Reason:</strong></td>
                    <td style="padding: 10px 0; text-align: right;">%s</td>
                </tr>
            </table>
        </div>

        <p>If you believe this is an error or have questions, please contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="font-size: 12px; color: #888;">
            This is an automated message, please do not reply to this email.
        </p>
    </div>
</body>
</html>
`, referenceID, amount, currency, reason)
}

// buildDepositRejectedEmailText creates the plain text version of deposit rejection email
func (s *ResendSender) buildDepositRejectedEmailText(referenceID, currency string, amount float64, reason string) string {
	return fmt.Sprintf(`Deposit Not Approved

We regret to inform you that your deposit request could not be approved.

Reference ID: %s
Amount: %.2f %s
Status: Rejected
Reason: %s

If you believe this is an error or have questions, please contact our support team.

---
This is an automated message, please do not reply to this email.
`, referenceID, amount, currency, reason)
}

package otp

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// OTPProvider is a swappable interface for sending OTPs.
type OTPProvider interface {
	SendOTP(ctx context.Context, phoneNumber, otp string) error
}

// ─── Console (local dev stub) ─────────────────────────────────────────────────

type ConsoleProvider struct{}

func (c *ConsoleProvider) SendOTP(_ context.Context, phone, otp string) error {
	log.Printf("[OTP STUB] Phone: %s  OTP: %s", phone, otp)
	return nil
}

// ─── 2Factor.in ───────────────────────────────────────────────────────────────

type TwoFactorProvider struct {
	APIKey string
}

func (t *TwoFactorProvider) SendOTP(ctx context.Context, phoneNumber, otp string) error {
	// API: GET https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}
	apiURL := fmt.Sprintf(
		"https://2factor.in/API/V1/%s/SMS/%s/%s",
		url.PathEscape(t.APIKey),
		url.PathEscape(phoneNumber),
		url.PathEscape(otp),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return fmt.Errorf("building 2factor request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling 2factor API: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("2factor returned HTTP %d: %s", resp.StatusCode, bodyStr)
	}

	// 2factor returns JSON with Status field
	if strings.Contains(bodyStr, `"Status":"Error"`) {
		return fmt.Errorf("2factor error: %s", bodyStr)
	}

	log.Printf("[2Factor] OTP sent to %s", phoneNumber)
	return nil
}

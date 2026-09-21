package otp

import (
	"bytes"
	"context"
	"encoding/json"
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

// ─── Msg91 ────────────────────────────────────────────────────────────────────

type Msg91Provider struct {
	AuthKey    string
	TemplateID string
}

func (m *Msg91Provider) SendOTP(ctx context.Context, phoneNumber, otp string) error {
	// API: POST https://control.msg91.com/api/v5/otp
	apiURL := "https://control.msg91.com/api/v5/otp"

	payload := map[string]string{
		"template_id": m.TemplateID,
		"mobile":      phoneNumber,
		"otp":         otp,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshalling msg91 payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("building msg91 request: %w", err)
	}

	req.Header.Set("authkey", m.AuthKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling msg91 API: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	// msg91 uses 200 OK for successful requests
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("msg91 returned HTTP %d: %s", resp.StatusCode, bodyStr)
	}

	if strings.Contains(bodyStr, `"type":"error"`) {
		return fmt.Errorf("msg91 error: %s", bodyStr)
	}

	log.Printf("[Msg91] OTP sent to %s", phoneNumber)
	return nil
}

package razorpay

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"codon-backend/internal/config"
)

const baseURL = "https://api.razorpay.com/v1"

type Client struct {
	keyID     string
	keySecret string
}

var DefaultClient *Client

func Init() {
	DefaultClient = &Client{
		keyID:     config.AppConfig.RazorpayKeyID,
		keySecret: config.AppConfig.RazorpayKeySecret,
	}
}

type CreateOrderRequest struct {
	Amount   int64  `json:"amount"`   // in paise
	Currency string `json:"currency"` // "INR"
	Receipt  string `json:"receipt"`  // internal reference
}

type Order struct {
	ID       string `json:"id"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	Status   string `json:"status"`
	Receipt  string `json:"receipt"`
}

func (c *Client) KeyID() string { return c.keyID }

func (c *Client) CreateOrder(req CreateOrderRequest) (*Order, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequest(http.MethodPost, baseURL+"/orders", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("building order request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.SetBasicAuth(c.keyID, c.keySecret)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling Razorpay: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Razorpay order error %d: %s", resp.StatusCode, respBody)
	}

	var order Order
	if err := json.Unmarshal(respBody, &order); err != nil {
		return nil, fmt.Errorf("parsing Razorpay order response: %w", err)
	}
	return &order, nil
}

// VerifyPaymentSignature verifies the Razorpay payment signature.
// signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
func VerifyPaymentSignature(orderID, paymentID, signature string) bool {
	mac := hmac.New(sha256.New, []byte(config.AppConfig.RazorpayKeySecret))
	mac.Write([]byte(orderID + "|" + paymentID))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// VerifyWebhookSignature verifies the Razorpay webhook signature.
func VerifyWebhookSignature(body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(config.AppConfig.RazorpayWebhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

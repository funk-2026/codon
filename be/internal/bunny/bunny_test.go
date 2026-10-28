package bunny_test

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"testing"
	"time"

	"codon-backend/internal/bunny"
	"codon-backend/internal/config"
)

func TestGenerateTUSAuth(t *testing.T) {
	config.AppConfig.BunnyStreamLibraryID = "12345"
	config.AppConfig.BunnyStreamAPIKey = "test-api-key"
	config.AppConfig.BunnyStreamCDNHost = "video.example.com"

	videoGUID := "abcd-1234-efgh"
	auth := bunny.GenerateTUSAuth(videoGUID, 15*time.Minute)

	if auth.LibraryID != "12345" {
		t.Errorf("expected library ID 12345, got %s", auth.LibraryID)
	}
	if auth.VideoID != videoGUID {
		t.Errorf("expected video ID %s, got %s", videoGUID, auth.VideoID)
	}

	// Verify SHA-256 calculation: library_id + api_key + expiration_time + video_id
	expectedRaw := "12345test-api-key" + strconv.FormatInt(auth.Expires, 10) + videoGUID
	h := sha256.Sum256([]byte(expectedRaw))
	expectedSig := hex.EncodeToString(h[:])

	if auth.Signature != expectedSig {
		t.Errorf("expected signature %s, got %s", expectedSig, auth.Signature)
	}
}

func TestPlaybackURL(t *testing.T) {
	config.AppConfig.BunnyStreamLibraryID = "12345"
	config.AppConfig.BunnyStreamCDNHost = "vz-12345.b-cdn.net"

	url := bunny.PlaybackURL("video-guid-999")
	expected := "https://vz-12345.b-cdn.net/video-guid-999/playlist.m3u8"
	if url != expected {
		t.Errorf("expected %s, got %s", expected, url)
	}
}


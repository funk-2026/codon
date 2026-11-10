package services

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"codon-backend/internal/clock"
	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PushMessage is one outbound push.
type PushMessage struct {
	To    string                 `json:"to"`
	Title string                 `json:"title"`
	Body  string                 `json:"body"`
	Data  map[string]interface{} `json:"data,omitempty"`
}

// PushResult is the delivery outcome of one message.
type PushResult struct {
	OK    bool
	Error string // e.g. "DeviceNotRegistered"
}

// PushSender delivers messages (Expo in production, a fake in tests).
type PushSender interface {
	Send(ctx context.Context, msgs []PushMessage) ([]PushResult, error)
}

// ExpoSender posts to the Expo push service.
type ExpoSender struct {
	Client *http.Client
	URL    string
}

func NewExpoSender() *ExpoSender {
	return &ExpoSender{Client: &http.Client{Timeout: 15 * time.Second}, URL: "https://exp.host/--/api/v2/push/send"}
}

func (e *ExpoSender) Send(ctx context.Context, msgs []PushMessage) ([]PushResult, error) {
	if len(msgs) == 0 {
		return nil, nil
	}
	body, _ := json.Marshal(msgs)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.URL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := e.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out struct {
		Data []struct {
			Status  string `json:"status"`
			Message string `json:"message"`
			Details struct {
				Error string `json:"error"`
			} `json:"details"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	res := make([]PushResult, len(msgs))
	for i := range msgs {
		if i < len(out.Data) {
			res[i] = PushResult{OK: out.Data[i].Status == "ok", Error: out.Data[i].Details.Error}
		}
	}
	return res, nil
}

type PushService struct {
	DB     *gorm.DB
	Sender PushSender
}

func NewPushService(db *gorm.DB, sender PushSender) *PushService {
	return &PushService{DB: db, Sender: sender}
}

// prefAllows maps a notification type to the user's opt-in.
func prefAllows(p models.NotificationPref, typ string) bool {
	if !p.PushEnabled {
		return false
	}
	switch {
	case strings.HasPrefix(typ, "report_"), strings.HasPrefix(typ, "correction_"):
		return p.ReportUpdates
	case typ == "streak_nudge":
		return p.StreakNudges
	}
	return true
}

// Dispatch pushes not-yet-pushed notifications (created in the last 24 h) to
// each user's registered devices, honouring their preferences. Unregistered
// device tokens are removed. Notifications stay readable in-app regardless.
func (s *PushService) Dispatch(ctx context.Context, limit int) (int, error) {
	var ns []models.Notification
	if err := s.DB.WithContext(ctx).Where("pushed_at IS NULL AND created_at > ?", time.Now().Add(-24*time.Hour)).
		Order("created_at ASC").Limit(limit).Find(&ns).Error; err != nil {
		return 0, err
	}
	// Load every recipient's preferences and device tokens in two queries
	// instead of two per notification.
	userIDs := make([]uuid.UUID, 0, len(ns))
	seen := map[uuid.UUID]bool{}
	for _, n := range ns {
		if !seen[n.UserID] {
			seen[n.UserID] = true
			userIDs = append(userIDs, n.UserID)
		}
	}
	prefs := map[uuid.UUID]models.NotificationPref{}
	tokens := map[uuid.UUID][]models.PushToken{}
	if len(userIDs) > 0 {
		var ps []models.NotificationPref
		s.DB.WithContext(ctx).Where("user_id IN ?", userIDs).Find(&ps)
		for _, p := range ps {
			prefs[p.UserID] = p
		}
		var ts []models.PushToken
		s.DB.WithContext(ctx).Where("user_id IN ?", userIDs).Find(&ts)
		for _, t := range ts {
			tokens[t.UserID] = append(tokens[t.UserID], t)
		}
	}
	sent := 0
	for _, n := range ns {
		pref, ok := prefs[n.UserID]
		if !ok {
			pref = models.NotificationPref{UserID: n.UserID, PushEnabled: true, StreakNudges: true, ReportUpdates: true}
		}
		var toks []models.PushToken
		if prefAllows(pref, n.Type) {
			toks = tokens[n.UserID]
		}
		if len(toks) > 0 && s.Sender != nil {
			data := map[string]interface{}{"type": n.Type, "notification_id": n.ID}
			if len(n.Data) > 0 {
				var extra map[string]interface{}
				if json.Unmarshal(n.Data, &extra) == nil {
					for k, v := range extra {
						data[k] = v
					}
				}
			}
			msgs := make([]PushMessage, len(toks))
			for i, t := range toks {
				msgs[i] = PushMessage{To: t.Token, Title: n.Title, Body: n.Body, Data: data}
			}
			res, err := s.Sender.Send(ctx, msgs)
			if err != nil {
				log.Printf("[push] send failed: %v", err) // leave pushed_at NULL → retried next tick
				continue
			}
			for i, r := range res {
				if r.Error == "DeviceNotRegistered" {
					s.DB.WithContext(ctx).Where("token = ?", toks[i].Token).Delete(&models.PushToken{})
				}
			}
			sent++
		}
		now := time.Now()
		s.DB.WithContext(ctx).Model(&models.Notification{}).Where("id = ?", n.ID).Update("pushed_at", now)
	}
	return sent, nil
}

// StreakNudges creates a "keep your streak" notification for students who
// practised yesterday (streak ≥ 2) but not yet today, during the IST evening
// (18:00–21:59), at most once a day. Returns how many were created.
func (s *PushService) StreakNudges(ctx context.Context, now time.Time) int {
	local := now.In(clock.AppZone)
	if h := local.Hour(); h < 18 || h > 21 {
		return 0
	}
	today := clock.AppDay(now)
	startOfDay, _ := clock.StartOfAppDay(now)
	var users []uuid.UUID
	s.DB.WithContext(ctx).Raw(`SELECT DISTINCT d.user_id FROM daily_activities d
		JOIN push_tokens p ON p.user_id = d.user_id
		LEFT JOIN notification_prefs np ON np.user_id = d.user_id
		WHERE d.date = ? AND COALESCE(np.push_enabled, true) AND COALESCE(np.streak_nudges, true)
		  AND NOT EXISTS (SELECT 1 FROM daily_activities t WHERE t.user_id = d.user_id AND t.date = ?)
		  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = d.user_id AND n.type = 'streak_nudge' AND n.created_at >= ?)`,
		today.AddDate(0, 0, -1), today, startOfDay).Scan(&users)
	created := 0
	for _, u := range users {
		active, err := ActiveDays(ctx, s.DB, u, now, 60)
		if err != nil {
			continue
		}
		streak := Streak(active, now)
		if streak < 2 {
			continue
		}
		Notify(s.DB, u, "streak_nudge", "Keep your streak alive 🔥", "You're on a "+strconv.Itoa(streak)+"-day streak — a few questions today keeps it going.",
			map[string]interface{}{"streak": streak})
		created++
	}
	return created
}

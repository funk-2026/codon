// Package clock is the single definition of time for the backend: what "now"
// is, and — more importantly — what "a day" is. Streaks, daily quotas and
// nudges must all agree on the same day boundary (the app's home timezone,
// IST), otherwise activity between 00:00 and 05:30 IST is booked on the wrong
// day.
package clock

import "time"

// AppZone is the timezone that defines a "day" for users.
var AppZone = time.FixedZone("IST", 5*3600+1800)

// Now returns the current time. Tests may replace it.
var Now = time.Now

// AppDay returns the calendar date of t in AppZone as a date-only value
// (00:00 UTC of that date), suitable for a Postgres DATE column.
func AppDay(t time.Time) time.Time {
	l := t.In(AppZone)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC)
}

// StartOfAppDay returns the instant (UTC) at which t's app-day started and the
// instant the next one starts. Use for created_at / timestamptz comparisons.
func StartOfAppDay(t time.Time) (start, next time.Time) {
	l := t.In(AppZone)
	s := time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, AppZone)
	return s.UTC(), s.AddDate(0, 0, 1).UTC()
}

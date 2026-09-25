package router_test

import (
	"os"
	"sort"
	"sync"
	"testing"
	"time"

	"codon-backend/internal/blueprint"
	"codon-backend/internal/generation"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

// TestGenerationLoad (BE-3.18) is opt-in: LOAD_TEST=1 go test -run GenerationLoad -v
// It seeds a 100 000-question pool and runs concurrent generations.
func TestGenerationLoad(t *testing.T) {
	if os.Getenv("LOAD_TEST") == "" {
		t.Skip("set LOAD_TEST=1 to run the generation load test")
	}
	e := newEnv(t)
	e.set("custom_test.enabled", "true")
	e.set("custom_test.free_daily_generations", "100000")
	e.set("custom_test.generate_rate_per_hour", "100000")
	e.set("custom_test.free_max_questions", "90")
	test := e.w.Test(t, models.ModuleQBank, 0, true)
	const N = 100000
	if err := e.db.Exec(`
		INSERT INTO questions (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index, content_format,
			subject_id, chapter_id, difficulty, source_type, custom_eligible, question_type, version, lang, flag_status, content_hash, created_at, updated_at)
		SELECT gen_random_uuid(), ?, 'Question '||g, 'a','b','c','d','B', g, 'plain', ?, ?, (ARRAY['easy','medium','hard'])[1+g%3],
		       'qbank', true, 'mcq_single', 1, 'en', 'active', md5(g::text), now(), now()
		FROM generate_series(1, ?) g`, test.ID, e.w.Subject.ID, e.w.Chapter.ID, N).Error; err != nil {
		t.Fatal(err)
	}
	e.db.Exec(`INSERT INTO test_questions (test_id, question_id, position) SELECT test_id, id, order_index FROM questions WHERE test_id = ?`, test.ID)
	e.db.Exec("ANALYZE")

	eng := generation.NewEngine(e.db, services.NewSubscriptionService(e.db), nil)
	users := make([]models.User, 100)
	for i := range users {
		users[i] = e.w.User(t, models.RoleStudent)
	}
	req := blueprint.Blueprint{SchemaVersion: 1, CourseID: e.w.Course.ID, Count: 30,
		DifficultyMix: map[string]float64{"easy": 0.3, "medium": 0.4, "hard": 0.3}}
	if is := blueprint.Normalize(&req, generation.Limits()); len(is) > 0 {
		t.Fatal(is)
	}

	var mu sync.Mutex
	var lat []time.Duration
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20) // 20 concurrent generations
	for i := range users {
		wg.Add(1)
		sem <- struct{}{}
		go func(u *models.User) {
			defer wg.Done()
			defer func() { <-sem }()
			start := time.Now()
			res, err := eng.Generate(nil2(), u, req, "", nil)
			d := time.Since(start)
			if err != nil {
				t.Errorf("generate: %v", err)
				return
			}
			if res.Test.TotalQuestions != 30 {
				t.Errorf("got %d questions", res.Test.TotalQuestions)
			}
			mu.Lock()
			lat = append(lat, d)
			mu.Unlock()
		}(&users[i])
	}
	wg.Wait()
	sort.Slice(lat, func(i, j int) bool { return lat[i] < lat[j] })
	p50, p95 := lat[len(lat)/2], lat[len(lat)*95/100]
	t.Logf("pool=%d  generations=%d  p50=%v  p95=%v  max=%v", N, len(lat), p50, p95, lat[len(lat)-1])
	// unloaded single-request latency
	start := time.Now()
	if _, err := eng.Generate(nil2(), &users[0], req, "", nil); err != nil {
		t.Fatal(err)
	}
	unloaded := time.Since(start)
	t.Logf("unloaded generation: %v", unloaded)
	if unloaded > 500*time.Millisecond {
		t.Errorf("unloaded generation %v exceeds the 500ms budget", unloaded)
	}
	cs := time.Now()
	if _, err := eng.Count(nil2(), &users[0], req); err != nil {
		t.Fatal(err)
	}
	t.Logf("count: %v", time.Since(cs))
}

package router_test

import "testing"

// A teacher adds a Brain Hack video, an admin approves it, and students see it under Videos but not under Articles.
func TestBrainHackVideos(t *testing.T) {
	e := newEnv(t)
	tch, a, s := &e.w.Teacher, &e.w.Admin, &e.w.Student

	if code, _ := e.do("POST", "/teacher/brain-hacks", tch, map[string]interface{}{"title": "Bad link", "category": "Sleep", "kind": "video", "video_url": "http://insecure/x.mp4"}); code != 400 {
		t.Fatalf("video links must be https: %d", code)
	}
	if code, _ := e.do("POST", "/teacher/brain-hacks", tch, map[string]interface{}{"title": "Nonsense", "category": "Sleep", "kind": "podcast", "body": "x"}); code != 400 {
		t.Fatalf("unknown kind: %d", code)
	}
	empty := e.mustDo(201, "POST", "/teacher/brain-hacks", tch, map[string]interface{}{"title": "No link yet", "category": "Sleep", "kind": "video"})
	if code, _ := e.do("POST", "/teacher/brain-hacks/"+str(empty, "brain_hack", "id")+"/submit-for-review", tch, nil); code != 422 {
		t.Fatalf("a video without a link cannot be submitted: %d", code)
	}

	v := e.mustDo(201, "POST", "/teacher/brain-hacks", tch, map[string]interface{}{
		"title": "Wind down in two minutes", "category": "Sleep", "kind": "video", "video_url": "https://cdn.example.com/sleep.mp4", "duration_seconds": 120})
	vid := str(v, "brain_hack", "id")
	art := e.mustDo(201, "POST", "/teacher/brain-hacks", tch, map[string]interface{}{"title": "Sleep tips", "category": "Sleep", "body": "Go to bed on time."})
	aid := str(art, "brain_hack", "id")
	for _, id := range []string{vid, aid} {
		e.mustDo(200, "POST", "/teacher/brain-hacks/"+id+"/submit-for-review", tch, nil)
		e.mustDo(200, "POST", "/admin/brain-hacks/"+id+"/approve", a, nil)
		e.mustDo(200, "POST", "/teacher/brain-hacks/"+id+"/publish", tch, nil)
	}

	videos := e.mustDo(200, "GET", "/brain-hacks?kind=video&category=Sleep", s, nil)["brain_hacks"].([]interface{})
	if len(videos) != 1 || str(videos[0].(map[string]interface{}), "video_url") != "https://cdn.example.com/sleep.mp4" || num(videos[0].(map[string]interface{}), "duration_seconds") != 120 {
		t.Fatalf("videos: %v", videos)
	}
	articles := e.mustDo(200, "GET", "/brain-hacks?kind=article&category=Sleep", s, nil)["brain_hacks"].([]interface{})
	if len(articles) != 1 || str(articles[0].(map[string]interface{}), "id") != aid {
		t.Fatalf("articles: %v", articles)
	}
	cats := e.mustDo(200, "GET", "/brain-hacks/categories", s, nil)["categories"].([]interface{})
	if len(cats) < 4 || cats[0] != "Speed Reading" {
		t.Fatalf("the four categories lead: %v", cats)
	}
}

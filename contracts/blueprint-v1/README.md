# Custom-test blueprint v1

A blueprint is the declarative description of a custom test a student asks for
(filters, count, difficulty mix, mode, timing, marking). It is stored on the
generated test and can be saved as a template, re-run, or shared.

```jsonc
{
  "schema_version": 1,
  "course_id": "uuid",
  "title": "optional (auto-titled when empty)",
  "filters": {                                  // unknown keys here are rejected (422 unknown_filter)
    "subject_ids": [], "chapter_ids": [], "topic_ids": [],
    "difficulty": ["easy","medium","hard"],
    "status": ["unattempted","incorrect","correct","bookmarked"],   // union
    "bookmark_collection_ids": [],              // only with status "bookmarked"
    "tag_ids": [], "exclude_tag_ids": [],
    "source_types": ["qbank","practice","pyq"], // test_series is not allowed by default
    "ncert": {"class": 11, "page_from": 40, "page_to": 60},
    "exclude_attempted_within_days": 7
  },
  "count": 20,
  "difficulty_mix": {"easy":0.3,"medium":0.5,"hard":0.2},
  "subject_weights": "even" | "proportional" | {"<subject_id>": 0.5},
  "order": "random|syllabus|easy_first|hard_first|unattempted_first",
  "strategy": "random|weak_first|unseen_first|spaced",
  "fallback": "fewer|fail",
  "mode": "exam|tutor",
  "timing": {"timed": true, "duration_minutes": 20},
  "marking": {"preset": "neet|no_negative|custom", "correct": 4, "wrong": -1},
  "seed": 12345
}
```

Unknown top-level fields are ignored (forward compatible). A `schema_version`
newer than the server knows is rejected (`unsupported_schema_version`).
`vectors.json` is shared by the Go tests and the app's tests.

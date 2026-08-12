# Codon Implementation Plan V2 — Curriculum Hierarchy

This document outlines the changes required to migrate the Codon backend from a flat `topic` string structure to a strict, relational **Course → Subject → Chapter** hierarchy.

## 1. Database Schema Additions & Modifications

We will introduce `Subject` and `Chapter` models and modify `ContentItem` and `Test` to reference them.

### New Models (`internal/models/models.go`)

```go
type Subject struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID    uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Course      Course    `gorm:"foreignKey:CourseID" json:"-"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Chapter struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SubjectID   uuid.UUID `gorm:"type:uuid;not null;index" json:"subject_id"`
	Subject     Subject   `gorm:"foreignKey:SubjectID" json:"-"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

### Model Updates (`internal/models/models.go`)

**1. ContentItem (Required Chapter)**
* Remove `Topic *string`
* Add `ChapterID uuid.UUID` (Not null)
* Add `Chapter Chapter` (foreign key)

**2. Test (Nullable Hierarchy for flexibility)**
* Remove `Topic *string`
* Add `SubjectID *uuid.UUID` (Optional - for subject-level tests)
* Add `Subject *Subject` (foreign key)
* Add `ChapterID *uuid.UUID` (Optional - for chapter-level tests)
* Add `Chapter *Chapter` (foreign key)
*(Note: If both SubjectID and ChapterID are null, it is considered a Grand/Full-Syllabus test).*

### Database Registration (`internal/db/db.go`)
* Add `&models.Subject{}` and `&models.Chapter{}` to the `db.AutoMigrate(...)` list.

---

## 2. API Endpoints: Subjects & Chapters (CRUD)

Create a new handler `internal/handlers/curriculum.go`.

### Admin Endpoints (Managing Curriculum)
* `POST /admin/courses/:id/subjects` — Create a new subject (requires `name`, `order_index`).
* `PATCH /admin/subjects/:id` — Update subject (name, order_index).
* `POST /admin/subjects/:id/chapters` — Create a new chapter.
* `PATCH /admin/chapters/:id` — Update chapter.
*(Soft deletes can be added later if necessary).*

### Student Endpoints (Consuming Curriculum)
* `GET /courses/:id/curriculum` — Fetches the entire nested hierarchy.
  * **Response shape:** `Course { Subjects: [ { Chapters: [ ... ] } ] }`
  * This allows the frontend to build the UI with a single API call.

---

## 3. Modifying Existing Handlers

### Tests (`internal/handlers/tests.go`)
* **Create/Update Requests:** Remove `topic`. Add `subject_id` (optional) and `chapter_id` (optional).
* **List Filtering:** Add `subject_id` and `chapter_id` to query parameters in `ListTests`.

### Content Items (`internal/handlers/content.go`)
* **Create/Update Requests:** Remove `topic`. Add `chapter_id` (required).
* **List Filtering:** Add `chapter_id` to query parameters.

---

## 4. Swagger Fixes (BasePath Issue)

The Swagger UI currently does not automatically prepend `/api/v1` to the request URLs. 
To fix this, we will explicitly include the `/api/v1` prefix directly in the `@Router` annotations for every handler, completely bypassing the buggy behavior of `@BasePath`. 

**Example:**
Change: `@Router /auth/otp/send [post]`
To: `@Router /api/v1/auth/otp/send [post]`
*(This guarantees the "Try it out" button in Swagger hits the exact correct URL on the Gin server).*

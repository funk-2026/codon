# Codon — Upload manual (questions CSV, image ZIP, videos)

For teachers and admins. All limits below are the defaults; admins can change them in **Custom Tests & Pool → Media & uploads**.

## 1. Bulk questions with CSV

**Where:** while creating a test → **Bulk Upload via CSV**, or open a draft test → Question builder → **Import CSV**.

### Steps
1. Tap **Download template** — a CSV with the correct header and one example row.
2. Fill it in (Excel / Google Sheets → *Save as CSV, UTF-8*). One row = one question.
3. In the app: **choose your CSV** → optionally **choose a ZIP of images** (section 2).
4. Tap **Check my file**. Nothing is saved yet — you get a report: rows OK, **errors** (row + column + reason), **warnings**, **missing images**, **unused images**.
5. Fix and re-check, or tap **Import N** to save the valid rows.

### Columns
**Required**
| Column | What to put | Example |
|---|---|---|
| `question_text` | The question | Which organelle is the powerhouse of the cell? |
| `option_a` … `option_d` | The four options | Mitochondria |
| `correct_option` | `A`, `B`, `C` or `D` | B |

**Optional** (adding any of these switches the file to the full template)
| Column | Values | Example |
|---|---|---|
| `explanation` | Shown after the test | Mitochondria make ATP. |
| `subject`, `chapter` | Name or id; default = the test's | Biology / Cell Structure |
| `topic` | Topic name in that chapter | Organelles |
| `difficulty` | `easy` `medium` `hard` — **needed to submit Q Bank / Practice tests** | medium |
| `ncert_class`, `ncert_page` | 1–12, page number | 11, 132 |
| `tags` | Separate with `\|` | cell\|organelle |
| `source_type` | `qbank` `practice` `test_series` `pyq` `other` | pyq |
| `source_year` | For previous-year questions | 2021 |
| `custom_eligible` | `true` / `false` — usable in students' custom tests | true |
| `question_image`, `option_a_image` … `option_d_image`, `explanation_image` | Image **file name** | cell.png |
| `question_image_alt`, `option_a_image_alt` … `explanation_image_alt` | What the image shows (recommended) | Cross-section of a cell |
| `question_id` | Update mode only (below) — optional if `question_text` matches exactly | |

**Formatting inside any text column:** `**bold**`, `*italic*`, `H~2~O` (subscript), `x^2^` (superscript), `$\frac{1}{2}mv^2$` (formula), `$\ce{2H2 + O2 -> 2H2O}$` (chemistry), lines starting `- ` (list). Links and HTML are not allowed.

### Limits
- Up to **2000 rows** per import.
- Question ≤ 4000 characters, each option ≤ 1000, explanation ≤ 6000.
- At most 2 images per field and 6 per question.

### Updating existing questions (bulk fixes)
Switch on **Update existing questions**. Each row finds its question by `question_id`, or — if you leave that out — by an **exact match of `question_text`** (so you can re-upload your original sheet with corrected columns). Only the columns you fill are changed — ideal for fixing difficulty, chapter or tags on many questions. *(The app doesn't display question ids yet; match by text, or ask an admin for ids.)* To also change wording/answers, switch on **Also allow changing wording and answers**; for live questions those changes go to an admin as corrections.

### Common errors
| Message | Fix |
|---|---|
| missing required column | Header must contain the 6 required columns exactly as spelled |
| correct_option invalid | Use only A, B, C or D |
| image not found | File name in the CSV isn't in the ZIP (or your media library) — check spelling |
| too many rows | Split the file (max 2000) |

## 2. Images: the ZIP bundle

- Put all images into **one ZIP** (a folder named `images/` inside is fine — any folder works).
- The CSV refers to them by **file name only**, e.g. `cell.png` (not case-sensitive).
- An image not in the ZIP is looked up in **your media library** by the same file name, so images you uploaded before can be reused.
- Formats: **JPEG, PNG, WebP**. Each image ≤ **5 MB** and ≤ 4096 px on a side.
- ZIP ≤ **100 MB** and ≤ **1000 files**. (You may also put `questions.csv` inside the ZIP.)
- The check report lists **missing** (named in CSV, not found) and **unused** (in ZIP, never referenced) images.

**Example**
```
my-upload.zip
└── images/
    ├── cell.png
    └── mitochondria.jpg
```
CSV row: `question_image` = `cell.png`, `question_image_alt` = `Labelled diagram of an animal cell`.

**Adding a single image** instead: in the question editor tap the image button (gallery or camera). Big photos are shrunk automatically, iPhone HEIC photos are converted, and you're asked for alt text.

## 3. Videos and documents

**Where:** Upload tab → **New Video / Document** (or Home → New video/document).

1. Choose **Video** or **Document**.
2. **Title**, **Location in Course** (subject → chapter), optional topic and notes.
3. **Video:** tap to pick a video file from the phone — it uploads directly with a progress bar; if it fails, **Try again**. Keep the app open until it reaches 100 %.
   **Document:** write the text in the editor (saved as you type).
4. **Preview & Submit** → it goes to admin review → after approval, **Publish**.
5. Videos are processed after upload; students see "still processing" until it's ready, then it streams in adaptive quality.

Tips: use MP4 (H.264) for best compatibility; upload on Wi-Fi; one lesson per video.

### Lecture PDFs
- Two optional PDFs per video: **Notes** (available to students immediately) and **Annotated** (unlocks after the student watches ~90 % of the lecture).
- Attach on the New Video screen or later from the video preview (*Lecture PDFs* → Attach / Replace / Remove) — no re-review needed.
- PDF only, up to **50 MB** each.

## 4. Other uploads
- **Flashcards:** each card side can hold one image (Upload → Flashcard Decks).
- **Brain Hacks:** up to 3 images in the text.
- **Wellness articles (admins):** up to 4 images per article.

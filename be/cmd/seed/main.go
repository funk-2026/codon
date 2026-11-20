// Command seed fills a LOCAL development database with sample data so every role can be tried:
// users (student, teacher, admin), a NEET UG syllabus, QBank modules, Grand/Mini/Subject tests, a live exam,
// Schema topics, Pulse items, flashcards, Brain Hacks, a Home banner and message, and a subscription plan.
// It is safe to run twice: it skips anything that already exists. Never run it against production.
package main

import (
	"fmt"
	"log"
	"time"

	"codon-backend/internal/config"
	"codon-backend/internal/db"
	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	adminPhones = []string{"+917386868169", "7386868169"}
	teacherPh   = "+919000000002"
	studentPh   = "+919000000001"
)

type chapterSeed struct {
	Name   string
	Topics []topicSeed
}
type topicSeed struct {
	Name  string
	Years [][3]interface{} // year label, subtopic, questions
}

var syllabus = map[string][]chapterSeed{
	"Biology": {
		{"Cell: The Unit of Life", []topicSeed{{"Cell organelles", [][3]interface{}{{"2023", "", 3}, {"2022", "Mitochondria", 2}, {"2021", "", 1}}}, {"Cell cycle", [][3]interface{}{{"2023", "Mitosis", 2}, {"2022 Re", "", 1}}}}},
		{"Molecular Basis of Inheritance", []topicSeed{{"DNA replication", [][3]interface{}{{"2023", "", 4}, {"2021", "Okazaki fragments", 2}}}, {"Transcription", [][3]interface{}{{"2022", "", 2}}}}},
		{"Human Physiology", []topicSeed{{"Digestion", [][3]interface{}{{"2023", "", 2}}}, {"Circulation", [][3]interface{}{{"2022", "ECG", 3}, {"2021", "", 2}}}}},
	},
	"Chemistry": {
		{"Chemical Bonding", []topicSeed{{"VSEPR theory", [][3]interface{}{{"2023", "", 2}, {"2021", "", 2}}}, {"Hybridisation", [][3]interface{}{{"2022", "", 3}}}}},
		{"Equilibrium", []topicSeed{{"Le Chatelier", [][3]interface{}{{"2023", "", 2}}}, {"pH and buffers", [][3]interface{}{{"2022", "", 3}, {"2022 Re", "", 1}}}}},
		{"Organic Chemistry Basics", []topicSeed{{"Isomerism", [][3]interface{}{{"2023", "", 3}}}, {"Reaction mechanisms", [][3]interface{}{{"2021", "", 2}}}}},
	},
	"Physics": {
		{"Laws of Motion", []topicSeed{{"Newton's laws", [][3]interface{}{{"2023", "", 2}, {"2022", "", 1}}}, {"Friction", [][3]interface{}{{"2021", "", 2}}}}},
		{"Thermodynamics", []topicSeed{{"First law", [][3]interface{}{{"2023", "", 2}}}, {"Carnot engine", [][3]interface{}{{"2022", "", 2}, {"2021", "", 1}}}}},
		{"Optics", []topicSeed{{"Lenses", [][3]interface{}{{"2023", "", 3}, {"2022 Re", "", 1}}}, {"Wave optics", [][3]interface{}{{"2022", "", 2}}}}},
	},
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func user(g *gorm.DB, phone, name string, role models.UserRole) models.User {
	var u models.User
	if g.Where("phone_number = ?", phone).First(&u).Error == nil {
		g.Model(&u).Updates(map[string]interface{}{"role": role})
		return u
	}
	u = models.User{PhoneNumber: phone, Name: &name, Role: role, KYCStatus: models.KYCNotRequired}
	must(g.Create(&u).Error)
	return u
}

func main() {
	config.MustLoad()
	must(db.Connect())
	must(db.AutoMigrateAll())
	must(db.RunMigrations(db.DB))
	must(db.SeedAll(db.DB))
	g := db.DB
	if config.AppConfig.Env == "production" {
		log.Fatal("refusing to seed a production database")
	}

	var course models.Course
	must(g.Where("slug = ?", "neet-ug").First(&course).Error)
	for _, p := range adminPhones {
		user(g, p, "Admin", models.RoleAdmin)
	}
	teacher := user(g, teacherPh, "Dr. Meera (Teacher)", models.RoleTeacher)
	student := user(g, studentPh, "Aarav (Student)", models.RoleStudent)
	exam := time.Now().AddDate(0, 6, 0)
	g.Model(&student).Updates(map[string]interface{}{"selected_course_id": course.ID, "exam_date": exam, "state": "Telangana"})
	g.Model(&teacher).Updates(map[string]interface{}{"selected_course_id": course.ID})

	var plans int64
	g.Model(&models.SubscriptionPlan{}).Where("course_id = ?", course.ID).Count(&plans)
	if plans == 0 {
		must(g.Create(&models.SubscriptionPlan{Name: "NEET UG Monthly", CourseID: course.ID, DurationDays: 30, PricePaise: 49900, Currency: "INR", IsActive: true, CreatedBy: teacher.ID}).Error)
	}

	type ref struct {
		subject models.Subject
		chapter models.Chapter
	}
	var chapters []ref
	order := 0
	for _, sname := range []string{"Biology", "Chemistry", "Physics"} {
		order++
		var s models.Subject
		if g.Where("course_id = ? AND name = ?", course.ID, sname).First(&s).Error != nil {
			s = models.Subject{CourseID: course.ID, Name: sname, OrderIndex: order}
			must(g.Create(&s).Error)
		}
		for ci, c := range syllabus[sname] {
			var ch models.Chapter
			if g.Where("subject_id = ? AND name = ?", s.ID, c.Name).First(&ch).Error != nil {
				ch = models.Chapter{SubjectID: s.ID, Name: c.Name, OrderIndex: ci + 1}
				must(g.Create(&ch).Error)
			}
			chapters = append(chapters, ref{s, ch})
			// Schema topics
			for ti, t := range c.Topics {
				var st models.SchemaTopic
				if g.Where("chapter_id = ? AND name = ?", ch.ID, t.Name).First(&st).Error != nil {
					st = models.SchemaTopic{CourseID: course.ID, SubjectID: s.ID, ChapterID: ch.ID, Name: t.Name, OrderIndex: ti + 1}
					must(g.Create(&st).Error)
					for _, y := range t.Years {
						label := y[0].(string)
						yr, re := 0, false
						fmt.Sscanf(label, "%d", &yr)
						re = len(label) > 4
						must(g.Create(&models.SchemaYear{TopicID: st.ID, Year: yr, ReExam: re, Subtopic: y[1].(string), Questions: y[2].(int)}).Error)
					}
				}
			}
			// Pulse items
			var pn int64
			g.Model(&models.PulseItem{}).Where("chapter_id = ?", ch.ID).Count(&pn)
			if pn == 0 {
				for i, t := range c.Topics {
					must(g.Create(&models.PulseItem{CourseID: course.ID, SubjectID: s.ID, ChapterID: ch.ID, Title: t.Name + ": the one idea to remember", Body: fmt.Sprintf("%s in %s. Read this once, say it back in your own words, then try two questions on it. Sample content for testing the Pulse reader and its one-minute timer.", t.Name, c.Name), AuthorID: &teacher.ID, OrderIndex: i + 1, IsActive: true}).Error)
				}
			}
		}
	}

	// Tests and questions
	pick := func(i int) ref { return chapters[i%len(chapters)] }
	addQuestions := func(t *models.Test, n int, spread bool, base ref) {
		diff := []string{"easy", "medium", "hard"}
		expl := "Option B is correct because this is sample seeded content."
		for i := 1; i <= n; i++ {
			r := base
			if spread {
				r = pick(i - 1)
			}
			sub, ch, d := r.subject.ID, r.chapter.ID, diff[i%3]
			src := "qbank"
			switch t.ModuleType {
			case models.ModuleTestSeries:
				src = "test_series"
			case models.ModulePractice:
				src = "practice"
			}
			q := models.Question{TestID: t.ID, QuestionText: fmt.Sprintf("%s: sample question %d about %s", r.subject.Name, i, r.chapter.Name), OptionA: "Option A", OptionB: "Option B (correct)", OptionC: "Option C", OptionD: "Option D", CorrectOption: models.OptionB, Explanation: &expl, OrderIndex: i, ContentFormat: "plain", SubjectID: &sub, ChapterID: &ch, Difficulty: &d, SourceType: src, CustomEligible: true, QuestionType: "mcq_single", Version: 1, Lang: "en", FlagStatus: models.FlagActive, ContentHash: uuid.NewString()}
			must(g.Create(&q).Error)
			must(g.Create(&models.TestQuestion{TestID: t.ID, QuestionID: q.ID, Position: i}).Error)
		}
		g.Model(&models.Test{}).Where("id = ?", t.ID).UpdateColumn("total_questions", n)
	}
	mk := func(title string, module models.ModuleType, status models.ContentStatus, free bool, base ref, edit func(*models.Test)) *models.Test {
		var exists models.Test
		if g.Where("title = ?", title).First(&exists).Error == nil {
			return nil
		}
		sub, ch, dur := base.subject.ID, base.chapter.ID, 30
		t := models.Test{Title: title, CourseID: course.ID, ModuleType: module, RequiresSubscription: !free, SubjectID: &sub, ChapterID: &ch, CreatedBy: teacher.ID, DurationMinutes: &dur, MarksPerCorrect: 4, MarksPerWrong: -1, Status: status, Origin: models.OriginAuthored, Visibility: models.VisibilityPublic, Mode: models.ModeExam}
		if edit != nil {
			edit(&t)
		}
		must(g.Create(&t).Error)
		return &t
	}

	for i, r := range chapters {
		if t := mk("QBank: "+r.chapter.Name, models.ModuleQBank, models.StatusPublished, i%3 == 0, r, nil); t != nil {
			addQuestions(t, 5, false, r)
		}
	}
	var series models.TestSeries
	if g.Where("title = ?", "NEET 2027 Mock Series").First(&series).Error != nil {
		series = models.TestSeries{CourseID: course.ID, Title: "NEET 2027 Mock Series"}
		must(g.Create(&series).Error)
	}
	examTest := func(title, kind string, free bool, year int, opens *time.Time, results *time.Time) {
		t := mk(title, models.ModuleTestSeries, models.StatusPublished, free, chapters[0], func(t *models.Test) {
			t.ExamStyle, t.Kind, t.Delivery = "neet", kind, "anytime"
			t.SeriesID = &series.ID
			if kind == "pyq" {
				t.ExamYear = &year
			}
			if opens != nil {
				t.Delivery, t.OpensAt, t.ResultsAt = "live", opens, results
			}
		})
		if t != nil {
			n := 12
			if kind == "subject" || kind == "part" {
				n = 6
			}
			addQuestions(t, n, true, chapters[0])
		}
	}
	examTest("Grand Test 1", "full", true, 0, nil, nil)
	examTest("Grand Test 2", "full", true, 0, nil, nil)
	examTest("Grand Test 3", "full", false, 0, nil, nil)
	examTest("NEET 2023 (previous year)", "pyq", true, 2023, nil, nil)
	examTest("Mini Test: Cells and Genetics", "part", true, 0, nil, nil)
	examTest("Biology Subject Test 1", "subject", true, 0, nil, nil)
	soon := time.Now().Add(26 * time.Hour)
	resultsAt := soon.Add(5 * time.Hour)
	examTest("Grand Test Live: Sunday Special", "full", true, 0, &soon, &resultsAt)
	// something for the admin review queue
	if t := mk("QBank (waiting for review): Optics extra", models.ModuleQBank, models.StatusPendingReview, true, chapters[8], nil); t != nil {
		addQuestions(t, 3, false, chapters[8])
	}

	// Flashcards
	for i, r := range chapters {
		if i%3 != 0 {
			continue
		}
		title := "Flashcards: " + r.chapter.Name
		var d models.FlashcardDeck
		if g.Where("title = ?", title).First(&d).Error == nil {
			continue
		}
		sid, cid := r.subject.ID, r.chapter.ID
		d = models.FlashcardDeck{Title: title, Description: "Quick recall for " + r.chapter.Name, CourseID: course.ID, SubjectID: &sid, ChapterID: &cid, AuthorID: teacher.ID, Status: models.StatusPublished, CardCount: 4}
		must(g.Create(&d).Error)
		for j := 1; j <= 4; j++ {
			must(g.Create(&models.Flashcard{DeckID: d.ID, Front: fmt.Sprintf("%s: term %d?", r.chapter.Name, j), Back: fmt.Sprintf("Answer %d for %s", j, r.chapter.Name), ContentFormat: "plain", Position: j}).Error)
		}
	}

	// Brain Hacks
	hacks := []models.BrainHack{
		{Title: "Read the question stem twice", Category: "Speed Reading", Body: "Skim the options first, then read the stem slowly once. It saves about ten seconds a question.", ContentFormat: "plain", ReadMinutes: 1, Kind: "article"},
		{Title: "Fourth book rule for NCERT", Category: "Fourth Book", Body: "After NCERT and one reference book, stop adding books. Revise what you have three more times.", ContentFormat: "plain", ReadMinutes: 1, Kind: "article"},
		{Title: "Sleep before a mock", Category: "Sleep", Body: "Seven hours the night before beats one more late chapter. Memory is stored while you sleep.", ContentFormat: "plain", ReadMinutes: 1, Kind: "article"},
		{Title: "Box breathing in two minutes", Category: "Breathing", Kind: "video", VideoURL: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", DurationSeconds: 15, ContentFormat: "plain", ReadMinutes: 1},
		{Title: "Speed reading drill", Category: "Speed Reading", Kind: "video", VideoURL: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", DurationSeconds: 15, ContentFormat: "plain", ReadMinutes: 1},
	}
	for _, h := range hacks {
		var e models.BrainHack
		if g.Where("title = ?", h.Title).First(&e).Error == nil {
			continue
		}
		h.AuthorID, h.Status = teacher.ID, models.StatusPublished
		must(g.Create(&h).Error)
	}

	// Home banner and message
	var bn int64
	g.Model(&models.HomeUpdate{}).Count(&bn)
	if bn == 0 {
		must(g.Create(&models.HomeUpdate{Title: "NEET 2027 batch is open", Body: "Join the mock series and track your Grand Test progress.", CTALabel: "See Tests", CTARoute: "/(student)/(tabs)/tests", IsActive: true}).Error)
	}
	var hm models.HomeMessage
	if g.First(&hm, "slot = ?", "main").Error != nil {
		must(g.Create(&models.HomeMessage{Slot: "main", Name: "Dr. Meera", Quote: "Do a little every day. The syllabus is big, but the day is long enough.", IsActive: true}).Error)
	}

	fmt.Println("Seed done.")
	fmt.Println("  Admin:   7386868169 (or +917386868169)")
	fmt.Println("  Teacher: +919000000002")
	fmt.Println("  Student: +919000000001")
	fmt.Println("  OTPs are printed in the server log as [OTP STUB].")
}

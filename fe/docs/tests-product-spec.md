# Tests: product spec (exam simulation)

Status: **decisions made, nothing built.** Written 2026-11-14 as a product review of what a "Test" must be in Codon, across the student, teacher and admin apps, and whether the course structure still makes sense.

This replaces the idea that a Test is "a Q Bank set with a timer". The goal: a student who takes a Codon test should feel they sat the real exam, and trust the score, the rank and the analysis.

Facts about the exam below (NEET pattern, marking, interface) come from general knowledge of how NTA runs NEET UG. **Check them against the current NTA information bulletin before building**; patterns change between years. Everything else is checked against our code.

## 0. Decisions made (2026-11-14)

| # | Decision |
|---|---|
| Exam style | **The teacher chooses an exam style per test.** A style is a bundle of rules and looks: pattern defaults, interface, marking, navigation. Styles now: **NEET** (exam-hall interface, NEET pattern) and **School** (plain, nothing fancy). Adding one later (JEE) means adding a style, not rewriting tests |
| JEE | **Future.** This is a NEET application. JEE needs numerical-answer and multiple-correct questions, so it also waits for those question types |
| School | Classes **9 and 10**, **CBSE and state boards**. Plain objective tests (MCQ), duration and marks **set by the teacher** per test |
| Pattern strictness | Patterns are **templates, not rules**: "inspired by" the real exam. A mock may differ (a warning, never a block) |
| Feel | The exam hall should feel like the real NEET. NEET UG 2026 was pen and paper (OMR) and the government and NTA have said NEET moves to **computer-based test (CBT) from 2027**, so the default interface is the CBT-style palette and timer; an OMR-sheet look can be an optional view later |
| Live | **In scope now**: everyone starts at the same time. Late entry is **fully configurable per test** (suggested default 15 minutes) |
| Results | Released **after a configurable gap** following the window, with a **minimum gap** (suggested 15 minutes) that the platform enforces so the team has time to check. A longer gap is fine |
| Extension | An admin **may extend** a window after an outage |
| Ranks | Both: official rank for live takers and an estimated rank for later takers. **No hard minimum cohort**: always show "rank X of N" so it is honest; percentile is hidden under a small N (default 30, configurable) |
| Rank visibility | **Configurable per test**: everyone, or subscribers only. Free users can see by default |
| Key challenges | **Next release**, not the first |
| Key changes | An **admin can recompute** after a key change, with a preview ("this changes 312 scores") and a confirm |
| Leaderboard | There is **no friends feature** in the app, so no friends board. Public board with first name and initial and an opt-out, plus an improvement board. School tests default to **no public board** (see §15) |
| Languages | **English** for now |
| Solutions | Written explanation only. **No video link** |
| Papers | Re-created in the exam's pattern, written by **teachers**; labelled as such |
| Attempts | First attempt is official, later ones are practice |
| Structure | **Approved:** Course → Series → Test, own Tests tab, coverage from question tags. **The Practice tab keeps its name** |
| Scale | Under **5,000** students per live test |
| Exam-day team | My proposal in §9A |

---

## 1. The problem today

What the code does now (verified):

- A test is one record with a chapter or subject, an optional duration, marks per correct and per wrong, and a `module_type` of `qbank`, `test_series`, `practice` or `custom`. A student opens it from a chapter list, taps Start, answers, and submits.
- **The only differences between Q Bank and Test Series** are: a Test Series test cannot be retaken, and it can show rank and percentile once 10 students have finished it. Everything else (screens, flow, scoring, review) is shared.
- Tests are **always available**. They have no start time, no end time, no "live", no result release, no answer-key stage.
- Tests live **inside the course tree** (subject → chapter), so a "full mock" has nowhere honest to sit; it is forced under a chapter.
- There are no sections in the exam sense (Physics, Chemistry, Botany, Zoology), no instructions page, and no exam pattern. (A free-text "section" label per question and an instructions field now exist, but they are only labels.)
- Review is immediate after submit, including the right answers, so a test cannot be "live" at all.

Consequence: Q Bank and Tests feel the same to a student, and nothing Codon offers can answer "how would I have ranked on exam day?".

## 2. What each thing is for

| | Q Bank | Test |
|---|---|---|
| Purpose | Learn and build accuracy | **Measure and simulate** |
| Unit | A question | A fixed paper |
| Time | Untimed | Timed exactly like the exam |
| Answers | Shown as you go (tutor mode) | Hidden until results are released |
| Where it sits | Subject → chapter → topic | **Series** (not the tree) |
| Retake | Anytime, unlimited | Official attempt once; later attempts are practice |
| Rank | Never | Yes |
| Feel | A workbook | An exam hall |

Rule for the whole product: **if a screen shows the right answer while the student is still answering, it is not a Test.**

## 3. Kinds of test

| Kind | Example | Notes |
|---|---|---|
| **Full-length mock** | "Codon NEET Mock 7": all subjects, full duration | The core product. Exact exam pattern. |
| **Previous-year paper** | "NEET 2023" as originally set | Exact paper and pattern, tagged with year. |
| **Subject test** | "Physics full syllabus" | One subject, shorter. |
| **Mini / part test** | "Class 11 Physics, Unit 1 to 4" | Syllabus slice, 30 to 60 questions. |
| **Chapter test** | "Laws of Motion" | The only kind that belongs next to a chapter. |

Each kind can be delivered two ways:

- **Live:** a scheduled event. Everyone starts in the same window, ranks are among live participants only, results are released at a set time. This is the "real exam" experience and what builds a leaderboard.
- **Anytime:** available after the event or from day one. The student gets the same paper and timer, but ranks are compared with the live cohort ("you would have ranked 4,210 among 18,500 who took it live") and are marked as unofficial.

A past live test automatically becomes an anytime test after its window closes. That one rule gives a growing library of "tests that actually happened".

## 4. Exam pattern as data

Do not hard-code NEET. Define an **exam style** (with its pattern) and let the teacher pick it when creating a test. The NEET style defaults to:

| Field | NEET UG (check each year) |
|---|---|
| Sections | Physics, Chemistry, Botany, Zoology (Biology is two sections) |
| Questions | 180 in recent years (45 per section); older years had 200 with a "choose 10 of 15" part B. Make it configurable |
| Duration | 180 minutes in recent years (200 in the older pattern) |
| Marking | +4 correct, −1 wrong, 0 unattempted |
| Types | Single-correct MCQ |
| Navigation | Free movement between sections and questions; one overall timer |
| Languages | English plus regional languages |

The style drives the paper builder (teacher), the instructions page and palette (student) and gives warnings before submit-for-review (a mock with 178 questions shows "does not match the NEET pattern"). It never blocks: patterns are templates. The **School** style is plain: a simple question list, a timer, no section tabs unless the teacher adds sections, and duration and marks set by the teacher.

**NEET and CBT.** NEET UG has been pen and paper (OMR). The NTA told the Supreme Court it will run NEET UG as a computer-based test from 2027. A CBT is the NTA exam-hall software: a question palette with colour states, a section bar, a countdown, and save and next. That is what the NEET style copies, so students get used to it before 2027. Marking rules differ slightly (on the OMR sheet marking two options costs −1; that cannot happen on a screen that allows one choice). Check the 2027 bulletin when it is published.

JEE is a future style (JEE Main adds numerical-answer questions, JEE Advanced multiple-correct answers with partial marking and two papers).

## 5. The student's journey

**Discover.** A **Tests** tab, separate from Practice (see §10), with:
- **Live now** and **Upcoming** (date, time, duration, syllabus, "Remind me")
- **Past live** (library: take it now, see where you would have ranked)
- **My series** and **My results**
Filters by kind and by subject; locked items show the plan needed.

**Before it starts.** Registration or a reminder; push 1 day, 1 hour and 10 minutes before. A **lobby** opens a few minutes early with a countdown, a device and network check, and the rules.

**Instructions page.** Same style as the exam: pattern, marking, palette legend, what happens if you leave the app, and "I have read the instructions" before Start. The teacher's per-test instructions appear here.

**The exam hall.** Looks and behaves like the real interface:
- Section tabs with the number answered per section.
- Question palette with five states: not visited, not answered, answered, marked for review, answered and marked.
- One overall timer, always visible, **driven by the server clock**, not the phone's.
- Save and next, clear response, mark and next. No hints, no reveal, no tutor mode, no calculator.
- **No pause.** Leaving the app does not stop the clock.
- Auto-submit at time-up. A confirmation page before manual submit shows counts per state.
- Answers saved continuously to the phone and synced; losing network mid-exam must not lose answers (already true today).

**After.** "Submitted. Results at 8 pm" until the release time. Then:
- Score, **rank** and **percentile**, accuracy and attempt rate.
- **Subject-wise** breakdown, time per subject and per question, marks lost to negative marking, and a "hurried" list (wrong answers where you spent under 20 seconds).
- **Compare** with the topper and the average, on each subject.
- **Solutions** with explanation , released with the answer key.
- A **leaderboard** (top 10 plus your position, first name and initial, opt-out).
- **Challenge an answer key** within a window; see the outcome.
- Add wrong and skipped questions to a **Q Bank practice set** or bookmarks in one tap (the bridge back to learning).

**Retakes.** The first submitted attempt is the official one for rank. Later attempts are labelled "practice" and never change the rank.

## 5A. Leaderboards and after-the-test features

The test is only half the product. What happens in the hours after results decides whether a student comes back for the next one.

### Leaderboards

| Board | What it shows | Notes |
|---|---|---|
| **Test board** | Top 10 plus "you are 1,240 of 18,500" | Live participants only; anytime takers see an estimate (§6) |
| **Subject board** | Top scorers in Physics, Chemistry, Botany, Zoology | Gives a weaker overall student something to win |
| **Series board** | Cumulative or best-N scores across a series | The one that drives retention: "keep going, you are 3 marks off the top 100" |
| **Improvement board** | Biggest rise in score or percentile since your last test | Rewards effort, not just ability; students outside the top still appear |
| **City or school board** | Optional, once there is enough volume | Needs a school or city field; skip at first |

Rules for all boards: first name and initial only, no photo, **opt out in one tap** (then you still see your own rank), ties share a rank, and no board for Q Bank. There is no friends feature in the app, so there is no friends board. School tests (9th and 10th) are for under-18s: default to no public board there, and show only the student's own rank and percentile.

### After the result: the feature list

**Understand the score**
- **Score breakdown:** correct, wrong, skipped, marks lost to negative marking, and "marks you would have had if you had skipped your guesses".
- **Attempt strategy:** how many you attempted per subject against the cohort's average attempt rate; whether guessing helped or hurt.
- **Time analysis:** time per subject and per question, questions you spent too long on, and when your accuracy fell during the three hours (fatigue curve).
- **Question types of mistakes:** a student marks why each wrong answer happened (did not know, forgot, silly mistake, misread, guessed). It is a tap per question and the most useful data for the next plan.
- **Compare:** against the topper, the average and a chosen friend, per subject and per chapter.
- **Percentile band:** "you are in the top 12 per cent; the top 5 per cent started at 612 marks".
- **Rank predictor:** an honest range for the real exam, labelled as an estimate, using the live cohort and (if available) past years' cut-offs.

**Close the gaps**
- **One-tap "Practise my mistakes":** sends wrong and skipped questions to a Q Bank set, grouped by chapter (the bridge back to learning).
- **Weak-chapter plan:** the three chapters that cost the most marks, with the lesson, notes and a short Q Bank set for each.
- **Revision flash cards** made from the questions you got wrong (or from the explanation's key line).
- **Retry in tutor mode:** retake the same paper without the clock and with answers shown, clearly marked as practice (never changes rank).
- **Solutions that teach:** a written explanation, "common wrong option and why it is tempting", and a short shortcut where the teacher adds one. No video links.
- **Bookmark and note** on any question in the review.
- **Ask a doubt** on a question (needs the doubts decision; see future gaps).

**Trust and fairness**
- **Challenge an answer** within the window, with a status you can follow and a notification on the outcome.
- **Rescore notice:** if the key changes, a clear before and after ("your score went from 548 to 556").
- **Result release and key release** notifications.

**Keep them coming back**
- **Next-test card** with a countdown, and a simple "your plan" showing the next three tests and their syllabus.
- **Streak of tests taken**, not of days opened, and a **badge** for milestones (first mock, 5 mocks, top 10 per cent). Keep these quiet; no public shaming.
- **Progress over time:** score and percentile for each mock in one chart, with the exam-date countdown beside it.
- **Share card:** a clean image of your score and percentile for friends and family (opt-in, never shows others' names).
- **Parent report:** an optional weekly summary to a parent's number or email (marks, trend, weak chapters). Needs consent from the student; for school students, consent from a parent.
- **Re-attempt reminder:** after two weeks, suggest retrying the paper's weak chapters.

**For teachers and admins**
- **Teacher:** per-question accuracy, discrimination, most common wrong option, and "questions to retire", plus a list of challenged questions.
- **Admin:** result-day dashboard (people who opened results, challenges, support tickets), rank-list export, and a cohort report by city or batch.

### What I would build first

1. After the **first live test**: score breakdown, subject-wise and time analysis, test board, "Practise my mistakes", and the key-challenge flow. These are what the student judges Codon on.
2. After the **second or third**: series board, weak-chapter plan, improvement board, and the "why I got it wrong" tags.
3. Later: friends board, parent report, rank predictor, share card.

### Cautions

- A public leaderboard motivates the top 10 per cent and discourages the rest. Always show a personal view ("you beat 640 students") and an improvement view next to it.
- Do not show a rank when the cohort is small; a wrong or fragile rank costs more trust than no rank.
- Any parent or group feature needs consent and a clear off switch.

## 6. Live versus anytime: ranking rules

| | Live | Anytime (after the window) |
|---|---|---|
| Who is compared | Everyone who took it in the window | The live cohort, as a fixed reference |
| Shown as | Official rank and percentile | "Estimated rank" |
| Leaderboard | Yes | Own position against the live board; not added to it |
| Result time | Fixed, same for all | Immediately after submit (the key is already out) |
| Answers visible | After release | Right after submit |

There is no hard minimum: a rank is always shown as "rank X of N" so a small group is obvious. Percentile is hidden when N is small (default 30, configurable). Rank visibility (everyone or subscribers) is a per-test setting.

## 7. Integrity (without turning the app into a prison)

Already built: one active device per attempt with takeover, answers survive network loss, screen-capture protection, auto-submit of expired attempts.

Add:
- **Server-authoritative timing:** start time, end time and a late-entry rule are decided by the server. Late entry (for example 15 minutes) with the remaining time reduced, not extended.
- **Leave-app tracking:** count how many times and for how long the app was backgrounded; show a warning and record it. Do not auto-fail; surface it to the admin as a flag.
- **Paper delivery:** questions are fetched only when the exam starts, and not before. For a live test the whole paper downloads at start so a network drop does not stop the exam.
- **Optional shuffling** of options per student for tests where copying is a concern. Never shuffle question order for a pattern that has fixed numbering.
- **Answer-key changes** after the exam are always rescored (see §9).

Not proposed: camera proctoring. It is invasive, hard to run on cheap phones and a privacy risk for under-18s.

## 8. Teacher: building a real paper

Today a teacher creates a test, adds questions one at a time or by CSV, and submits it. That is a Q Bank workflow. A paper needs:

- **Paper builder:** choose the exam pattern, then fill each section by picking questions from the bank by chapter, topic and difficulty, with live counts ("Physics 38 of 45; Chemistry 45 of 45"). The builder warns about syllabus gaps and duplicates across tests.
- **Questions are reused, not copied:** one question can appear in many papers; when a live paper's question is locked it stays locked (we already route edits to live questions through a correction flow).
- **Per-question written solution**, required before a live test can be submitted for review.
- **Proof stage:** a second teacher can be asked to attempt the paper in preview and flag problems before the admin approves it.
- **Difficulty calibration:** after a live test, show per-question accuracy and discrimination (do top scorers get it right?), and suggest which questions to revise or retire.
- **Challenge inbox:** key challenges for the papers they authored, with student count per question.
- **Series planning:** group papers into a series with a calendar (see §9).

## 9. Admin: running the exam

- **Series and calendar:** create a series (name, course, price, list of tests with dates). One screen shows what is scheduled, what is live and what ended.
- **Event settings per live test:** opens at, closes at, duration, late-entry window, result release time, answer-key release time, challenge window.
- **Live monitor** on the exam day: registered, started, in progress, submitted, and error rate. A button to **extend** the window by N minutes for an outage, announced to participants.
- **Key finalisation:** after the challenge window the admin accepts or rejects challenges per question, and chooses the outcome: keep, change the correct option, accept multiple options, or drop the question with full marks to everyone. **Every change rescores all attempts and recomputes ranks**, and notifies students whose score changed.
- **Publish results** (rank list, percentile) at the release time; a scheduled job does it.
- **Audit** of every key change (who, when, why) in the existing audit log.
- **Reports:** attempt counts, completion, average, rank distribution, per-question stats, export to CSV.

## 9A. Exam-day team (my proposal)

For a live test under 5,000 students, three roles, which can be two people:
- **Operator** (owns the day): watches the live monitor, announces, decides on an extension. Must be reachable from 30 minutes before the start to 30 minutes after the end.
- **Content reviewer:** has the paper and key open; handles "this question is wrong" reports during the window and prepares a corrected key. Not the person who wrote the paper.
- **Support:** answers students in the app and on WhatsApp for the first hour after results.

Before the first live test: a dry run with 50 internal users, a load test at about twice the expected size (10,000 simulated students), and a written outage plan (when to extend, how to announce it).

## 10. Does the course structure make sense?

Today: **Course → Subject → Chapter**, with content (videos, notes, Q Bank sets, flash cards) and tests all placed at the chapter level.

Verdict:

1. **Keep the tree for learning content.** Videos, notes, flash cards and Q Bank are naturally "subject → chapter → topic". Students browse by what they are studying.
2. **Stop placing tests in the tree.** A full mock, a PYQ paper and a subject test are not "in" a chapter. Forcing a chapter is what breaks today's Tests.
3. **Tests belong to a Series, and a Series belongs to a Course:** Course → Series → Test. A test's **syllabus coverage is derived from the tags on its questions** (each question already carries subject, chapter and topic), so analysis by chapter still works without a placement.
4. **Chapter tests are the one exception:** they can appear both in their series and as a shortcut at the end of a chapter ("Test yourself").
5. **Exam pattern is per course.** A "course" today is both an exam (NEET UG) and a school class (9th, 10th). Their tests differ (unit test versus national mock). Keep it as it is, and let the pattern decide behaviour. Do not introduce a fourth level.
6. **Do not add "exam" as a separate entity above course.** It adds navigation depth for no gain; the course already acts as the exam for NEET.

Student app: a separate **Tests** tab (series, live, library, results), and **Practice** keeps Q Bank, Custom and flash cards. The Learn tab is unchanged.

## 11. What must change in the data and the platform (outline)

- `exam_patterns` (per course): sections, counts, duration, marking, navigation rules, instructions.
- `test_series`; tests get `series_id`, `kind` (chapter, subject, part, full, pyq), `delivery` (live or anytime), and nullable `chapter_id` and `subject_id`.
- Event fields: `opens_at`, `closes_at`, `late_entry_minutes`, `results_at`, `key_at`, `challenge_until`.
- Sections on a test with ordered questions and per-section counts (today a question has a free-text label only).
- Attempts: `official` flag (first attempt, inside the window), leave-app counters, server start and end times.
- `key_challenges` and a **rescore job** that recomputes scores, ranks and percentiles after any key change.
- Rank and percentile computed once at release for live tests and cached; the current per-view calculation will not hold at exam-day volume.
- Question language variants (the field exists; add a paired translation) so Hindi and other languages can be offered later without re-authoring the paper.
- Notifications: reminder, lobby open, results out, key out, challenge result.

## 12. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Exam-day load** | Thousands starting at the same minute, answers syncing every few seconds, then a submit spike | Whole paper downloaded at start, batched answer sync (exists), queue the submit and scoring work, **load test before the first live test** |
| **Clock** | Wrong phone time can unfairly gain or lose time | Server-driven timer; client only displays it |
| **Content leaks** | A paper circulates before the exam | Questions served only after start; admin-only visibility until then |
| **Bad answer key** | Public trust lost | Challenge window and rescoring, audited |
| **Small cohort** | A rank among 12 people is meaningless | Higher minimum for rank; percentile-only below it |
| **Cheating** | Rank value drops | Single device, leave-app flags, optional option shuffle |
| **Authoring effort** | A full mock is 180 questions | Question reuse, paper builder, CSV, proof stage |

## 13. Suggested phases

1. **Foundation (no live yet):** exam pattern, test kinds, **separate Tests tab and Series**, instructions page, five-state palette with sections, results page (subject-wise, time), "official attempt" rule, answers hidden until a release time. Tests stop being under a chapter.
2. **Live:** schedule fields, lobby, server timing, late entry, scheduled result release, rank list, leaderboard, reminders, admin calendar and live monitor.
3. **Trust:** key challenges and rescoring, solution release, difficulty calibration for teachers, paper builder and proof stage.
4. **Reach:** language variants, PYQ library at scale, series pricing and bundles, richer comparison and analytics.

Phase 1 alone fixes the "tests feel like Q Bank" problem. Phase 2 is the first moment Codon can promise "a real mock".

## 14. Success measures

- Share of mock attempts that are **official** (inside the window).
- Completion rate of live tests (started to submitted) and share auto-submitted by time-up.
- Repeat rate: students who take a second live test within 30 days.
- Result-day return rate (opened the app within an hour of results).
- Key-change rate per test (a high rate means authoring quality problems).
- Support tickets per 1,000 attempts on exam days.

## 15. Questions that remain

1. **School tests and minors:** classes 9 and 10 are under 18. Confirm: no public leaderboard for school tests (own rank only), and a parent's consent for any parent report?
2. **Result gap:** is 15 minutes the right platform minimum, and the default?
3. **Rank percentile hiding:** is 30 the right default for hiding percentile?
4. **Exam style names:** shown to students as "NEET style" and "School"? And what does a teacher pick if a test is for neither (for example a NEET-level chapter test)? (My answer: it is "NEET style" with a different duration.)
5. **Anytime vs live for school tests:** do school tests need live events too, or only anytime?
6. **Who can create a live test:** any teacher, or only teachers an admin marks as "paper setters"?
7. **Reviewer separation:** must a live test be reviewed by a different person than the author? (Recommended: yes.)
8. **Exam-day support channel:** the WhatsApp number from Platform settings, or a different one?
9. **OMR-sheet view** (bubble sheet look) as an option in the NEET style: wanted, or CBT-style only for now?
10. **Pricing:** tests free, in a plan, or per series? Rank visibility is configurable, but what is the default for a paid series?

## 16. What is explicitly out of scope for now

JEE (a future exam style), camera or microphone proctoring, adaptive tests, multi-answer and numeric question types (NEET does not use them), written-answer school papers, friends and group boards, video solutions, other languages than English, key challenges in the first release, paid mentor evaluation, and a web exam client.

"""
seed_demo.py — Populate NUVRA with realistic demo data for the competition.

Run: .venv/bin/python seed_demo.py
"""
import os
import sys
import shutil
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from passlib.hash import bcrypt

import models
from database import SessionLocal, engine, chroma_client
from materials import extract_text, index_in_chroma


# ── Source PDFs ───────────────────────────────────────────────────────────────
PDFS = {
    "sat": ("/Users/ismayil.musazade/Desktop/SAT Verbal/Punctuation Rules.pdf", "Punctuation_Rules.pdf"),
    "ielts": ("/Users/ismayil.musazade/Desktop/IELTS/50 IDIOMS .pdf", "50_IELTS_Idioms.pdf"),
    "toefl": ("/Users/ismayil.musazade/Desktop/TOEFL/TOEFL 2026/TOEFL SPEAKING GUIDE NEW.pdf", "TOEFL_Speaking_Guide.pdf"),
}

PASSWORD = "demo1234"
PASS_HASH = bcrypt.hash(PASSWORD)


# ── Fallback canonical content for image-based PDFs ──────────────────────────
IELTS_IDIOMS_TEXT = """
50 Essential IELTS Idioms — Use these in Speaking and Writing tasks to lift your band score.

1. Piece of cake — Something very easy.
   Example: "The IELTS Listening section was a piece of cake compared to Reading."
   Use it in: Speaking Part 1 when describing easy tasks.

2. Once in a blue moon — Something that happens very rarely.
   Example: "I go to the cinema once in a blue moon — maybe twice a year."
   Origin: From the rare astronomical event of two full moons in one month.

3. Costs an arm and a leg — Very expensive.
   Example: "University tuition in the UK costs an arm and a leg."
   Avoid in formal Writing Task 2 — better suited to Speaking.

4. Break the ice — To start a conversation in a tense or awkward social situation.
   Example: "The teacher told a joke to break the ice on the first day."

5. Hit the books — To study intensively.
   Example: "I need to hit the books this weekend before my IELTS exam."

6. Under the weather — Feeling slightly unwell.
   Example: "I was under the weather last week so I missed class."

7. Bite the bullet — To accept something difficult or unpleasant.
   Example: "I bit the bullet and signed up for the speaking test."

8. Speak of the devil — Used when someone you were just talking about appears.

9. Hit the nail on the head — To describe exactly what is causing a situation or problem.

10. Cut corners — To do something poorly or cheaply to save time or money.
    Example: "Don't cut corners when preparing for IELTS — practice every section."

11. Beat around the bush — To avoid the main topic; to not speak directly.
    Example: "Stop beating around the bush and tell me your real opinion."

12. Pull yourself together — Calm down and behave normally.

13. So far so good — Things are going well up to this point.

14. The best of both worlds — A situation where you can enjoy two different advantages.
    Example: "Working from home gives you the best of both worlds — comfort and productivity."

15. A blessing in disguise — Something that seems bad but turns out good.

16. Call it a day — To stop working on something.

17. Let the cat out of the bag — To accidentally reveal a secret.

18. Cost a fortune — To be very expensive.

19. On cloud nine — Extremely happy.

20. Get out of hand — To become uncontrollable.

21. Get your act together — To start behaving properly or work harder.

22. Give someone the benefit of the doubt — Trust them despite suspicions.

23. Go back to the drawing board — Start over because something failed.

24. Hang in there — Stay positive in a difficult situation.

25. It's not rocket science — It's not difficult.

26. Make a long story short — Summarize.

27. Miss the boat — Lose an opportunity.

28. No pain, no gain — You must work hard to achieve something.

29. On the ball — Quick to understand and react.

30. Pull someone's leg — To joke with someone.

When using idioms in IELTS Speaking, use them naturally and only when they fit context. Overusing idioms or using them incorrectly can LOWER your band score. Examiners listen for natural, flexible English — not forced idiomatic phrases.

For Writing Task 2, avoid most idioms — they are too informal. Stick to formal academic vocabulary. Idioms work best in Speaking Parts 1 and 2.

Common pitfalls:
- "Once in a blue moon" means rarely, NOT every month or never.
- "Piece of cake" is informal — fine for Speaking, avoid in Writing.
- "Costs an arm and a leg" is hyperbole — don't use literally.
- Don't string idioms together unnaturally. One well-placed idiom per response is plenty.

Band 7+ tip: Pair idioms with paraphrasing. If you say "it was a piece of cake," follow up with "I found it extremely straightforward."
""".strip()


TOEFL_SPEAKING_TEXT = """
TOEFL Speaking Guide — Complete preparation for all four speaking tasks.

OVERVIEW OF THE SPEAKING SECTION
The TOEFL iBT Speaking section has 4 tasks and takes about 17 minutes total. Each task is scored 0-4 by trained raters, then the average is scaled to a final score of 0-30.

TASK 1: INDEPENDENT SPEAKING
- You receive a question about a familiar topic (your opinion, a personal preference, an experience).
- Preparation time: 15 seconds.
- Response time: exactly 45 seconds.
- Common prompts: "Do you prefer studying alone or in a group?", "What is the most important quality in a friend?"

Best structure:
1. State your opinion clearly (5-7 seconds)
2. Reason 1 with a specific example (15-18 seconds)
3. Reason 2 with a specific example (15-18 seconds)
4. Brief conclusion if time permits (3-5 seconds)

Sample opening: "I strongly prefer studying alone, mainly for two reasons."

TASK 2: INTEGRATED — READING + LISTENING (CAMPUS TOPIC)
- Read a short campus announcement or letter (45 seconds).
- Listen to a conversation about the same topic (~60-90 seconds).
- Preparation: 30 seconds.
- Response: 60 seconds.

Your job: Summarize the student's opinion in the conversation and the reasons for that opinion.

TASK 3: INTEGRATED — READING + LISTENING (ACADEMIC TOPIC)
- Read a short academic passage explaining a concept (45 seconds).
- Listen to a professor's lecture giving examples of that concept (~60-90 seconds).
- Preparation: 30 seconds.
- Response: 60 seconds.

Your job: Explain the concept using the examples from the lecture. Do NOT give your own opinion.

TASK 4: INTEGRATED — LECTURE ONLY (ACADEMIC TOPIC)
- Listen to a professor's lecture about a single academic concept (~90-120 seconds).
- Preparation: 20 seconds.
- Response: 60 seconds.

Your job: Summarize the lecture, explaining the main idea and supporting examples.

SCORING RUBRIC (per task, 0-4)
- 4: Sustained, well-developed response. Natural pace, clear pronunciation, varied grammar.
- 3: Generally clear and coherent with minor lapses. Good content but some delivery issues.
- 2: Limited development, noticeable problems with delivery or coherence.
- 1: Very limited content, severe delivery problems.
- 0: No response or unrelated.

CRITICAL DELIVERY TIPS
- Speak at a NATURAL pace — not too fast, not too slow. Aim for ~150 words per minute.
- Use transitions: "First of all," "Another reason is," "For example," "In conclusion."
- Vary your sentence structure — mix simple and complex sentences.
- Pronunciation matters more than perfect grammar.
- Don't pause more than 2 seconds at a time.

THE TEMPLATE TRAP
DO NOT memorize template responses word-for-word. ETS graders are trained to identify memorized phrases and lower scores. Use flexible templates as scaffolding, but adapt them to each prompt.

Bad (memorized): "In my opinion, which I strongly believe in, I think that..."
Good (flexible): "I'd say I prefer X, mainly because..."

TIMING STRATEGY
Practice with a stopwatch. For Task 1 (45 seconds), aim for:
- Opinion: 5 seconds
- Reason 1: 18 seconds
- Reason 2: 18 seconds
- Closer: 4 seconds

Going over time means your response is cut off. Stopping early means lost content.

COMMON STUDENT MISTAKES
1. Speaking too fast to fit everything in — sacrifices clarity.
2. Using memorized phrases that sound robotic.
3. Not giving specific examples — vague answers score low.
4. Forgetting structure in integrated tasks (rushing into details without setup).
5. Mishearing the question in Task 1 — listen carefully to the prompt.

A 26+ SCORE REQUIRES:
- Two well-developed reasons in Task 1 (not three rushed ones).
- Accurate paraphrasing in integrated tasks — don't repeat the source word-for-word.
- Natural intonation and stress patterns.
- Confident delivery without long hesitations.
""".strip()


def wipe_everything():
    print("→ Wiping database and upload dirs…")
    with engine.connect() as conn:
        conn.execute(text(
            "TRUNCATE TABLE scheduled_class_members, scheduled_classes, "
            "program_enrollments, programs, tutor_availability, "
            "quiz_attempts, quizzes, notifications, attendance_codes, "
            "ai_usage_logs, assignment_files, assignments, material_files, "
            "session_attendees, sessions, enrollments, courses, users "
            "RESTART IDENTITY CASCADE"
        ))
        conn.commit()

    for d in ("uploaded_materials", "uploaded_assignments", "tutor_attachments"):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            try:
                os.remove(os.path.join(d, f))
            except IsADirectoryError:
                shutil.rmtree(os.path.join(d, f))

    # ChromaDB collection wipe
    try:
        chroma_client.delete_collection("course_materials")
    except Exception:
        pass


def seed():
    db = SessionLocal()
    now = datetime.utcnow()

    # ── Users ─────────────────────────────────────────────────────────────────
    print("→ Creating users…")

    def user(name, email, role):
        u = models.User(name=name, email=email, password_hash=PASS_HASH, role=role)
        db.add(u)
        db.flush()
        return u

    admin = user("Platform Admin", "admin@nuvra.demo", "admin")
    karimov = user("Aslan Karimov", "karimov@nuvra.demo", "tutor")
    sara = user("Sara Mammadova", "sara@nuvra.demo", "tutor")

    student_data = [
        ("Emma Wilson", "emma@nuvra.demo"),
        ("Liam Chen", "liam@nuvra.demo"),
        ("Olivia Patel", "olivia@nuvra.demo"),
        ("Noah Ahmadov", "noah@nuvra.demo"),
        ("Sophia Garcia", "sophia@nuvra.demo"),
        ("Mateo Aliyev", "mateo@nuvra.demo"),
        ("Ava Hasanli", "ava@nuvra.demo"),
        ("Leyla Mehdiyeva", "leyla@nuvra.demo"),
    ]
    students = [user(n, e, "student") for n, e in student_data]
    db.commit()

    # ── Courses ───────────────────────────────────────────────────────────────
    print("→ Creating courses (test prep + school subjects)…")
    sat = models.Course(
        title="SAT Punctuation Mastery",
        description="Master commas, semicolons, colons, dashes, and Oxford commas. Built around the actual rules tested on the SAT Writing & Language section. Includes practice with comma splices, run-on sentences, and parenthetical phrasing.",
        tutor_id=karimov.id,
    )
    ielts = models.Course(
        title="IELTS Vocabulary & Idioms",
        description="Lift your IELTS Speaking and Writing band scores by using natural English idioms in context. 50 carefully chosen idioms with usage examples, common pitfalls, and band-9 sample answers.",
        tutor_id=sara.id,
    )
    toefl = models.Course(
        title="TOEFL Speaking Excellence",
        description="A focused course on the four TOEFL Speaking tasks. Templates that don't sound memorized, timing strategies, pronunciation drills, and dozens of sample responses scored 26+.",
        tutor_id=sara.id,
    )
    algebra = models.Course(
        title="Algebra I — School Foundations",
        description="Linear equations, inequalities, systems of equations, quadratics, factoring, and word problems. Perfect for grades 8-10.",
        tutor_id=karimov.id,
    )
    calculus = models.Course(
        title="Calculus AB — Limits, Derivatives, Integrals",
        description="The complete AP Calculus AB curriculum. Limits, continuity, derivatives, applications, integrals, and the fundamental theorem.",
        tutor_id=sara.id,
    )
    geometry = models.Course(
        title="Geometry — Proofs and Beyond",
        description="Euclidean geometry, similarity, congruence, trigonometry basics, circle theorems, and how to write rigorous proofs.",
        tutor_id=karimov.id,
    )
    db.add_all([sat, ielts, toefl, algebra, calculus, geometry])
    db.commit()

    # ── Enrollments ───────────────────────────────────────────────────────────
    print("→ Enrolling students…")
    def enroll(s, c, days_ago=14):
        db.add(models.Enrollment(
            student_id=s.id, course_id=c.id,
            enrolled_at=now - timedelta(days=days_ago),
        ))

    # SAT — 6 students
    for s in students[:6]:
        enroll(s, sat)
    # IELTS — 5 students (overlap with SAT)
    for s in students[:5]:
        enroll(s, ielts)
    # TOEFL — 5 students
    for s in students[2:7]:
        enroll(s, toefl)
    db.commit()

    # ── Materials (real PDFs + ChromaDB index) ────────────────────────────────
    # Some demo PDFs are image-based and yield no extractable text via PyMuPDF.
    # For those, we inject canonical course content so the AI assistant has
    # substance to retrieve. The PDF stays downloadable as the official material.
    print("→ Uploading and indexing PDFs (this will take ~30s)…")
    FALLBACK_TEXT = {
        "ielts": IELTS_IDIOMS_TEXT,
        "toefl": TOEFL_SPEAKING_TEXT,
    }

    def upload(course, key):
        src, save_name = PDFS[key]
        dest = os.path.join("uploaded_materials", f"{course.id}_{save_name}")
        shutil.copy(src, dest)
        mat = models.MaterialFile(
            course_id=course.id, filename=save_name,
            filetype="application/pdf", path=dest,
        )
        db.add(mat)
        db.flush()
        text_content = extract_text(dest, "application/pdf")
        # If PDF is image-based (no extractable text), fall back to canonical content
        if not text_content.strip() and key in FALLBACK_TEXT:
            print(f"   (PDF for {key} is image-based — using canonical text)")
            text_content = FALLBACK_TEXT[key]
        if text_content.strip():
            index_in_chroma(chroma_client, text_content, mat.id, course.id)
        return mat

    upload(sat, "sat")
    upload(ielts, "ielts")
    upload(toefl, "toefl")
    db.commit()

    # ── Sessions ──────────────────────────────────────────────────────────────
    print("→ Scheduling sessions…")
    def sess(course, when, link="https://meet.google.com/abc-defg-hij"):
        s = models.Session(course_id=course.id, start_time=when, zoom_link=link)
        db.add(s); db.flush()
        return s

    sat_past1 = sess(sat, now - timedelta(days=7))
    sat_past2 = sess(sat, now - timedelta(days=3))
    sat_future = sess(sat, now + timedelta(days=2, hours=3))
    ielts_past = sess(ielts, now - timedelta(days=5))
    ielts_future = sess(ielts, now + timedelta(days=3, hours=1))
    toefl_future = sess(toefl, now + timedelta(days=1, hours=2))

    # Attendance on past sessions
    for s in students[:5]:
        sat_past1.attendees.append(s)
    for s in students[:4]:
        sat_past2.attendees.append(s)
    for s in students[:4]:
        ielts_past.attendees.append(s)
    db.commit()

    # ── Assignments ───────────────────────────────────────────────────────────
    print("→ Creating assignments…")
    asg_sat = models.Assignment(
        course_id=sat.id,
        title="Comma Splice Worksheet",
        description="Identify and correct comma splices in the 10 passages provided. Submit your corrected version as a PDF.",
        due_date=now + timedelta(days=5),
    )
    asg_ielts = models.Assignment(
        course_id=ielts.id,
        title="Use 10 Idioms in Original Sentences",
        description="Write original, context-appropriate sentences using 10 different idioms from this week's material. Underline the idiom in each sentence.",
        due_date=now + timedelta(days=4),
    )
    asg_toefl = models.Assignment(
        course_id=toefl.id,
        title="Record an Independent Speaking Response",
        description="Record yourself answering the prompt: 'Do you prefer studying alone or in a group?' Use the 45-second format. Submit the audio file.",
        due_date=now + timedelta(days=2),
    )
    db.add_all([asg_sat, asg_ielts, asg_toefl])
    db.commit()

    # ── Submissions ───────────────────────────────────────────────────────────
    print("→ Adding submissions and grades…")
    os.makedirs("uploaded_assignments", exist_ok=True)

    def submit(student, asg, grade=None, feedback=None, days_ago=1):
        path = f"uploaded_assignments/{student.id}_{asg.id}_submission.pdf"
        with open(path, "wb") as f:
            f.write(b"%PDF-1.4\n%demo submission file\n")
        db.add(models.AssignmentFile(
            student_id=student.id, assignment_id=asg.id,
            filename="submission.pdf", filetype="application/pdf",
            path=path, grade=grade, feedback=feedback,
            upload_time=now - timedelta(days=days_ago),
        ))

    # SAT submissions — varied grades
    submit(students[0], asg_sat, 85, "Great work on semicolons. Watch the Oxford comma in question 7.", days_ago=2)
    submit(students[1], asg_sat, 72, "Solid effort. Several comma splice errors in passages 4 and 8 — revisit lesson 3.")
    submit(students[2], asg_sat, 58, "Multiple comma splice errors throughout. Please rewatch the lesson and resubmit if you'd like.")
    submit(students[3], asg_sat, 91, "Excellent. Your dash usage is spot-on.")
    submit(students[4], asg_sat)  # ungraded

    submit(students[0], asg_ielts, 88, "Strong idiom use. 'Once in a blue moon' was slightly off-context.")
    submit(students[1], asg_ielts, 76, "Good range. A few idioms used too literally.")
    submit(students[2], asg_ielts, 65)

    submit(students[3], asg_toefl, 80, "Clear delivery. Try not to rush in the last 10 seconds.")
    submit(students[4], asg_toefl)  # ungraded

    db.commit()

    # ── Quizzes — hardcoded so we control the demo narrative ──────────────────
    print("→ Creating quizzes…")

    sat_qs = [
        {
            "question": "Which sentence correctly uses a semicolon?",
            "options": [
                "I love grammar; it is fascinating.",
                "I love grammar, it is fascinating.",
                "I love grammar; And it is fascinating.",
                "I love grammar: it is fascinating.",
            ],
            "correct_index": 0,
            "explanation": "A semicolon joins two related independent clauses without a conjunction.",
        },
        {
            "question": "Identify the comma splice:",
            "options": [
                "She studied hard, and she passed the exam.",
                "She studied hard, she passed the exam.",
                "She studied hard; she passed the exam.",
                "Although she studied hard, she passed the exam.",
            ],
            "correct_index": 1,
            "explanation": "A comma splice joins two independent clauses with only a comma — no conjunction. Option B does exactly this and is incorrect.",
        },
        {
            "question": "When should you use an Oxford comma?",
            "options": [
                "Never — it's always optional",
                "Before the final 'and' or 'or' in a list of three or more items",
                "Only in dialogue",
                "Only with proper nouns",
            ],
            "correct_index": 1,
            "explanation": "The Oxford comma sits before the final conjunction in a list of three+ items to prevent ambiguity.",
        },
        {
            "question": "Which sentence correctly uses a colon?",
            "options": [
                "I need three things: a pen, paper, and time.",
                "I need: a pen, paper, and time.",
                "I need three things; a pen, paper, and time.",
                "I need three things, a pen, paper, and time.",
            ],
            "correct_index": 0,
            "explanation": "A colon must follow an independent clause. 'I need three things' is complete, so the colon is correct here.",
        },
        {
            "question": "Which punctuation belongs in: 'The book ___ which won the Pulitzer ___ was a bestseller'?",
            "options": [
                "Hyphens (-)",
                "En dashes (–)",
                "Em dashes (—)",
                "Parentheses with hyphens",
            ],
            "correct_index": 2,
            "explanation": "Em dashes set off parenthetical information with more emphasis than commas or parentheses.",
        },
    ]

    ielts_qs = [
        {
            "question": "What does 'piece of cake' mean?",
            "options": ["A dessert", "Something very easy", "A small amount", "An argument"],
            "correct_index": 1,
            "explanation": "'Piece of cake' is an idiom meaning very easy.",
        },
        {
            "question": "If something 'costs an arm and a leg', it is:",
            "options": ["Free", "Cheap", "Very expensive", "Damaged"],
            "correct_index": 2,
            "explanation": "The idiom means extremely expensive.",
        },
        {
            "question": "'Once in a blue moon' refers to something that happens:",
            "options": ["Every month", "Very rarely", "Never", "Only at night"],
            "correct_index": 1,
            "explanation": "'Once in a blue moon' means very rarely. The phrase comes from the rare astronomical event.",
        },
        {
            "question": "'To break the ice' means to:",
            "options": [
                "End a friendship",
                "Start a conversation in a tense situation",
                "Cool a drink",
                "Cancel a plan",
            ],
            "correct_index": 1,
            "explanation": "It means to ease initial social tension by starting a friendly conversation.",
        },
        {
            "question": "If you 'hit the books', you are:",
            "options": ["Angry", "Reading for fun", "Studying hard", "Returning library books"],
            "correct_index": 2,
            "explanation": "'Hit the books' means to study intensively.",
        },
    ]

    toefl_qs = [
        {
            "question": "How long do you have to speak in the Independent Speaking task?",
            "options": ["15 seconds", "30 seconds", "45 seconds", "60 seconds"],
            "correct_index": 2,
            "explanation": "Independent Speaking gives 15 seconds to prepare, then exactly 45 seconds to respond.",
        },
        {
            "question": "Which structure works best for Independent Speaking?",
            "options": [
                "Story → Conclusion",
                "Opinion → Reason 1 → Reason 2",
                "Pros and cons list",
                "Single long anecdote",
            ],
            "correct_index": 1,
            "explanation": "State your opinion, then support with two developed reasons — this maximizes coherence and depth.",
        },
        {
            "question": "What is Integrated Speaking based on?",
            "options": [
                "Only your personal opinion",
                "A reading passage and/or lecture",
                "A memorized speech",
                "A conversation with the examiner",
            ],
            "correct_index": 1,
            "explanation": "Integrated Speaking combines reading and listening — you respond to material presented to you.",
        },
        {
            "question": "How is each TOEFL Speaking task scored?",
            "options": ["1-10 scale", "0-4 scale per task, scaled to 0-30", "Pass/fail", "Letter grade"],
            "correct_index": 1,
            "explanation": "Each task is rated 0-4 by graders; scores are averaged and scaled to a final 0-30.",
        },
        {
            "question": "Which is NOT recommended in TOEFL Speaking?",
            "options": [
                "Using transition words",
                "Memorizing template phrases word-for-word",
                "Giving specific examples",
                "Speaking at a natural pace",
            ],
            "correct_index": 1,
            "explanation": "Verbatim templates sound robotic. Graders are trained to penalize them — use them flexibly instead.",
        },
    ]

    sat_quiz = models.Quiz(
        course_id=sat.id, title="SAT Punctuation — Practice Quiz",
        questions=json.dumps(sat_qs), created_by=karimov.id,
    )
    ielts_quiz = models.Quiz(
        course_id=ielts.id, title="IELTS Idioms — Practice Quiz",
        questions=json.dumps(ielts_qs), created_by=sara.id,
    )
    toefl_quiz = models.Quiz(
        course_id=toefl.id, title="TOEFL Speaking — Practice Quiz",
        questions=json.dumps(toefl_qs), created_by=sara.id,
    )
    db.add_all([sat_quiz, ielts_quiz, toefl_quiz])
    db.commit()

    # ── Quiz attempts — engineered to drive the heatmap narrative ─────────────
    print("→ Recording quiz attempts (engineering the heatmap)…")
    def attempt(student, quiz, answers, days_ago=2):
        qs = json.loads(quiz.questions)
        correct = sum(1 for i, q in enumerate(qs) if answers[i] == q["correct_index"])
        score = round(correct / len(qs) * 100)
        db.add(models.QuizAttempt(
            student_id=student.id, quiz_id=quiz.id,
            score=score, answers=json.dumps(answers),
            attempted_at=now - timedelta(days=days_ago),
        ))

    # SAT: 4 of 5 students miss Q2 (comma splice) — class weakness
    attempt(students[0], sat_quiz, [0, 0, 1, 0, 2])   # 80%, missed Q2
    attempt(students[1], sat_quiz, [0, 0, 1, 1, 2])   # 60%, missed Q2 + Q4
    attempt(students[2], sat_quiz, [0, 0, 1, 0, 0])   # 60%, missed Q2 + Q5
    attempt(students[3], sat_quiz, [0, 1, 1, 0, 2])   # 100% — got Q2 right
    attempt(students[4], sat_quiz, [0, 0, 0, 0, 2])   # 60%, missed Q2 + Q3

    # IELTS: 3 of 3 miss Q3 (once in a blue moon)
    attempt(students[0], ielts_quiz, [1, 2, 0, 1, 2])  # Q3 wrong
    attempt(students[1], ielts_quiz, [1, 2, 2, 1, 2])  # Q3 wrong
    attempt(students[2], ielts_quiz, [1, 2, 0, 1, 2])  # Q3 wrong

    # TOEFL: 3 students miss Q1 (timing) — common misconception
    attempt(students[2], toefl_quiz, [1, 1, 1, 1, 1])
    attempt(students[3], toefl_quiz, [1, 1, 1, 1, 1])
    attempt(students[4], toefl_quiz, [3, 1, 1, 1, 1])

    db.commit()

    # ── AI usage logs (for the analytics number) ──────────────────────────────
    for s in students[:5]:
        for _ in range(3):
            db.add(models.AIUsageLog(
                student_id=s.id, course_id=sat.id,
                asked_at=now - timedelta(hours=12),
            ))
    db.commit()

    # ── Emma's notification feed (she's our demo student) ─────────────────────
    print("→ Seeding Emma's notifications…")
    emma = students[0]
    db.add_all([
        models.Notification(
            user_id=emma.id,
            message='Your submission for "Comma Splice Worksheet" was graded: 85/100',
            notif_type="grade", link="/exams", is_read=False,
            created_at=now - timedelta(hours=4),
        ),
        models.Notification(
            user_id=emma.id,
            message="New session in SAT Punctuation Mastery — Wednesday at 3:00 PM",
            notif_type="session", link="/dashboard", is_read=False,
            created_at=now - timedelta(hours=8),
        ),
        models.Notification(
            user_id=emma.id,
            message='New assignment in SAT Punctuation Mastery: "Comma Splice Worksheet"',
            notif_type="assignment", link="/exams", is_read=True,
            created_at=now - timedelta(days=2),
        ),
    ])
    db.commit()

    # ── Programs (course offerings with tiers + pricing) ──────────────────────
    print("→ Creating programs with pricing tiers…")

    def program(course, name, session_type, sessions_per_week, duration, price, max_students=1):
        p = models.Program(
            course_id=course.id,
            name=name,
            session_type=session_type,
            sessions_per_week=sessions_per_week,
            session_duration_minutes=duration,
            price_per_month=price,
            max_students_per_class=max_students,
        )
        db.add(p)
        db.flush()
        return p

    # Test-prep — premium pricing
    sat_indiv_2x = program(sat, "Individual · 2 sessions/week", "individual", 2, 60, 280)
    sat_indiv_3x = program(sat, "Individual · 3 sessions/week", "individual", 3, 60, 400)
    sat_group_2x = program(sat, "Group · 2 sessions/week", "group", 2, 90, 180, max_students=6)

    ielts_indiv_2x = program(ielts, "Individual · 2 sessions/week", "individual", 2, 60, 260)
    ielts_group_2x = program(ielts, "Group · 2 sessions/week", "group", 2, 90, 160, max_students=6)

    toefl_indiv_2x = program(toefl, "Individual · 2 sessions/week", "individual", 2, 60, 280)
    toefl_indiv_3x = program(toefl, "Individual · 3 sessions/week", "individual", 3, 60, 400)

    # School subjects — friendlier pricing
    algebra_indiv_2x = program(algebra, "Individual · 2 sessions/week", "individual", 2, 60, 200)
    algebra_indiv_3x = program(algebra, "Individual · 3 sessions/week", "individual", 3, 60, 280)
    algebra_group_2x = program(algebra, "Group · 2 sessions/week", "group", 2, 90, 120, max_students=8)

    calculus_indiv_2x = program(calculus, "Individual · 2 sessions/week", "individual", 2, 60, 240)
    calculus_indiv_3x = program(calculus, "Individual · 3 sessions/week", "individual", 3, 60, 340)
    calculus_group_2x = program(calculus, "Group · 2 sessions/week", "group", 2, 120, 160, max_students=6)

    geometry_indiv_2x = program(geometry, "Individual · 2 sessions/week", "individual", 2, 60, 200)
    geometry_group_2x = program(geometry, "Group · 2 sessions/week", "group", 2, 90, 120, max_students=8)

    db.commit()

    # ── Tutor availability (recurring weekly windows) ─────────────────────────
    print("→ Setting tutor weekly availability…")

    def avail(tutor, day, start, end):
        db.add(models.TutorAvailability(
            tutor_id=tutor.id, day_of_week=day,
            start_time=start, end_time=end,
        ))

    # Aslan Karimov: Mon/Wed/Fri afternoons, Tue/Thu evenings
    avail(karimov, 0, "14:00", "20:00")   # Monday
    avail(karimov, 1, "16:00", "20:00")   # Tuesday
    avail(karimov, 2, "14:00", "20:00")   # Wednesday
    avail(karimov, 3, "16:00", "20:00")   # Thursday
    avail(karimov, 4, "14:00", "18:00")   # Friday

    # Sara Mammadova: Mon/Tue/Wed/Thu/Fri afternoons + Saturday morning
    avail(sara, 0, "10:00", "16:00")
    avail(sara, 1, "10:00", "18:00")
    avail(sara, 2, "10:00", "18:00")
    avail(sara, 3, "10:00", "16:00")
    avail(sara, 4, "12:00", "18:00")
    avail(sara, 5, "10:00", "14:00")      # Saturday

    db.commit()

    # ── Pre-book some students into recurring slots ───────────────────────────
    print("→ Booking some students into recurring slots…")

    def book_program(student, prog, slots_data):
        """Create ProgramEnrollment + ScheduledClasses + memberships.
        Also ensures the legacy Enrollment exists for AI features."""
        e = models.ProgramEnrollment(
            student_id=student.id,
            program_id=prog.id,
            payment_status="paid" if (student.id % 3 != 0) else "pending",
            amount_paid=prog.price_per_month if (student.id % 3 != 0) else 0,
            payment_due_date=now + timedelta(days=7),
            enrolled_at=now - timedelta(days=14),
        )
        db.add(e)
        db.flush()

        # Bridge: ensure legacy enrollment exists so AI features work
        legacy = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == student.id,
            models.Enrollment.course_id == prog.course_id,
        ).first()
        if not legacy:
            db.add(models.Enrollment(
                student_id=student.id,
                course_id=prog.course_id,
                enrolled_at=now - timedelta(days=14),
            ))
        for tutor_id, day, start in slots_data:
            # Find or create scheduled class
            sc = db.query(models.ScheduledClass).filter(
                models.ScheduledClass.tutor_id == tutor_id,
                models.ScheduledClass.day_of_week == day,
                models.ScheduledClass.start_time == start,
            ).first()
            if not sc:
                sc = models.ScheduledClass(
                    tutor_id=tutor_id,
                    program_id=prog.id,
                    day_of_week=day,
                    start_time=start,
                    duration_minutes=prog.session_duration_minutes,
                    max_students=prog.max_students_per_class,
                )
                db.add(sc)
                db.flush()
            db.add(models.ScheduledClassMember(
                scheduled_class_id=sc.id,
                program_enrollment_id=e.id,
            ))

    # Emma: SAT Individual 3x/week with Karimov
    book_program(students[0], sat_indiv_3x, [
        (karimov.id, 0, "16:00"),  # Mon 16:00
        (karimov.id, 2, "16:00"),  # Wed 16:00
        (karimov.id, 4, "16:00"),  # Fri 16:00
    ])

    # Emma also: IELTS Individual 2x/week with Sara
    book_program(students[0], ielts_indiv_2x, [
        (sara.id, 1, "12:00"),     # Tue 12:00
        (sara.id, 3, "12:00"),     # Thu 12:00
    ])

    # Liam: SAT Group 2x/week
    book_program(students[1], sat_group_2x, [
        (karimov.id, 1, "17:00"),  # Tue 17:00 (90 min)
        (karimov.id, 3, "17:00"),  # Thu 17:00
    ])

    # Olivia: same SAT Group with Liam (group classes share)
    book_program(students[2], sat_group_2x, [
        (karimov.id, 1, "17:00"),
        (karimov.id, 3, "17:00"),
    ])

    # Noah: Calculus Individual 2x with Sara
    book_program(students[3], calculus_indiv_2x, [
        (sara.id, 1, "15:00"),    # Tue 15:00
        (sara.id, 3, "15:00"),    # Thu 15:00
    ])

    # Sophia: IELTS Individual 2x with Sara
    book_program(students[4], ielts_indiv_2x, [
        (sara.id, 0, "11:00"),    # Mon 11:00
        (sara.id, 2, "11:00"),    # Wed 11:00
    ])

    # Mateo: Algebra Group 2x with Karimov (90 min)
    book_program(students[5], algebra_group_2x, [
        (karimov.id, 0, "18:30"),
        (karimov.id, 2, "18:30"),
    ])

    db.commit()

    db.close()

    print()
    print("=" * 60)
    print("✅  DEMO DATA SEEDED")
    print("=" * 60)
    print(f"Password for ALL accounts: {PASSWORD}")
    print()
    print("Demo accounts:")
    print("  🛡️  Admin:    admin@nuvra.demo")
    print("  👨‍🏫  Tutor 1:  karimov@nuvra.demo  (SAT Punctuation)")
    print("  👩‍🏫  Tutor 2:  sara@nuvra.demo     (IELTS + TOEFL)")
    print("  🎓  Student:  emma@nuvra.demo     ← main demo student")
    print()
    print("Other students (for the heatmap):")
    print("  liam@, olivia@, noah@, sophia@, mateo@, ava@, leyla@")
    print()
    print("Stats:")
    print("  • 3 courses, real PDFs indexed into ChromaDB")
    print("  • 8 students enrolled across courses")
    print("  • 6 sessions (3 past with attendance, 3 upcoming)")
    print("  • 3 assignments with mix of graded + ungraded submissions")
    print("  • 3 quizzes with engineered weakness patterns")
    print("  • Emma has 2 unread notifications")
    print()


if __name__ == "__main__":
    wipe_everything()
    seed()

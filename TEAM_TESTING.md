# NUVRA — Team Testing Guide

Welcome! You're testing NUVRA, an AI-powered tutoring center management system. Three teammates will run it together on the same WiFi, each playing a different role.

---

## 🎯 What you'll test

1. **Student** — books classes, attends them, uses AI tools, takes quizzes
2. **Tutor** — sees their schedule, students, grades work, generates AI quizzes
3. **Admin** — manages the center: schedules, payments, tutor earnings

---

## 🚀 Setup (host machine only)

The **host** is whoever has the code. Teammates will connect to you over WiFi — you don't share the code itself.

### One-time setup (host)

```bash
cd /path/to/genius-learn-ai-1

# Python venv (skip if .venv/ already exists)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend deps
npm install

# Make sure .env has DATABASE_URL, GOOGLE_API_KEY (Gemini), SECRET_KEY
# (We assume the host already has this set up.)
```

### Seed demo data (host)

```bash
.venv/bin/python seed_demo.py
```

This wipes the DB and loads:
- 3 tutors (1 admin), 8 students
- 6 courses (SAT, IELTS, TOEFL, Algebra, Calculus, Geometry)
- 15 programs (individual + group offerings, $120-$400/month)
- Tutor availability + 13 booked class slots
- Real PDFs indexed into ChromaDB for AI assistant

### Start the system (host)

```bash
./start.sh
```

You'll see output like:
```
  Frontend (this machine):  http://localhost:8080
  Frontend (teammates):     http://192.168.1.42:8080
  Backend API:              http://192.168.1.42:8000
```

**Share the second URL** (`http://192.168.1.42:8080` or whatever yours is) with your teammates over Slack/iMessage/etc.

---

## 👥 Login credentials (everyone uses these)

Password for **all** accounts: `demo1234`

### Recommended role assignments

| Role | Email | Best for |
|------|-------|----------|
| **Student** | `emma@nuvra.demo` | Teammate A — has pre-seeded SAT enrollment, "Focus on" recommendation |
| **Tutor** | `karimov@nuvra.demo` | Teammate B — teaches SAT + Algebra, has 7 active classes |
| **Admin** | `admin@nuvra.demo` | Teammate C — sees everything, manages money + schedules |

### Other students you can log in as
`liam@`, `olivia@`, `noah@`, `sophia@`, `mateo@`, `ava@`, `leyla@` — all `@nuvra.demo` / `demo1234`

### Other tutor
`sara@nuvra.demo` — teaches IELTS + TOEFL + Calculus

---

## ✅ Test checklist by role

### As STUDENT (Emma)

- [ ] Log in → see **personalized "Focus on" card** (your weakness)
- [ ] Click **Schedule** in nav → see your 3 weekly SAT classes
- [ ] Click **Courses** → pick **Calculus** → click **Enroll & pick schedule**
- [ ] Pick a program (try the Individual 2x/week)
- [ ] Pick 2 different time slots
- [ ] Confirm booking → see "Pending payment" notification
- [ ] Open **AI Assistant** → ask a question about SAT punctuation → see citations from real PDF
- [ ] Click into SAT course → **Quizzes** tab → take a quiz → intentionally pick the wrong answer on Q2 (comma splice) → submit → click **"✨ Ask AI why I got this wrong"**
- [ ] Try **AI Practice Mode** button on the SAT course → get a few questions, watch the difficulty adapt
- [ ] Try **Study Guide** tab → generate or view the cached one
- [ ] Open notifications bell → see schedule + grade notifications

### As TUTOR (Karimov)

- [ ] Log in → see your tutor dashboard
- [ ] Click **Schedule** → **Today** tab → see today's classes with student rosters
- [ ] Switch to **Full Week** → see all 7 classes across the week
- [ ] Switch to **Availability** → add a new availability block (e.g., Saturday 10:00–14:00)
- [ ] Click **Students** → see class weakness heatmap (80% wrong on comma splices)
- [ ] Click **Exams** → see assignments, grade an ungraded submission
- [ ] On tutor dashboard, click **✨ AI Quiz** to generate a fresh quiz from your course PDFs
- [ ] Verify you get an in-app notification when a student enrolls (have Teammate A enroll while you watch)

### As ADMIN

- [ ] Log in → see admin dashboard with "Open Admin Panel" button
- [ ] Click **Operations** in nav → see master schedule grid with ALL classes from ALL tutors
- [ ] Switch to **Revenue** tab → see total paid, pending, overdue + status breakdown bars
- [ ] Switch to **Payments** tab → for any "pending" enrollment, click **Mark paid** — verify revenue updates
- [ ] On a pending enrollment, click **Remind** — student should get a notification
- [ ] Switch to **Tutor Earnings** → see per-tutor revenue
- [ ] Open **Admin** panel from nav → see overview, users, enrollments
- [ ] Notice schedule auto-refreshes every 20 seconds — when Teammate A books a new class, it appears here

---

## 🔥 The "wow" moment to demo together

**All three teammates online at once**:

1. **Admin** opens **Operations → Master Schedule** on screen
2. **Student** (Teammate A) goes to a course, picks Calculus Individual 2x/week, picks 2 slots, clicks Confirm
3. **Tutor** (Teammate B, who teaches Calculus) gets an **in-app notification** within seconds
4. Within 20 seconds the **Admin** sees the new class appear on the master grid
5. **Admin** marks the payment as paid → Student gets a notification → Admin's revenue ticker updates

That's a real-time multi-role center management system in action.

---

## 🐛 If something breaks

| Problem | Fix |
|---------|-----|
| Frontend can't reach backend | Firewall: macOS may ask permission. Allow incoming connections to `python` and `node`. Or try `127.0.0.1` to verify locally first. |
| Backend won't start | Check `/tmp/nuvra-backend.log` for errors |
| Data looks weird | Re-seed: `.venv/bin/python seed_demo.py` |
| Port in use | `pkill -f uvicorn ; pkill -f vite` then `./start.sh` |
| Gemini "503 unavailable" | Wait 30s and retry — Gemini Flash gets rate limited occasionally. Study guides are cached so they still work. |
| Login fails | Make sure you're on `http://<host-ip>:8080` not `:8000` |

---

## 📂 Where things live

| Concern | File |
|---------|------|
| Backend API | `main.py` — entry point. Module files per domain: `auth.py`, `courses.py`, `scheduling.py`, `financier.py`, etc. |
| Frontend | `src/pages/` (one file per route). `src/lib/api.ts` is the single API client. |
| Database models | `models.py` |
| Demo data | `seed_demo.py` |
| Tutor's uploaded materials | `uploaded_materials/` |
| Student submissions | `uploaded_assignments/` |
| AI study guide cache | `cached_study_guides/` |
| ChromaDB vector store | `chroma_db/` |

---

## 🛑 When you're done testing

Press **Ctrl+C** in the host's terminal — that stops both backend and frontend.

If you want to start fresh tomorrow, run `seed_demo.py` again. Takes 10 seconds.

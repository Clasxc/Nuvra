# quizzes.py — AI-generated quiz system
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

import chromadb
from google import genai

import models, config
from database import get_db, get_chroma_client
from auth import get_current_user, has_role
from permissions import user_is_course_instructor

# Reuse the same Gemini client pattern from assistant.py
_client = None
if config.GOOGLE_API_KEY:
    try:
        _client = genai.Client(api_key=config.GOOGLE_API_KEY)
    except Exception as e:
        print(f"Quizzes: Gemini client failed: {e}")

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class QuizQuestion(BaseModel):
    question: str
    options: List[str]       # 4 options, e.g. ["Paris", "London", "Berlin", "Rome"]
    correct_index: int       # 0-3
    explanation: str


class QuizOut(BaseModel):
    id: int
    course_id: int
    title: str
    questions: List[QuizQuestion]
    created_at: datetime

    class Config:
        from_attributes = True


class QuizSummary(BaseModel):
    id: int
    course_id: int
    title: str
    question_count: int
    created_at: datetime
    my_best_score: Optional[int] = None


class AttemptRequest(BaseModel):
    answers: List[int]  # one chosen option index per question


class AttemptResult(BaseModel):
    score: int          # percentage 0-100
    total: int
    correct: int
    per_question: List[dict]  # {correct: bool, chosen: int, correct_index: int, explanation: str}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_questions(raw: str) -> List[QuizQuestion]:
    """Parse Gemini JSON output into QuizQuestion list."""
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    data = json.loads(text)
    return [QuizQuestion(**q) for q in data]


def _fetch_course_context(course_id: int, chroma_client) -> str:
    """Get up to 10 text chunks from ChromaDB for a course."""
    try:
        collection = chroma_client.get_or_create_collection("course_materials")
        results = collection.query(
            query_texts=["study material concepts key points"],
            n_results=10,
            where={"course_id": course_id},
        )
        if results and results.get("documents") and results["documents"][0]:
            return "\n---\n".join(results["documents"][0])
    except Exception as e:
        print(f"ChromaDB fetch for quiz failed: {e}")
    return ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate/{course_id}", response_model=QuizOut)
def generate_quiz(
    course_id: int,
    db: Session = Depends(get_db),
    chroma_client: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    """Tutor generates an AI quiz for a course based on its uploaded materials."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not user_is_course_instructor(db, current_user, course.id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    context = _fetch_course_context(course_id, chroma_client)
    if not context:
        raise HTTPException(
            status_code=400,
            detail="No materials uploaded for this course yet. Upload PDFs first."
        )

    if not _client:
        raise HTTPException(status_code=500, detail="Gemini not configured.")

    prompt = f"""You are an expert quiz creator. Based ONLY on the course material below,
create exactly 5 multiple-choice questions to test student understanding.

Rules:
- Each question must be answerable from the provided material only.
- 4 answer options per question (clear, plausible distractors).
- Include a short explanation for why the correct answer is right.
- Return ONLY valid JSON — no markdown, no extra text.

Format (JSON array):
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Brief explanation why Option A is correct."
  }}
]

COURSE MATERIAL:
{context}

JSON:"""

    try:
        response = _client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = response.text or ""
        questions = _parse_questions(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")

    quiz = models.Quiz(
        course_id=course_id,
        title=f"{course.title} — Quiz",
        questions=json.dumps([q.dict() for q in questions]),
        created_by=current_user.id,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return QuizOut(
        id=quiz.id,
        course_id=quiz.course_id,
        title=quiz.title,
        questions=questions,
        created_at=quiz.created_at,
    )


@router.get("/course/{course_id}", response_model=List[QuizSummary])
def list_course_quizzes(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all quizzes for a course with the current student's best score."""
    quizzes = db.query(models.Quiz).filter(models.Quiz.course_id == course_id).all()
    result = []
    for q in quizzes:
        questions = json.loads(q.questions)
        best = None
        if current_user.role == "student":
            attempts = db.query(models.QuizAttempt).filter(
                models.QuizAttempt.quiz_id == q.id,
                models.QuizAttempt.student_id == current_user.id,
            ).all()
            if attempts:
                best = max(a.score for a in attempts)
        result.append(QuizSummary(
            id=q.id,
            course_id=q.course_id,
            title=q.title,
            question_count=len(questions),
            created_at=q.created_at,
            my_best_score=best,
        ))
    return result


class QuizQuestionForTaking(BaseModel):
    """Quiz question stripped of the answer — what students see before submitting."""
    question: str
    options: List[str]


class QuizOutForTaking(BaseModel):
    id: int
    course_id: int
    title: str
    questions: List[QuizQuestionForTaking]
    created_at: datetime

    class Config:
        from_attributes = True


# IMPORTANT: this MUST be declared before `/{quiz_id}` — otherwise FastAPI
# matches "my-focus" as a quiz_id and returns 422.
@router.get("/my-focus")
def my_personalized_focus_v2(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Returns the student's #1 personal weakness across all quiz attempts."""
    attempts = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == current_user.id
    ).all()
    if not attempts:
        return None

    wrong_map: dict = {}
    for a in attempts:
        quiz = db.query(models.Quiz).filter(models.Quiz.id == a.quiz_id).first()
        if not quiz:
            continue
        questions = json.loads(quiz.questions)
        ans = json.loads(a.answers)
        for q_idx, q in enumerate(questions):
            if q_idx >= len(ans):
                continue
            if ans[q_idx] != q["correct_index"]:
                key = (a.quiz_id, q_idx)
                wrong_map[key] = wrong_map.get(key, 0) + 1

    if not wrong_map:
        return None

    (quiz_id, q_idx), wrong_count = max(wrong_map.items(), key=lambda x: x[1])
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    course = db.query(models.Course).filter(models.Course.id == quiz.course_id).first()
    questions = json.loads(quiz.questions)
    q = questions[q_idx]
    topic = q["question"].rstrip("?:.").strip()
    if len(topic) > 70:
        topic = topic[:67] + "..."

    return {
        "topic": topic,
        "quiz_id": quiz_id,
        "quiz_title": quiz.title,
        "course_id": quiz.course_id,
        "course_title": course.title if course else "",
        "wrong_count": wrong_count,
    }


@router.get("/{quiz_id}", response_model=QuizOutForTaking)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get a quiz with all questions. Answers are stripped from the response
    so a clever student can't peek via the network tab."""
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    raw = json.loads(quiz.questions)
    questions = [QuizQuestionForTaking(question=q["question"], options=q["options"]) for q in raw]
    return QuizOutForTaking(
        id=quiz.id,
        course_id=quiz.course_id,
        title=quiz.title,
        questions=questions,
        created_at=quiz.created_at,
    )


@router.post("/{quiz_id}/attempt", response_model=AttemptResult)
def submit_attempt(
    quiz_id: int,
    body: AttemptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Student submits their answers and gets scored immediately."""
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = [QuizQuestion(**q) for q in json.loads(quiz.questions)]
    if len(body.answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count must match question count")

    correct_count = 0
    per_question = []
    for i, (q, chosen) in enumerate(zip(questions, body.answers)):
        is_correct = (chosen == q.correct_index)
        if is_correct:
            correct_count += 1
        per_question.append({
            "correct": is_correct,
            "chosen": chosen,
            "correct_index": q.correct_index,
            "explanation": q.explanation,
        })

    score = round(correct_count / len(questions) * 100)

    attempt = models.QuizAttempt(
        student_id=current_user.id,
        quiz_id=quiz_id,
        score=score,
        answers=json.dumps(body.answers),
    )
    db.add(attempt)
    db.commit()

    return AttemptResult(
        score=score,
        total=len(questions),
        correct=correct_count,
        per_question=per_question,
    )


@router.get("/course/{course_id}/weakness-analysis")
def class_weakness_analysis(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    """Tutor analytics: for each quiz question in this course, what % of
    students got it wrong, and which wrong option did they choose most.
    Used to power the class weakness heatmap."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not user_is_course_instructor(db, current_user, course.id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    quizzes = db.query(models.Quiz).filter(models.Quiz.course_id == course_id).all()
    breakdown = []

    for quiz in quizzes:
        questions = json.loads(quiz.questions)
        attempts = db.query(models.QuizAttempt).filter(
            models.QuizAttempt.quiz_id == quiz.id
        ).all()

        if not attempts:
            continue

        for q_idx, q in enumerate(questions):
            wrong_count = 0
            wrong_option_counts: dict = {}
            for a in attempts:
                ans = json.loads(a.answers)
                if q_idx >= len(ans):
                    continue
                chosen = ans[q_idx]
                if chosen != q["correct_index"]:
                    wrong_count += 1
                    wrong_option_counts[chosen] = wrong_option_counts.get(chosen, 0) + 1

            total = len(attempts)
            wrong_pct = round(wrong_count / total * 100) if total else 0

            most_common_wrong = None
            if wrong_option_counts:
                most_common_wrong_idx = max(wrong_option_counts, key=wrong_option_counts.get)
                most_common_wrong = {
                    "option_index": most_common_wrong_idx,
                    "option_text": q["options"][most_common_wrong_idx],
                    "count": wrong_option_counts[most_common_wrong_idx],
                }

            # Short topic label — first ~60 chars of question, no trailing punct
            topic = q["question"].rstrip("?:.").strip()
            if len(topic) > 60:
                topic = topic[:57] + "..."

            breakdown.append({
                "quiz_id": quiz.id,
                "quiz_title": quiz.title,
                "question_index": q_idx,
                "topic": topic,
                "question": q["question"],
                "correct_answer": q["options"][q["correct_index"]],
                "total_attempts": total,
                "wrong_count": wrong_count,
                "wrong_pct": wrong_pct,
                "most_common_wrong": most_common_wrong,
            })

    # Sort by wrong_pct DESC — show biggest weaknesses first
    breakdown.sort(key=lambda x: x["wrong_pct"], reverse=True)
    return breakdown


class ExplainMistakeRequest(BaseModel):
    question_index: int
    chosen_index: int


class ExplainMistakeResponse(BaseModel):
    explanation: str


@router.post("/{quiz_id}/explain-mistake", response_model=ExplainMistakeResponse)
def explain_mistake(
    quiz_id: int,
    body: ExplainMistakeRequest,
    db: Session = Depends(get_db),
    chroma_client: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a personalized, RAG-grounded explanation for why the
    student's specific wrong answer is wrong. The signature NUVRA feature."""
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = json.loads(quiz.questions)
    if body.question_index < 0 or body.question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")
    q = questions[body.question_index]

    if body.chosen_index < 0 or body.chosen_index >= len(q["options"]):
        raise HTTPException(status_code=400, detail="Invalid option index")
    if body.chosen_index == q["correct_index"]:
        return ExplainMistakeResponse(
            explanation="That's actually the correct answer — well done!"
        )

    course = db.query(models.Course).filter(models.Course.id == quiz.course_id).first()
    course_title = course.title if course else "this course"

    # Retrieve grounded context from the tutor's actual uploaded materials
    context = ""
    try:
        collection = chroma_client.get_or_create_collection("course_materials")
        results = collection.query(
            query_texts=[q["question"]],
            n_results=4,
            where={"course_id": quiz.course_id},
        )
        if results and results.get("documents") and results["documents"][0]:
            context = "\n---\n".join(results["documents"][0])
    except Exception as e:
        print(f"ChromaDB retrieval failed for explain-mistake: {e}")

    chosen_text = q["options"][body.chosen_index]
    correct_text = q["options"][q["correct_index"]]

    prompt = f"""You are a warm, encouraging tutor helping a student understand why they got a quiz question wrong.

Course: {course_title}

Question: {q["question"]}

The student chose: "{chosen_text}"
The correct answer: "{correct_text}"

Course material (use this to ground your explanation in what the tutor taught):
{context if context else "(no material available — explain from general knowledge)"}

Write a personalized explanation (3-4 sentences) that:
1. Acknowledges what they picked without making them feel bad
2. Explains the specific MISCONCEPTION behind their choice — why "{chosen_text}" might *seem* right
3. Walks them through why "{correct_text}" is correct, referencing the material
4. Ends with a quick tip to remember it next time

Tone: warm, like a real tutor sitting next to them. Use "you" — speak directly to the student. No bullet points.

YOUR RESPONSE:"""

    if not _client:
        raise HTTPException(status_code=500, detail="AI is not configured.")

    try:
        response = _client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        explanation = (response.text or "").strip()
        if not explanation:
            explanation = q.get("explanation", "Review the course material and try again.")
    except Exception as e:
        print(f"Gemini explain-mistake failed: {e}")
        # Graceful fallback — never break the demo
        explanation = q.get("explanation", "Review the course material on this topic and try again.")

    return ExplainMistakeResponse(explanation=explanation)


@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    course = db.query(models.Course).filter(models.Course.id == quiz.course_id).first()
    if course and not user_is_course_instructor(db, current_user, course.id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")
    db.delete(quiz)
    db.commit()

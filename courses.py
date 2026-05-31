from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session, selectinload, joinedload
import chromadb
import os
import time

from google import genai

import models, config
from database import get_db, get_chroma_client
from auth import get_current_user, get_current_user_optional, has_role

from schemas import CourseResponse

# Reuse Gemini client pattern
_gemini_client = None
if config.GOOGLE_API_KEY:
    try:
        _gemini_client = genai.Client(api_key=config.GOOGLE_API_KEY)
    except Exception:
        pass

# File-based cache so study guides survive Gemini rate limits
STUDY_GUIDE_CACHE_DIR = "cached_study_guides"
os.makedirs(STUDY_GUIDE_CACHE_DIR, exist_ok=True)


def _study_guide_path(course_id: int) -> str:
    return os.path.join(STUDY_GUIDE_CACHE_DIR, f"course_{course_id}.md")


def _generate_guide_with_retry(prompt: str, max_retries: int = 2) -> str:
    """Call Gemini with retry-on-503 to handle transient rate limits."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = _gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = (response.text or "").strip()
            if text:
                return text
        except Exception as e:
            last_error = e
            msg = str(e)
            # Transient errors — retry with backoff
            if "503" in msg or "UNAVAILABLE" in msg or "RESOURCE_EXHAUSTED" in msg:
                if attempt < max_retries:
                    time.sleep(2 ** attempt)
                    continue
            raise
    if last_error:
        raise last_error
    return ""


def user_is_instructor(db: Session, user: models.User, course_id: int) -> bool:
    """True if the user is the primary tutor OR a co-teacher of the course.
    Admins always return True."""
    if user.role == "admin":
        return True
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        return False
    if course.tutor_id == user.id:
        return True
    link = db.query(models.CourseInstructor).filter(
        models.CourseInstructor.course_id == course_id,
        models.CourseInstructor.user_id == user.id,
    ).first()
    return link is not None


class CourseDetailResponse(BaseModel):
    id: int
    title: str
    description: str
    tutor_id: int
    tutor_name: str
    enrollment_count: int
    materials_count: int
    sessions_count: int
    is_enrolled: bool


class CourseCreate(BaseModel):
    title: str
    description: str
    tutor_id: int


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


router = APIRouter(
    prefix="/courses",
    tags=["courses"],
)


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course: CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    if current_user.role == "tutor" and course.tutor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tutors can only create courses with their own tutor_id"
        )

    db_course = models.Course(
        title=course.title,
        description=course.description,
        tutor_id=course.tutor_id
    )
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course


@router.get("/", response_model=List[CourseResponse])
def read_courses(db: Session = Depends(get_db)):
    """Public — anyone can browse courses on the marketing page."""
    return (
        db.query(models.Course)
        .options(selectinload(models.Course.sessions))
        .all()
    )


@router.get("/instructing-me", response_model=List[CourseResponse])
def courses_im_teaching(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    """Every course the current tutor is an instructor of — primary OR co-teacher.
    Admins see all courses (since they can edit everything)."""
    if current_user.role == "admin":
        return (
            db.query(models.Course)
            .options(selectinload(models.Course.sessions))
            .all()
        )

    # Primary
    primary = db.query(models.Course).filter(
        models.Course.tutor_id == current_user.id
    ).options(selectinload(models.Course.sessions)).all()

    # Co-teacher links
    co_links = db.query(models.CourseInstructor).filter(
        models.CourseInstructor.user_id == current_user.id
    ).all()
    co_course_ids = {l.course_id for l in co_links}
    co_courses = (
        db.query(models.Course)
        .options(selectinload(models.Course.sessions))
        .filter(models.Course.id.in_(co_course_ids))
        .all() if co_course_ids else []
    )

    seen = set()
    result: List[models.Course] = []
    for c in primary + co_courses:
        if c.id in seen:
            continue
        seen.add(c.id)
        result.append(c)
    return result


@router.get("/{course_id}", response_model=CourseResponse)
def read_course(course_id: int, db: Session = Depends(get_db)):
    """Public — anyone can view a course."""
    course = (
        db.query(models.Course)
        .options(selectinload(models.Course.sessions))
        .filter(models.Course.id == course_id)
        .first()
    )

    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.get("/{course_id}/detail", response_model=CourseDetailResponse)
def read_course_detail(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    tutor = db.query(models.User).filter(models.User.id == course.tutor_id).first()
    enrollment_count = db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).count()
    materials_count = db.query(models.MaterialFile).filter(models.MaterialFile.course_id == course_id).count()
    sessions_count = db.query(models.Session).filter(models.Session.course_id == course_id).count()
    is_enrolled = False
    if current_user and current_user.role == "student":
        is_enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == current_user.id,
            models.Enrollment.course_id == course_id,
        ).first() is not None

    return CourseDetailResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        tutor_id=course.tutor_id,
        tutor_name=tutor.name if tutor else "Unknown",
        enrollment_count=enrollment_count,
        materials_count=materials_count,
        sessions_count=sessions_count,
        is_enrolled=is_enrolled,
    )


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_update: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if current_user.role == "tutor" and course.tutor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own courses"
        )

    if course_update.title is not None:
        course.title = course_update.title
    if course_update.description is not None:
        course.description = course_update.description

    db.commit()
    db.refresh(course)
    return course


class PracticeHistoryItem(BaseModel):
    question: str
    was_correct: bool


class PracticeRequest(BaseModel):
    history: List[PracticeHistoryItem] = []


class PracticeQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    topic: str
    difficulty: str  # "easy" | "medium" | "hard"


@router.post("/{course_id}/practice/generate", response_model=PracticeQuestion)
def generate_practice_question(
    course_id: int,
    body: PracticeRequest,
    db: Session = Depends(get_db),
    chroma: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(get_current_user),
):
    """Generate one practice question adapted to the student's recent performance.
    Adapts difficulty: streak of correct answers → harder. Streak of wrong → easier."""
    import json as _json

    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role == "student":
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == current_user.id,
            models.Enrollment.course_id == course_id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Enroll in this course first")
    elif current_user.role == "tutor":
        if course.tutor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")

    # Determine difficulty from history
    recent = body.history[-3:] if body.history else []
    recent_correct = sum(1 for h in recent if h.was_correct)
    if not recent:
        difficulty = "medium"
    elif recent_correct == len(recent) and len(recent) >= 2:
        difficulty = "hard"
    elif recent_correct == 0 and len(recent) >= 2:
        difficulty = "easy"
    else:
        difficulty = "medium"

    # Avoid repeating recent questions
    recent_qs = "\n".join(f"- {h.question}" for h in body.history[-5:])

    # Pull material context — vary the retrieval query to surface different topics
    context = ""
    try:
        col = chroma.get_or_create_collection("course_materials")
        # Use a varied query so we don't pull the same chunks every time
        queries = [
            "concepts examples rules",
            "details exceptions practice",
            "advanced application strategy",
        ]
        import random
        q_text = random.choice(queries)
        results = col.query(
            query_texts=[q_text],
            n_results=8,
            where={"course_id": course_id},
        )
        if results and results.get("documents") and results["documents"][0]:
            context = "\n---\n".join(results["documents"][0])
    except Exception as e:
        print(f"Practice context fetch failed: {e}")

    if not context.strip():
        raise HTTPException(
            status_code=400,
            detail="No materials uploaded for this course yet."
        )

    if not _gemini_client:
        raise HTTPException(status_code=500, detail="AI is not configured.")

    history_block = (
        f"The student's recent performance: {recent_correct}/{len(recent)} correct."
        if recent else "This is the student's first question."
    )
    avoid_block = f"\n\nDO NOT repeat any of these recent questions:\n{recent_qs}" if recent_qs else ""

    prompt = f"""You are an expert practice question writer for {course.title}.

{history_block}
Target difficulty: {difficulty.upper()}

Generate ONE new multiple-choice practice question based on the course material below.

Rules:
- 4 answer options with plausible distractors
- Difficulty {difficulty}: {'simple, foundational' if difficulty=='easy' else 'tricky, edge-case' if difficulty=='hard' else 'standard application'}
- The question must be answerable from the material ONLY
- Include a short clear explanation
- "topic" is a 2-4 word label (e.g., "Comma Splices", "Semicolons", "Independent Speaking Timing")
{avoid_block}

Return ONLY valid JSON, no markdown fences:
{{
  "question": "...",
  "options": ["A...", "B...", "C...", "D..."],
  "correct_index": 0,
  "explanation": "...",
  "topic": "..."
}}

COURSE MATERIAL:
{context}

JSON:"""

    try:
        raw = _generate_guide_with_retry(prompt)
        # Strip code fences if Gemini added them
        text = raw.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        data = _json.loads(text)
        return PracticeQuestion(
            question=data["question"],
            options=data["options"],
            correct_index=int(data["correct_index"]),
            explanation=data["explanation"],
            topic=data.get("topic", "Practice"),
            difficulty=difficulty,
        )
    except _json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {e}")
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "503" in msg or "UNAVAILABLE" in msg:
            raise HTTPException(status_code=503, detail="The AI is temporarily busy. Try again in 30 seconds.")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {e}")


class StudyGuideResponse(BaseModel):
    course_id: int
    course_title: str
    content: str  # markdown


@router.post("/{course_id}/study-guide", response_model=StudyGuideResponse)
def generate_study_guide(
    course_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    chroma: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(get_current_user),
):
    """Generate an AI study guide from the course's uploaded materials.
    Returns a structured markdown summary the student can study from."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Access control: enrolled student, course tutor, or admin
    if current_user.role == "student":
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == current_user.id,
            models.Enrollment.course_id == course_id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Enroll in this course first")
    elif current_user.role == "tutor":
        if course.tutor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")

    # Return cached guide if present and not forcing regeneration
    cache_path = _study_guide_path(course_id)
    if not force and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return StudyGuideResponse(
                    course_id=course_id,
                    course_title=course.title,
                    content=f.read(),
                )
        except Exception as e:
            print(f"Cache read failed: {e}")

    # Pull a generous chunk of indexed material
    context = ""
    try:
        col = chroma.get_or_create_collection("course_materials")
        # Retrieve broad coverage — use multiple query intents
        results = col.query(
            query_texts=["key concepts main ideas summary overview"],
            n_results=20,
            where={"course_id": course_id},
        )
        if results and results.get("documents") and results["documents"][0]:
            context = "\n---\n".join(results["documents"][0])
    except Exception as e:
        print(f"ChromaDB fetch for study guide failed: {e}")

    if not context.strip():
        raise HTTPException(
            status_code=400,
            detail="No materials uploaded for this course yet. The tutor needs to upload materials first."
        )

    if not _gemini_client:
        raise HTTPException(status_code=500, detail="AI is not configured.")

    prompt = f"""You are an expert study coach. Generate a comprehensive, well-organized study guide for a student preparing for {course.title}.

Use ONLY the course material below. Don't add outside information.

Structure your response in clean markdown like this:

# 📚 {course.title} — Study Guide

## 🎯 Key Concepts
[3-5 most important concepts with 1-2 sentence explanations]

## 📋 Essential Rules / Facts
[Numbered list of the most important rules, formulas, or facts]

## 💡 Common Pitfalls
[Mistakes students typically make — be specific]

## ✅ Quick Checks
[3-5 self-test questions students should be able to answer]

## 🎓 Pro Tips
[2-3 strategy tips for mastery]

COURSE MATERIAL:
{context}

YOUR STUDY GUIDE (markdown):"""

    try:
        content = _generate_guide_with_retry(prompt)
        if not content:
            raise HTTPException(status_code=500, detail="AI returned an empty response.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Study guide generation failed: {e}")
        msg = str(e)
        if "503" in msg or "UNAVAILABLE" in msg:
            raise HTTPException(
                status_code=503,
                detail="The AI is temporarily busy. Please try again in 30 seconds.",
            )
        raise HTTPException(status_code=500, detail=f"Study guide generation failed: {e}")

    # Persist to cache so future requests are instant
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"Cache write failed: {e}")

    return StudyGuideResponse(
        course_id=course_id,
        course_title=course.title,
        content=content,
    )


class InstructorOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    role: str  # 'primary' | 'co_teacher'


class AddInstructorRequest(BaseModel):
    user_id: int
    role: str = "co_teacher"  # 'co_teacher' | 'primary'


@router.get("/{course_id}/instructors", response_model=List[InstructorOut])
def list_course_instructors(course_id: int, db: Session = Depends(get_db)):
    """Public — anyone can see who teaches a course."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    out: List[InstructorOut] = []
    # Primary (legacy tutor_id)
    primary = db.query(models.User).filter(models.User.id == course.tutor_id).first()
    if primary:
        out.append(InstructorOut(
            id=0, user_id=primary.id, user_name=primary.name,
            user_email=primary.email, role="primary",
        ))
    # Co-teachers (excluding any duplicate of primary)
    links = db.query(models.CourseInstructor).options(
        joinedload(models.CourseInstructor.user)
    ).filter(models.CourseInstructor.course_id == course_id).all()
    seen_ids = {course.tutor_id}
    for l in links:
        if not l.user or l.user_id in seen_ids:
            continue
        seen_ids.add(l.user_id)
        out.append(InstructorOut(
            id=l.id, user_id=l.user_id, user_name=l.user.name,
            user_email=l.user.email, role=l.role or "co_teacher",
        ))
    return out


@router.post("/{course_id}/instructors", response_model=InstructorOut, status_code=201)
def add_course_instructor(
    course_id: int,
    body: AddInstructorRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    """Admin adds a tutor as co-teacher (or new primary) for a course."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    tutor = db.query(models.User).filter(models.User.id == body.user_id).first()
    if not tutor or tutor.role not in ("tutor", "admin"):
        raise HTTPException(status_code=400, detail="User must be a tutor")
    if body.role not in ("primary", "co_teacher"):
        raise HTTPException(status_code=400, detail="role must be 'primary' or 'co_teacher'")

    if body.role == "primary":
        # Move the current primary into co_teacher (if different)
        if course.tutor_id and course.tutor_id != body.user_id:
            existing_link = db.query(models.CourseInstructor).filter(
                models.CourseInstructor.course_id == course_id,
                models.CourseInstructor.user_id == course.tutor_id,
            ).first()
            if not existing_link:
                db.add(models.CourseInstructor(
                    course_id=course_id, user_id=course.tutor_id, role="co_teacher",
                ))
        course.tutor_id = body.user_id

    # Ensure a CourseInstructor row exists for them (idempotent)
    link = db.query(models.CourseInstructor).filter(
        models.CourseInstructor.course_id == course_id,
        models.CourseInstructor.user_id == body.user_id,
    ).first()
    if not link:
        link = models.CourseInstructor(
            course_id=course_id, user_id=body.user_id, role=body.role,
        )
        db.add(link)
        db.flush()
    else:
        link.role = body.role
    db.commit()
    db.refresh(link)

    return InstructorOut(
        id=link.id, user_id=tutor.id, user_name=tutor.name,
        user_email=tutor.email, role=link.role,
    )


@router.delete("/{course_id}/instructors/{user_id}", status_code=204)
def remove_course_instructor(
    course_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    """Remove a tutor from a course. Cannot remove the primary tutor."""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.tutor_id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Can't remove the primary tutor. Assign a new primary first."
        )
    db.query(models.CourseInstructor).filter(
        models.CourseInstructor.course_id == course_id,
        models.CourseInstructor.user_id == user_id,
    ).delete(synchronize_session=False)
    db.commit()


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if current_user.role == "tutor" and course.tutor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own courses"
        )

    db.delete(course)
    db.commit()
    return {"message": "Course deleted successfully"}


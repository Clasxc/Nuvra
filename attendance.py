# attendance.py — code-based attendance marking
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

import models
from database import get_db
from auth import has_role

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CodeGenerateResponse(BaseModel):
    session_id: int
    code: str
    expires_at: datetime

class MarkAttendanceRequest(BaseModel):
    code: str

class AttendanceRecord(BaseModel):
    student_id: int
    name: str
    email: str


# ── Helper ────────────────────────────────────────────────────────────────────

def generate_code() -> str:
    """Generate a random 6-character alphanumeric code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate-code/{session_id}", response_model=CodeGenerateResponse)
def generate_attendance_code(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    """Tutor generates a 6-digit code for a session. Valid for 15 minutes."""
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify tutor owns this course
    if current_user.role == "tutor":
        course = db.query(models.Course).filter(
            models.Course.id == session.course_id
        ).first()
        if not course or course.tutor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")

    # Deactivate any existing active code for this session
    existing = db.query(models.AttendanceCode).filter(
        models.AttendanceCode.session_id == session_id,
        models.AttendanceCode.is_active == True
    ).first()
    if existing:
        existing.is_active = False
        db.commit()

    # Create new code — expires in 15 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    code = generate_code()

    new_code = models.AttendanceCode(
        session_id=session_id,
        code=code,
        expires_at=expires_at,
        is_active=True
    )
    db.add(new_code)
    db.commit()
    db.refresh(new_code)

    return CodeGenerateResponse(
        session_id=session_id,
        code=code,
        expires_at=expires_at,
    )


@router.get("/active-code/{session_id}", response_model=CodeGenerateResponse)
def get_active_code(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    """Get the currently active code for a session (tutor can re-display it)."""
    active = db.query(models.AttendanceCode).filter(
        models.AttendanceCode.session_id == session_id,
        models.AttendanceCode.is_active == True,
        models.AttendanceCode.expires_at > datetime.utcnow()
    ).first()

    if not active:
        raise HTTPException(status_code=404, detail="No active code for this session")

    return CodeGenerateResponse(
        session_id=session_id,
        code=active.code,
        expires_at=active.expires_at,
    )


@router.post("/mark/{session_id}")
def mark_attendance_with_code(
    session_id: int,
    request: MarkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    """Student submits a code to mark their attendance."""
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check enrollment
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id == session.course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    # Check already attended
    already = any(u.id == current_user.id for u in session.attendees)
    if already:
        raise HTTPException(status_code=400, detail="Attendance already marked")

    # Validate code
    code_record = db.query(models.AttendanceCode).filter(
        models.AttendanceCode.session_id == session_id,
        models.AttendanceCode.code == request.code.upper().strip(),
        models.AttendanceCode.is_active == True,
        models.AttendanceCode.expires_at > datetime.utcnow()
    ).first()

    if not code_record:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired code. Ask your tutor for the current code."
        )

    # Mark attendance
    session.attendees.append(current_user)
    db.commit()

    return {"message": "Attendance marked successfully", "session_id": session_id}


@router.get("/my-sessions", response_model=List[int])
def get_my_attended_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    """Returns list of session IDs the current student has attended."""
    attended = db.query(models.Session).filter(
        models.Session.attendees.any(id=current_user.id)
    ).all()
    return [s.id for s in attended]


@router.get("/session/{session_id}/students", response_model=List[AttendanceRecord])
def get_session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    """Returns list of students who attended a session."""
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == "tutor":
        course = db.query(models.Course).filter(
            models.Course.id == session.course_id
        ).first()
        if not course or course.tutor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")

    return [
        AttendanceRecord(student_id=u.id, name=u.name, email=u.email)
        for u in session.attendees
    ]
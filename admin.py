# admin.py — Admin panel API endpoints
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List
from datetime import datetime

import models
from database import get_db
from auth import has_role

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class PlatformStats(BaseModel):
    total_students: int
    total_tutors: int
    total_courses: int
    total_sessions: int
    total_enrollments: int
    total_ai_queries: int
    total_assignments: int
    total_submissions: int


class EnrollmentOut(BaseModel):
    enrollment_id: int
    student_id: int
    student_name: str
    student_email: str
    course_id: int
    course_title: str
    enrolled_at: datetime


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=PlatformStats)
def get_platform_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    return PlatformStats(
        total_students=db.query(models.User).filter(models.User.role == "student").count(),
        total_tutors=db.query(models.User).filter(models.User.role == "tutor").count(),
        total_courses=db.query(models.Course).count(),
        total_sessions=db.query(models.Session).count(),
        total_enrollments=db.query(models.Enrollment).count(),
        total_ai_queries=db.query(models.AIUsageLog).count(),
        total_assignments=db.query(models.Assignment).count(),
        total_submissions=db.query(models.AssignmentFile).count(),
    )


@router.get("/users", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    return db.query(models.User).order_by(models.User.id).all()


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(user)
    db.commit()


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    new_role = body.get("role")
    if new_role not in ("student", "tutor", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = new_role
    db.commit()
    return {"message": f"Role updated to {new_role}"}


@router.get("/enrollments", response_model=List[EnrollmentOut])
def list_all_enrollments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    enrollments = db.query(models.Enrollment).order_by(models.Enrollment.enrolled_at.desc()).all()
    result = []
    for e in enrollments:
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        course = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if not student or not course:
            continue
        result.append(EnrollmentOut(
            enrollment_id=e.id,
            student_id=e.student_id,
            student_name=student.name,
            student_email=student.email,
            course_id=e.course_id,
            course_title=course.title,
            enrolled_at=e.enrolled_at,
        ))
    return result


@router.delete("/enrollments/{enrollment_id}", status_code=204)
def delete_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    e = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(e)
    db.commit()


@router.delete("/courses/{course_id}", status_code=204)
def admin_delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()

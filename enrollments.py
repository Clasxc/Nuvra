from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List
from datetime import datetime
import threading

import models
from database import get_db
from auth import get_current_user, has_role
from email_service import send_email, email_enrollment_confirmation

router = APIRouter(
    prefix="/enrollments",
    tags=["Enrollments"],
)

class CourseMini(BaseModel):
    id: int
    title: str
    description: str
    tutor_id: int
    class Config:
        from_attributes = True

class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    enrolled_at: datetime
    course: CourseMini
    class Config:
        from_attributes = True


@router.post("/{course_id}", status_code=status.HTTP_201_CREATED)
def enroll_in_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    enrollment = models.Enrollment(student_id=current_user.id, course_id=course_id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Get tutor name for the email
    tutor = db.query(models.User).filter(models.User.id == course.tutor_id).first()
    tutor_name = tutor.name if tutor else "Your tutor"

    # Send confirmation email in background
    threading.Thread(
        target=send_email,
        args=(
            current_user.email,
            f"You're enrolled in {course.title}",
            email_enrollment_confirmation(current_user.name, course.title, tutor_name),
        ),
        daemon=True
    ).start()

    return {"message": "Enrolled successfully", "course_id": course_id}


@router.get("/my-courses", response_model=List[EnrollmentResponse])
def get_my_enrollments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    return db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id
    ).options(joinedload(models.Enrollment.course)).all()


@router.get("/course/{course_id}/students")
def get_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "tutor" and course.tutor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")

    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).options(joinedload(models.Enrollment.student)).all()

    return [
        {
            "student_id": e.student_id,
            "name": e.student.name,
            "email": e.student.email,
            "enrolled_at": e.enrolled_at,
        }
        for e in enrollments
    ]


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def unenroll_from_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(enrollment)
    db.commit()
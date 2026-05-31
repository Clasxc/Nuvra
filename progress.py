# progress.py — backend router for student progress data
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel
from datetime import datetime

import models
from database import get_db
from auth import get_current_user, has_role

router = APIRouter(prefix="/progress", tags=["Progress"])


class CourseProgress(BaseModel):
    course_id: int
    course_title: str
    enrolled_at: datetime
    total_sessions: int
    attended_sessions: int
    total_assignments: int
    submitted_assignments: int
    graded_assignments: int
    average_grade: float | None
    ai_questions_asked: int
    completion_percentage: float


class ProgressResponse(BaseModel):
    courses: List[CourseProgress]
    total_ai_questions: int
    total_sessions_attended: int
    total_assignments_submitted: int


@router.get("/me", response_model=ProgressResponse)
def get_my_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"]))
):
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id
    ).all()

    courses_progress = []

    for enrollment in enrollments:
        course = db.query(models.Course).filter(
            models.Course.id == enrollment.course_id
        ).first()
        if not course:
            continue

        # Sessions — total for course vs attended by student
        total_sessions = db.query(models.Session).filter(
            models.Session.course_id == course.id
        ).count()

        attended_sessions = db.query(models.Session).filter(
            models.Session.course_id == course.id,
            models.Session.attendees.any(id=current_user.id)
        ).count()

        # Assignments
        total_assignments = db.query(models.Assignment).filter(
            models.Assignment.course_id == course.id
        ).count()

        submitted_assignments = db.query(models.AssignmentFile).filter(
            models.AssignmentFile.student_id == current_user.id,
            models.AssignmentFile.assignment.has(course_id=course.id)
        ).count()

        graded_submissions = db.query(models.AssignmentFile).filter(
            models.AssignmentFile.student_id == current_user.id,
            models.AssignmentFile.assignment.has(course_id=course.id),
            models.AssignmentFile.grade.isnot(None)
        ).all()

        graded_count = len(graded_submissions)
        average_grade = None
        if graded_count > 0:
            average_grade = round(
                sum(s.grade for s in graded_submissions) / graded_count, 1
            )

        # AI usage for this course
        ai_questions = db.query(models.AIUsageLog).filter(
            models.AIUsageLog.student_id == current_user.id,
            models.AIUsageLog.course_id == course.id
        ).count()

        # Completion percentage
        # Formula: weight sessions 40%, assignments 60%
        session_score = (attended_sessions / total_sessions * 100) if total_sessions > 0 else 0
        assignment_score = (submitted_assignments / total_assignments * 100) if total_assignments > 0 else 0

        if total_sessions == 0 and total_assignments == 0:
            completion = 0.0
        elif total_sessions == 0:
            completion = round(assignment_score, 1)
        elif total_assignments == 0:
            completion = round(session_score, 1)
        else:
            completion = round(session_score * 0.4 + assignment_score * 0.6, 1)

        courses_progress.append(CourseProgress(
            course_id=course.id,
            course_title=course.title,
            enrolled_at=enrollment.enrolled_at,
            total_sessions=total_sessions,
            attended_sessions=attended_sessions,
            total_assignments=total_assignments,
            submitted_assignments=submitted_assignments,
            graded_assignments=graded_count,
            average_grade=average_grade,
            ai_questions_asked=ai_questions,
            completion_percentage=completion,
        ))

    total_ai = db.query(models.AIUsageLog).filter(
        models.AIUsageLog.student_id == current_user.id
    ).count()

    total_attended = sum(c.attended_sessions for c in courses_progress)
    total_submitted = sum(c.submitted_assignments for c in courses_progress)

    return ProgressResponse(
        courses=courses_progress,
        total_ai_questions=total_ai,
        total_sessions_attended=total_attended,
        total_assignments_submitted=total_submitted,
    )


# Tutor view — progress of all students in a course
@router.get("/course/{course_id}")
def get_course_progress(
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
    ).all()

    total_sessions = db.query(models.Session).filter(
        models.Session.course_id == course_id
    ).count()

    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.course_id == course_id
    ).count()

    result = []
    for e in enrollments:
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        attended = db.query(models.Session).filter(
            models.Session.course_id == course_id,
            models.Session.attendees.any(id=e.student_id)
        ).count()
        submitted = db.query(models.AssignmentFile).filter(
            models.AssignmentFile.student_id == e.student_id,
            models.AssignmentFile.assignment.has(course_id=course_id)
        ).count()
        ai_q = db.query(models.AIUsageLog).filter(
            models.AIUsageLog.student_id == e.student_id,
            models.AIUsageLog.course_id == course_id
        ).count()

        graded_subs = db.query(models.AssignmentFile).filter(
            models.AssignmentFile.student_id == e.student_id,
            models.AssignmentFile.assignment.has(course_id=course_id),
            models.AssignmentFile.grade.isnot(None)
        ).all()
        avg_grade = None
        if graded_subs:
            avg_grade = round(sum(s.grade for s in graded_subs) / len(graded_subs), 1)

        result.append({
            "student_id": e.student_id,
            "name": student.name,
            "email": student.email,
            "sessions_attended": attended,
            "total_sessions": total_sessions,
            "assignments_submitted": submitted,
            "total_assignments": total_assignments,
            "ai_questions_asked": ai_q,
            "average_grade": avg_grade,
            "enrolled_at": e.enrolled_at,
        })

    return result
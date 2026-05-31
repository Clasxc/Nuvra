# permissions.py — Shared authorization helpers used across routers.

from sqlalchemy.orm import Session
import models


def user_is_course_instructor(db: Session, user: models.User, course_id: int) -> bool:
    """True if the user is the primary tutor OR a co-teacher of the course.
    Admins always return True. This is the canonical permission check for
    course-content edits (assignments, materials, sessions, quizzes, etc.)."""
    if not user:
        return False
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

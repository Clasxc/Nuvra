from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session, joinedload, selectinload
import threading

import models
from database import get_db
from auth import get_current_user, has_role
from permissions import user_is_course_instructor
from schemas import SessionResponse
from email_service import send_email, email_new_session
from notification_service import create_notification

class SessionCreate(BaseModel):
    course_id: int
    start_time: datetime
    zoom_link: str

class SessionUpdate(BaseModel):
    start_time: Optional[datetime] = None
    zoom_link: Optional[str] = None

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session: SessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == session.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not user_is_course_instructor(db, current_user, session.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    db_session = models.Session(
        course_id=session.course_id,
        start_time=session.start_time,
        zoom_link=session.zoom_link
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    # Notify all enrolled students via email (in background)
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == session.course_id
    ).options(joinedload(models.Enrollment.student)).all()

    formatted_time = session.start_time.strftime("%A, %B %d %Y at %H:%M")

    for enrollment in enrollments:
        student = enrollment.student
        threading.Thread(
            target=send_email,
            args=(
                student.email,
                f"New session: {course.title}",
                email_new_session(
                    student.name,
                    course.title,
                    formatted_time,
                    session.zoom_link,
                ),
            ),
            daemon=True
        ).start()
        create_notification(
            db,
            user_id=student.id,
            message=f"New session in {course.title} on {formatted_time}",
            notif_type="session",
            link="/dashboard",
        )

    db.commit()
    return db_session


@router.get("/", response_model=List[SessionResponse])
def read_sessions(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Session).options(
        joinedload(models.Session.course),
        selectinload(models.Session.attendees),
    )
    if course_id is not None:
        query = query.filter(models.Session.course_id == course_id)
    return query.all()


@router.get("/{session_id}", response_model=SessionResponse)
def read_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    session = db.query(models.Session).options(
        joinedload(models.Session.course),
        selectinload(models.Session.attendees),
    ).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.put("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    session_update: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    course = db.query(models.Course).filter(models.Course.id == session.course_id).first()
    if not user_is_course_instructor(db, current_user, session.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")
    if session_update.start_time:
        session.start_time = session_update.start_time
    if session_update.zoom_link:
        session.zoom_link = session_update.zoom_link
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    course = db.query(models.Course).filter(models.Course.id == session.course_id).first()
    if not user_is_course_instructor(db, current_user, session.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}
# notifications.py — per-user notification system
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

import models
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationOut(BaseModel):
    id: int
    message: str
    notif_type: str
    is_read: bool
    link: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCount(BaseModel):
    count: int


@router.get("/", response_model=List[NotificationOut])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(30)
        .all()
    )


@router.get("/unread-count", response_model=UnreadCount)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,
        )
        .count()
    )
    return UnreadCount(count=count)


@router.put("/{notification_id}/read", status_code=204)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if n:
        n.is_read = True
        db.commit()


@router.put("/read-all", status_code=204)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if n:
        db.delete(n)
        db.commit()

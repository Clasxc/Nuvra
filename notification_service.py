# notification_service.py — helper used by other routers to fire notifications
from sqlalchemy.orm import Session
import models


def create_notification(
    db: Session,
    user_id: int,
    message: str,
    notif_type: str,
    link: str | None = None,
):
    n = models.Notification(
        user_id=user_id,
        message=message,
        notif_type=notif_type,
        link=link,
    )
    db.add(n)
    # caller is responsible for db.commit()

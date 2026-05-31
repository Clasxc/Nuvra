# financier.py — Payment tracking + revenue dashboard for admin

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db
from auth import has_role
from notification_service import create_notification

router = APIRouter(prefix="/financier", tags=["Financier"])


class RevenueSummary(BaseModel):
    total_revenue: int
    total_pending: int
    total_overdue: int
    paid_count: int
    pending_count: int
    overdue_count: int
    active_enrollments: int


class PaymentRow(BaseModel):
    enrollment_id: int
    student_id: int
    student_name: str
    student_email: str
    program_id: int
    program_name: str
    course_title: str
    price_per_month: int
    amount_paid: int
    payment_status: str
    payment_due_date: Optional[datetime]
    enrolled_at: datetime


class TutorEarningsRow(BaseModel):
    tutor_id: int
    tutor_name: str
    student_count: int
    active_classes: int
    monthly_revenue: int  # from active paid enrollments


class UpdatePaymentRequest(BaseModel):
    payment_status: str  # "paid" | "pending" | "overdue"
    amount_paid: Optional[int] = None


@router.get("/revenue", response_model=RevenueSummary)
def revenue_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    enrollments = (
        db.query(models.ProgramEnrollment)
        .options(joinedload(models.ProgramEnrollment.program))
        .all()
    )
    total_revenue = 0
    total_pending = 0
    total_overdue = 0
    counts = {"paid": 0, "pending": 0, "overdue": 0}

    for e in enrollments:
        price = e.program.price_per_month if e.program else 0
        counts[e.payment_status] = counts.get(e.payment_status, 0) + 1
        if e.payment_status == "paid":
            total_revenue += e.amount_paid or price
        elif e.payment_status == "pending":
            total_pending += price
        elif e.payment_status == "overdue":
            total_overdue += price

    return RevenueSummary(
        total_revenue=total_revenue,
        total_pending=total_pending,
        total_overdue=total_overdue,
        paid_count=counts.get("paid", 0),
        pending_count=counts.get("pending", 0),
        overdue_count=counts.get("overdue", 0),
        active_enrollments=len(enrollments),
    )


@router.get("/payments", response_model=List[PaymentRow])
def list_payments(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    q = (
        db.query(models.ProgramEnrollment)
        .options(
            joinedload(models.ProgramEnrollment.student),
            joinedload(models.ProgramEnrollment.program).joinedload(models.Program.course),
        )
    )
    if status_filter:
        q = q.filter(models.ProgramEnrollment.payment_status == status_filter)
    enrollments = q.order_by(models.ProgramEnrollment.enrolled_at.desc()).all()

    rows = []
    for e in enrollments:
        if not e.student or not e.program:
            continue
        rows.append(PaymentRow(
            enrollment_id=e.id,
            student_id=e.student_id,
            student_name=e.student.name,
            student_email=e.student.email,
            program_id=e.program_id,
            program_name=e.program.name,
            course_title=e.program.course.title if e.program.course else "",
            price_per_month=e.program.price_per_month,
            amount_paid=e.amount_paid or 0,
            payment_status=e.payment_status,
            payment_due_date=e.payment_due_date,
            enrolled_at=e.enrolled_at,
        ))
    return rows


@router.put("/payments/{enrollment_id}")
def update_payment_status(
    enrollment_id: int,
    body: UpdatePaymentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    e = db.query(models.ProgramEnrollment).filter(
        models.ProgramEnrollment.id == enrollment_id
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if body.payment_status not in ("paid", "pending", "overdue"):
        raise HTTPException(status_code=400, detail="Invalid payment status")

    e.payment_status = body.payment_status
    if body.payment_status == "paid" and not body.amount_paid:
        # Auto-fill with the full program price
        program = db.query(models.Program).filter(models.Program.id == e.program_id).first()
        if program:
            e.amount_paid = program.price_per_month
    elif body.amount_paid is not None:
        e.amount_paid = body.amount_paid

    db.commit()

    # Notify the student
    msg_map = {
        "paid": "Your payment has been received. Thank you!",
        "pending": "Your payment is pending. Please complete it soon.",
        "overdue": "Your payment is overdue. Please contact admin to avoid disruption.",
    }
    create_notification(
        db, user_id=e.student_id,
        message=msg_map.get(body.payment_status, "Your payment status was updated."),
        notif_type="payment", link="/my-schedule",
    )
    db.commit()

    return {"message": "Payment status updated"}


@router.post("/payments/{enrollment_id}/remind", status_code=204)
def send_payment_reminder(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    e = db.query(models.ProgramEnrollment).filter(
        models.ProgramEnrollment.id == enrollment_id
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    create_notification(
        db, user_id=e.student_id,
        message="Reminder: your tuition payment is due. Please complete it soon.",
        notif_type="payment", link="/my-schedule",
    )
    db.commit()


@router.get("/tutor-earnings", response_model=List[TutorEarningsRow])
def tutor_earnings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    """For each tutor: how many students they have, active classes, monthly revenue from paid enrollments."""
    tutors = db.query(models.User).filter(models.User.role == "tutor").all()
    rows = []
    for tutor in tutors:
        scheduled = db.query(models.ScheduledClass).filter(
            models.ScheduledClass.tutor_id == tutor.id
        ).all()
        active_classes = len(scheduled)

        # Unique students across those classes
        student_ids = set()
        monthly_revenue = 0
        seen_enrollments = set()
        for sc in scheduled:
            members = db.query(models.ScheduledClassMember).filter(
                models.ScheduledClassMember.scheduled_class_id == sc.id
            ).all()
            for m in members:
                if not m.program_enrollment:
                    continue
                student_ids.add(m.program_enrollment.student_id)
                if m.program_enrollment_id in seen_enrollments:
                    continue
                seen_enrollments.add(m.program_enrollment_id)
                if m.program_enrollment.payment_status == "paid":
                    program = m.program_enrollment.program
                    if program:
                        monthly_revenue += program.price_per_month

        rows.append(TutorEarningsRow(
            tutor_id=tutor.id,
            tutor_name=tutor.name,
            student_count=len(student_ids),
            active_classes=active_classes,
            monthly_revenue=monthly_revenue,
        ))
    # Sort by revenue desc
    rows.sort(key=lambda r: r.monthly_revenue, reverse=True)
    return rows

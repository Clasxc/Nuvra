# scheduling.py — Availability, time-slot booking, schedule views

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload
import threading

import models
from database import get_db
from auth import get_current_user, has_role
from notification_service import create_notification
from email_service import send_email, email_new_session, email_enrollment_confirmation

router = APIRouter(prefix="/scheduling", tags=["Scheduling"])

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AvailabilityCreate(BaseModel):
    day_of_week: int  # 0-6
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"


class AvailabilityOut(BaseModel):
    id: int
    tutor_id: int
    tutor_name: str
    day_of_week: int
    day_name: str
    start_time: str
    end_time: str


class TimeSlotOption(BaseModel):
    """A bookable slot derived from a tutor's availability."""
    tutor_id: int
    tutor_name: str
    day_of_week: int
    day_name: str
    start_time: str
    end_time: str
    available_seats: int  # how many spots left in this slot
    existing_class_id: Optional[int] = None  # if a class already exists here
    is_full: bool


class BookSlotRequest(BaseModel):
    program_id: int
    slots: List[dict]  # [{tutor_id, day_of_week, start_time}]


class ScheduledClassOut(BaseModel):
    id: int
    tutor_id: int
    tutor_name: str
    program_id: int
    program_name: str
    course_id: int
    course_title: str
    day_of_week: int
    day_name: str
    start_time: str
    duration_minutes: int
    session_type: str
    max_students: int
    current_students: int
    students: List[dict]  # for tutor/admin view


class MyEnrollmentOut(BaseModel):
    enrollment_id: int
    program_id: int
    program_name: str
    course_title: str
    session_type: str
    sessions_per_week: int
    price_per_month: int
    amount_paid: int
    payment_status: str
    payment_due_date: Optional[datetime]
    enrolled_at: datetime


class MyScheduleClass(BaseModel):
    """A class slot from a student's perspective."""
    scheduled_class_id: int
    program_enrollment_id: int
    course_title: str
    program_name: str
    tutor_id: int
    tutor_name: str
    day_of_week: int
    day_name: str
    start_time: str
    duration_minutes: int
    session_type: str


# ── Tutor availability endpoints ──────────────────────────────────────────────

@router.get("/availability/me", response_model=List[AvailabilityOut])
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor"])),
):
    blocks = db.query(models.TutorAvailability).filter(
        models.TutorAvailability.tutor_id == current_user.id
    ).order_by(models.TutorAvailability.day_of_week, models.TutorAvailability.start_time).all()
    return [
        AvailabilityOut(
            id=b.id, tutor_id=b.tutor_id, tutor_name=current_user.name,
            day_of_week=b.day_of_week, day_name=DAY_NAMES[b.day_of_week],
            start_time=b.start_time, end_time=b.end_time,
        )
        for b in blocks
    ]


@router.post("/availability", response_model=AvailabilityOut, status_code=201)
def add_availability(
    body: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    if body.day_of_week < 0 or body.day_of_week > 6:
        raise HTTPException(status_code=400, detail="day_of_week must be 0–6")
    if body.start_time >= body.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    block = models.TutorAvailability(
        tutor_id=current_user.id,
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return AvailabilityOut(
        id=block.id, tutor_id=block.tutor_id, tutor_name=current_user.name,
        day_of_week=block.day_of_week, day_name=DAY_NAMES[block.day_of_week],
        start_time=block.start_time, end_time=block.end_time,
    )


@router.delete("/availability/{block_id}", status_code=204)
def delete_availability(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    block = db.query(models.TutorAvailability).filter(
        models.TutorAvailability.id == block_id
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    if current_user.role == "tutor" and block.tutor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your availability")
    db.delete(block)
    db.commit()


# ── Slot finder: what can a student book for this program? ────────────────────

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


@router.get("/programs/{program_id}/available-slots", response_model=List[TimeSlotOption])
def get_available_slots(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return every bookable time slot across all tutors that match this
    program's duration. Considers existing bookings (for group classes,
    a slot with open seats is bookable; for individual, only if empty)."""
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    duration = program.session_duration_minutes
    is_group = program.session_type == "group"

    # Pull every tutor's availability blocks
    blocks = (
        db.query(models.TutorAvailability)
        .options(joinedload(models.TutorAvailability.tutor))
        .all()
    )

    # Pull existing scheduled classes (to compute remaining seats)
    existing = db.query(models.ScheduledClass).all()
    existing_by_key = {}
    for ec in existing:
        key = (ec.tutor_id, ec.day_of_week, ec.start_time)
        existing_by_key[key] = ec

    slots: List[TimeSlotOption] = []
    for b in blocks:
        if not b.tutor:
            continue
        block_start = _time_to_minutes(b.start_time)
        block_end = _time_to_minutes(b.end_time)
        # Generate all slot starts that fit within this availability block, stepped by 30 min
        cursor = block_start
        while cursor + duration <= block_end:
            slot_start = _minutes_to_time(cursor)
            slot_end = _minutes_to_time(cursor + duration)
            key = (b.tutor_id, b.day_of_week, slot_start)

            existing_class = existing_by_key.get(key)
            available_seats = program.max_students_per_class
            is_full = False
            existing_class_id = None

            if existing_class:
                # Count current members in that class via program_enrollment association
                current_count = db.query(models.ScheduledClassMember).filter(
                    models.ScheduledClassMember.scheduled_class_id == existing_class.id
                ).count()
                # If the existing class is the SAME program, students can join (if group)
                if existing_class.program_id == program_id and is_group:
                    available_seats = existing_class.max_students - current_count
                    is_full = available_seats <= 0
                    existing_class_id = existing_class.id
                else:
                    # Existing class for a different program OR individual program — slot is fully blocked
                    available_seats = 0
                    is_full = True

            slots.append(TimeSlotOption(
                tutor_id=b.tutor_id,
                tutor_name=b.tutor.name,
                day_of_week=b.day_of_week,
                day_name=DAY_NAMES[b.day_of_week],
                start_time=slot_start,
                end_time=slot_end,
                available_seats=available_seats,
                existing_class_id=existing_class_id,
                is_full=is_full,
            ))
            cursor += 30  # step by 30 min so options overlap
    return slots


# ── Booking endpoint: student picks N slots and enrolls ───────────────────────

@router.post("/programs/{program_id}/enroll", status_code=201)
def enroll_in_program(
    program_id: int,
    body: BookSlotRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Atomically: create a ProgramEnrollment + create/join ScheduledClasses for
    each selected slot. Fires real-time notifications + emails to tutors."""
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    if len(body.slots) != program.sessions_per_week:
        raise HTTPException(
            status_code=400,
            detail=f"This program requires exactly {program.sessions_per_week} time slots; you selected {len(body.slots)}."
        )

    # Check for duplicate enrollment in same program
    existing_enroll = db.query(models.ProgramEnrollment).filter(
        models.ProgramEnrollment.student_id == current_user.id,
        models.ProgramEnrollment.program_id == program_id,
    ).first()
    if existing_enroll:
        raise HTTPException(status_code=400, detail="You're already enrolled in this program.")

    # Create program enrollment (pending payment)
    enrollment = models.ProgramEnrollment(
        student_id=current_user.id,
        program_id=program_id,
        payment_status="pending",
        amount_paid=0,
        payment_due_date=datetime.utcnow() + timedelta(days=7),
    )
    db.add(enrollment)
    db.flush()

    # Bridge to legacy Enrollment so AI features (assistant, quizzes, materials) work
    legacy_enroll = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id == program.course_id,
    ).first()
    if not legacy_enroll:
        db.add(models.Enrollment(
            student_id=current_user.id,
            course_id=program.course_id,
        ))

    course = db.query(models.Course).filter(models.Course.id == program.course_id).first()
    booked_tutor_ids = set()

    for slot in body.slots:
        tutor_id = slot.get("tutor_id")
        day_of_week = slot.get("day_of_week")
        start_time = slot.get("start_time")
        if tutor_id is None or day_of_week is None or start_time is None:
            db.rollback()
            raise HTTPException(status_code=400, detail="Each slot needs tutor_id, day_of_week, start_time")

        # Find or create ScheduledClass for this slot
        sc = db.query(models.ScheduledClass).filter(
            models.ScheduledClass.tutor_id == tutor_id,
            models.ScheduledClass.day_of_week == day_of_week,
            models.ScheduledClass.start_time == start_time,
        ).first()

        if sc:
            # Validate compatibility
            if sc.program_id != program_id:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Slot {DAY_NAMES[day_of_week]} {start_time} is taken by another program."
                )
            current = db.query(models.ScheduledClassMember).filter(
                models.ScheduledClassMember.scheduled_class_id == sc.id
            ).count()
            if current >= sc.max_students:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Slot {DAY_NAMES[day_of_week]} {start_time} is full."
                )
        else:
            sc = models.ScheduledClass(
                tutor_id=tutor_id,
                program_id=program_id,
                day_of_week=day_of_week,
                start_time=start_time,
                duration_minutes=program.session_duration_minutes,
                max_students=program.max_students_per_class,
            )
            db.add(sc)
            db.flush()

        # Add membership
        membership = models.ScheduledClassMember(
            scheduled_class_id=sc.id,
            program_enrollment_id=enrollment.id,
        )
        db.add(membership)
        booked_tutor_ids.add(tutor_id)

    # Notify tutors (in-app + email)
    primary_tutor_name = ""
    for tutor_id in booked_tutor_ids:
        tutor = db.query(models.User).filter(models.User.id == tutor_id).first()
        if not tutor:
            continue
        if not primary_tutor_name:
            primary_tutor_name = tutor.name
        create_notification(
            db,
            user_id=tutor_id,
            message=f"{current_user.name} just enrolled in {course.title if course else 'a program'} — check your schedule",
            notif_type="enrollment",
            link="/tutor-schedule",
        )
        threading.Thread(
            target=send_email,
            args=(
                tutor.email,
                f"New student booked: {current_user.name}",
                f"<p>Hi {tutor.name},</p><p><strong>{current_user.name}</strong> just booked time slots in your schedule for <strong>{course.title if course else 'a program'}</strong>.</p><p>Check your schedule for the details.</p>"
            ),
            daemon=True,
        ).start()

    # Notify the STUDENT — enrollment confirmation with payment info
    create_notification(
        db,
        user_id=current_user.id,
        message=f"You're enrolled in {course.title if course else 'a program'}. ${program.price_per_month} payment due in 7 days.",
        notif_type="enrollment",
        link="/my-schedule",
    )
    threading.Thread(
        target=send_email,
        args=(
            current_user.email,
            f"You're enrolled in {course.title if course else 'a program'}",
            email_enrollment_confirmation(current_user.name, course.title if course else "a program", primary_tutor_name or "Your tutor"),
        ),
        daemon=True,
    ).start()

    db.commit()
    return {
        "enrollment_id": enrollment.id,
        "message": f"Booked {len(body.slots)} weekly slot(s). Payment of ${program.price_per_month} is due within 7 days.",
    }


# ── Student schedule view ────────────────────────────────────────────────────

@router.get("/my-enrollments", response_model=List[MyEnrollmentOut])
def get_my_enrollments_with_payment(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Student's program enrollments with payment info — used for the Payments panel."""
    enrollments = (
        db.query(models.ProgramEnrollment)
        .options(joinedload(models.ProgramEnrollment.program).joinedload(models.Program.course))
        .filter(models.ProgramEnrollment.student_id == current_user.id)
        .all()
    )
    out = []
    for e in enrollments:
        if not e.program:
            continue
        out.append(MyEnrollmentOut(
            enrollment_id=e.id,
            program_id=e.program_id,
            program_name=e.program.name,
            course_title=e.program.course.title if e.program.course else "",
            session_type=e.program.session_type,
            sessions_per_week=e.program.sessions_per_week,
            price_per_month=e.program.price_per_month,
            amount_paid=e.amount_paid or 0,
            payment_status=e.payment_status,
            payment_due_date=e.payment_due_date,
            enrolled_at=e.enrolled_at,
        ))
    return out


@router.post("/my-enrollments/{enrollment_id}/mark-paid")
def student_marks_paid(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Student claims they've paid — flips status to 'pending' (under review).
    Admin then confirms via the financier panel."""
    e = db.query(models.ProgramEnrollment).filter(
        models.ProgramEnrollment.id == enrollment_id,
        models.ProgramEnrollment.student_id == current_user.id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Notify all admins
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        create_notification(
            db, user_id=admin.id,
            message=f"{current_user.name} marked payment as sent for an enrollment — please verify.",
            notif_type="payment", link="/admin-schedule",
        )
    db.commit()
    return {"message": "Marked. The admin will verify and confirm shortly."}


@router.get("/my-schedule", response_model=List[MyScheduleClass])
def get_my_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])),
):
    """Return all the recurring class slots this student is enrolled in."""
    memberships = (
        db.query(models.ScheduledClassMember)
        .join(models.ProgramEnrollment, models.ScheduledClassMember.program_enrollment_id == models.ProgramEnrollment.id)
        .filter(models.ProgramEnrollment.student_id == current_user.id)
        .all()
    )

    result = []
    for m in memberships:
        sc = m.scheduled_class
        if not sc:
            continue
        program = sc.program
        course = program.course if program else None
        tutor = sc.tutor
        result.append(MyScheduleClass(
            scheduled_class_id=sc.id,
            program_enrollment_id=m.program_enrollment_id,
            course_title=course.title if course else "",
            program_name=program.name if program else "",
            tutor_id=sc.tutor_id,
            tutor_name=tutor.name if tutor else "",
            day_of_week=sc.day_of_week,
            day_name=DAY_NAMES[sc.day_of_week],
            start_time=sc.start_time,
            duration_minutes=sc.duration_minutes,
            session_type=program.session_type if program else "individual",
        ))

    # Sort by day then time
    result.sort(key=lambda x: (x.day_of_week, x.start_time))
    return result


# ── Tutor schedule view ──────────────────────────────────────────────────────

@router.get("/tutor-schedule", response_model=List[ScheduledClassOut])
def get_tutor_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])),
):
    """Return all scheduled classes for the current tutor with student rosters."""
    q = db.query(models.ScheduledClass).options(
        joinedload(models.ScheduledClass.program).joinedload(models.Program.course),
        joinedload(models.ScheduledClass.tutor),
    )
    if current_user.role == "tutor":
        q = q.filter(models.ScheduledClass.tutor_id == current_user.id)
    classes = q.all()

    result = []
    for sc in classes:
        members = (
            db.query(models.ScheduledClassMember)
            .filter(models.ScheduledClassMember.scheduled_class_id == sc.id)
            .all()
        )
        students = []
        for m in members:
            enroll = m.program_enrollment
            if enroll and enroll.student:
                students.append({
                    "id": enroll.student.id,
                    "name": enroll.student.name,
                    "email": enroll.student.email,
                    "payment_status": enroll.payment_status,
                })
        result.append(ScheduledClassOut(
            id=sc.id,
            tutor_id=sc.tutor_id,
            tutor_name=sc.tutor.name if sc.tutor else "",
            program_id=sc.program_id,
            program_name=sc.program.name if sc.program else "",
            course_id=sc.program.course_id if sc.program else 0,
            course_title=sc.program.course.title if sc.program and sc.program.course else "",
            day_of_week=sc.day_of_week,
            day_name=DAY_NAMES[sc.day_of_week],
            start_time=sc.start_time,
            duration_minutes=sc.duration_minutes,
            session_type=sc.program.session_type if sc.program else "individual",
            max_students=sc.max_students,
            current_students=len(students),
            students=students,
        ))

    result.sort(key=lambda x: (x.day_of_week, x.start_time))
    return result


# ── Admin master grid: every scheduled class across the platform ─────────────

@router.get("/master-schedule", response_model=List[ScheduledClassOut])
def get_master_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    classes = (
        db.query(models.ScheduledClass)
        .options(
            joinedload(models.ScheduledClass.program).joinedload(models.Program.course),
            joinedload(models.ScheduledClass.tutor),
        )
        .all()
    )
    result = []
    for sc in classes:
        members = db.query(models.ScheduledClassMember).filter(
            models.ScheduledClassMember.scheduled_class_id == sc.id
        ).all()
        students = []
        for m in members:
            enroll = m.program_enrollment
            if enroll and enroll.student:
                students.append({
                    "id": enroll.student.id,
                    "name": enroll.student.name,
                    "email": enroll.student.email,
                    "payment_status": enroll.payment_status,
                })
        result.append(ScheduledClassOut(
            id=sc.id,
            tutor_id=sc.tutor_id,
            tutor_name=sc.tutor.name if sc.tutor else "",
            program_id=sc.program_id,
            program_name=sc.program.name if sc.program else "",
            course_id=sc.program.course_id if sc.program else 0,
            course_title=sc.program.course.title if sc.program and sc.program.course else "",
            day_of_week=sc.day_of_week,
            day_name=DAY_NAMES[sc.day_of_week],
            start_time=sc.start_time,
            duration_minutes=sc.duration_minutes,
            session_type=sc.program.session_type if sc.program else "individual",
            max_students=sc.max_students,
            current_students=len(students),
            students=students,
        ))
    result.sort(key=lambda x: (x.day_of_week, x.start_time))
    return result


# ── Admin: see ALL tutors' availability ──────────────────────────────────────

@router.get("/all-availability", response_model=List[AvailabilityOut])
def get_all_availability(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    blocks = (
        db.query(models.TutorAvailability)
        .options(joinedload(models.TutorAvailability.tutor))
        .all()
    )
    return [
        AvailabilityOut(
            id=b.id, tutor_id=b.tutor_id,
            tutor_name=b.tutor.name if b.tutor else "Unknown",
            day_of_week=b.day_of_week, day_name=DAY_NAMES[b.day_of_week],
            start_time=b.start_time, end_time=b.end_time,
        )
        for b in blocks
    ]


# ── Reschedule: admin moves a class to a different slot ──────────────────────

class RescheduleRequest(BaseModel):
    new_day_of_week: int
    new_start_time: str


@router.put("/scheduled-classes/{scheduled_class_id}/reschedule")
def reschedule_class(
    scheduled_class_id: int,
    body: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    sc = db.query(models.ScheduledClass).filter(
        models.ScheduledClass.id == scheduled_class_id
    ).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled class not found")

    sc.day_of_week = body.new_day_of_week
    sc.start_time = body.new_start_time
    db.commit()

    # Notify students + tutor
    members = db.query(models.ScheduledClassMember).filter(
        models.ScheduledClassMember.scheduled_class_id == sc.id
    ).all()
    msg = f"Your class has been rescheduled to {DAY_NAMES[body.new_day_of_week]} at {body.new_start_time}"
    for m in members:
        if m.program_enrollment and m.program_enrollment.student_id:
            create_notification(
                db, user_id=m.program_enrollment.student_id,
                message=msg, notif_type="schedule", link="/my-schedule",
            )
    if sc.tutor_id:
        create_notification(
            db, user_id=sc.tutor_id,
            message=f"Admin rescheduled a class to {DAY_NAMES[body.new_day_of_week]} {body.new_start_time}",
            notif_type="schedule", link="/tutor-schedule",
        )
    db.commit()
    return {"message": "Rescheduled"}


@router.delete("/scheduled-classes/{scheduled_class_id}", status_code=204)
def delete_scheduled_class(
    scheduled_class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    sc = db.query(models.ScheduledClass).filter(
        models.ScheduledClass.id == scheduled_class_id
    ).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(sc)
    db.commit()

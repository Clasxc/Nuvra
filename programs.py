# programs.py — Program/course-offering endpoints

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db
from auth import get_current_user, has_role

router = APIRouter(prefix="/programs", tags=["Programs"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProgramCreate(BaseModel):
    course_id: int
    name: str
    session_type: str  # "individual" | "group"
    sessions_per_week: int
    session_duration_minutes: int
    price_per_month: int
    max_students_per_class: int = 1


class ProgramOut(BaseModel):
    id: int
    course_id: int
    course_title: str
    name: str
    session_type: str
    sessions_per_week: int
    session_duration_minutes: int
    price_per_month: int
    max_students_per_class: int


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    price_per_month: Optional[int] = None
    max_students_per_class: Optional[int] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _to_out(p: models.Program) -> ProgramOut:
    return ProgramOut(
        id=p.id,
        course_id=p.course_id,
        course_title=p.course.title if p.course else "",
        name=p.name,
        session_type=p.session_type,
        sessions_per_week=p.sessions_per_week,
        session_duration_minutes=p.session_duration_minutes,
        price_per_month=p.price_per_month,
        max_students_per_class=p.max_students_per_class,
    )


@router.get("/", response_model=List[ProgramOut])
def list_programs(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Public — anyone can browse program offerings."""
    q = db.query(models.Program).options(joinedload(models.Program.course))
    if course_id is not None:
        q = q.filter(models.Program.course_id == course_id)
    return [_to_out(p) for p in q.all()]


@router.get("/{program_id}", response_model=ProgramOut)
def get_program(program_id: int, db: Session = Depends(get_db)):
    p = (
        db.query(models.Program)
        .options(joinedload(models.Program.course))
        .filter(models.Program.id == program_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    return _to_out(p)


@router.post("/", response_model=ProgramOut, status_code=status.HTTP_201_CREATED)
def create_program(
    body: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    course = db.query(models.Course).filter(models.Course.id == body.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.session_type not in ("individual", "group"):
        raise HTTPException(status_code=400, detail="session_type must be 'individual' or 'group'")
    if body.sessions_per_week not in (1, 2, 3, 4, 5):
        raise HTTPException(status_code=400, detail="sessions_per_week must be 1-5")

    p = models.Program(
        course_id=body.course_id,
        name=body.name,
        session_type=body.session_type,
        sessions_per_week=body.sessions_per_week,
        session_duration_minutes=body.session_duration_minutes,
        price_per_month=body.price_per_month,
        max_students_per_class=body.max_students_per_class,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    p.course = course  # ensure loaded for response
    return _to_out(p)


@router.put("/{program_id}", response_model=ProgramOut)
def update_program(
    program_id: int,
    body: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    p = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    if body.name is not None:
        p.name = body.name
    if body.price_per_month is not None:
        p.price_per_month = body.price_per_month
    if body.max_students_per_class is not None:
        p.max_students_per_class = body.max_students_per_class
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/{program_id}", status_code=204)
def delete_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["admin"])),
):
    p = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    db.delete(p)
    db.commit()

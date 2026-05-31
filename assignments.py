from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, File, Form
)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
import shutil
import os
import re
import threading

# Relative imports from other modules in the application
import models
from database import get_db
from auth import get_current_user, has_role, UserResponse
from notification_service import create_notification
from email_service import send_email, email_new_assignment, email_grade_received
from permissions import user_is_course_instructor


def _safe_filename(filename: str) -> str:
    """Strip path separators and dangerous characters from a filename."""
    base = os.path.basename(filename or "")
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base)
    return cleaned or "file"

# --- Constants ---

# Define the directory to save uploaded assignment files
ASSIGNMENTS_UPLOAD_DIRECTORY = "uploaded_assignments"
os.makedirs(ASSIGNMENTS_UPLOAD_DIRECTORY, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def _save_upload_with_limit(upload_file, dest_path: str):
    """Stream an UploadFile to disk, aborting if it exceeds MAX_FILE_SIZE."""
    with open(dest_path, "wb") as buffer:
        written = 0
        while True:
            chunk = upload_file.file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_FILE_SIZE:
                buffer.close()
                os.remove(dest_path)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB."
                )
            buffer.write(chunk)


# --- Pydantic Models ---

# For updating an assignment
class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None

# For responding with assignment details, including related course
class AssignmentResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: str
    due_date: datetime
    attachment_filename: Optional[str] = None

    class Config:
        from_attributes = True

# For updating an assignment file (e.g., grading)
class AssignmentFileUpdate(BaseModel):
    grade: Optional[int] = None
    feedback: Optional[str] = None

# For responding with assignment file details
class AssignmentFileResponse(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    filename: str
    filetype: str
    path: str
    upload_time: datetime
    grade: Optional[int] = None
    feedback: Optional[str] = None
    student: UserResponse # Include student details

    class Config:
        from_attributes = True


# --- FastAPI Router ---

router = APIRouter(
    prefix="/assignments",
    tags=["Assignments"],
)


# --- Assignment CRUD Endpoints ---

TUTOR_ATTACHMENTS_DIR = "tutor_attachments"
os.makedirs(TUTOR_ATTACHMENTS_DIR, exist_ok=True)


@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    course_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    due_date: datetime = Form(...),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not user_is_course_instructor(db, current_user, course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    attachment_filename = None
    attachment_path = None
    if attachment and attachment.filename:
        attachment_filename = _safe_filename(attachment.filename)
        attachment_path = os.path.join(
            TUTOR_ATTACHMENTS_DIR,
            f"{current_user.id}_{course_id}_{attachment_filename}"
        )
        _save_upload_with_limit(attachment, attachment_path)

    db_assignment = models.Assignment(
        course_id=course_id,
        title=title,
        description=description,
        due_date=due_date,
        attachment_filename=attachment_filename,
        attachment_path=attachment_path,
    )
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)

    # Notify + email enrolled students
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).options(joinedload(models.Enrollment.student)).all()

    formatted_due = due_date.strftime("%A, %B %d %Y at %H:%M")
    for e in enrollments:
        create_notification(
            db,
            user_id=e.student_id,
            message=f"New assignment in {course.title}: \"{title}\"",
            notif_type="assignment",
            link="/exams",
        )
        student = e.student
        if student:
            threading.Thread(
                target=send_email,
                args=(
                    student.email,
                    f"New assignment: {title}",
                    email_new_assignment(student.name, course.title, title, formatted_due, description),
                ),
                daemon=True,
            ).start()
    db.commit()

    return db_assignment


@router.get("/", response_model=List[AssignmentResponse])
def read_assignments(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Assignment).options(joinedload(models.Assignment.course))
    if course_id:
        query = query.filter(models.Assignment.course_id == course_id)
    return query.all()


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def read_assignment(
    assignment_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.put("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    assignment_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    due_date: Optional[datetime] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    remove_attachment: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    """Edit an assignment. Accepts multipart form so the file can be replaced.
    Permission: course tutor or admin."""
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not user_is_course_instructor(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    if title is not None and title.strip():
        assignment.title = title
    if description is not None:
        assignment.description = description
    if due_date is not None:
        assignment.due_date = due_date

    # Replace or remove the attachment
    if remove_attachment and assignment.attachment_path:
        try:
            if os.path.exists(assignment.attachment_path):
                os.remove(assignment.attachment_path)
        except Exception as e:
            print(f"Failed to delete old attachment: {e}")
        assignment.attachment_filename = None
        assignment.attachment_path = None

    if attachment and attachment.filename:
        # Remove old one first
        if assignment.attachment_path:
            try:
                if os.path.exists(assignment.attachment_path):
                    os.remove(assignment.attachment_path)
            except Exception:
                pass
        safe = _safe_filename(attachment.filename)
        new_path = os.path.join(
            TUTOR_ATTACHMENTS_DIR,
            f"{current_user.id}_{assignment.course_id}_{safe}"
        )
        _save_upload_with_limit(attachment, new_path)
        assignment.attachment_filename = safe
        assignment.attachment_path = new_path

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not user_is_course_instructor(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}


# --- Assignment Submission (File) Endpoints ---

@router.post("/{assignment_id}/submit", response_model=AssignmentFileResponse)
def submit_assignment_file(
    assignment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["student"])) # Only students can submit
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.due_date and datetime.utcnow() > assignment.due_date:
        raise HTTPException(status_code=403, detail="Cannot submit after the deadline")

    safe_name = _safe_filename(file.filename)
    file_path = os.path.join(ASSIGNMENTS_UPLOAD_DIRECTORY, f"{current_user.id}_{assignment_id}_{safe_name}")
    _save_upload_with_limit(file, file_path)

    submission = models.AssignmentFile(
        student_id=current_user.id,
        assignment_id=assignment_id,
        filename=safe_name,
        filetype=file.content_type,
        path=file_path,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=List[AssignmentFileResponse])
def get_assignment_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])) # Tutors/Admins only
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not user_is_course_instructor(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    submissions = db.query(models.AssignmentFile).filter(
        models.AssignmentFile.assignment_id == assignment_id
    ).options(joinedload(models.AssignmentFile.student)).all()
    return submissions


@router.get("/submissions/student/{student_id}", response_model=List[AssignmentFileResponse])
def get_student_submissions(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="You can only view your own submissions")
    
    submissions = db.query(models.AssignmentFile).filter(
        models.AssignmentFile.student_id == student_id
    ).options(joinedload(models.AssignmentFile.student)).all()
    return submissions


@router.put("/submissions/{submission_id}/grade", response_model=AssignmentFileResponse)
def grade_submission(
    submission_id: int,
    update: AssignmentFileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"])) # Tutors/Admins only
):
    submission = db.query(models.AssignmentFile).filter(models.AssignmentFile.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    assignment = db.query(models.Assignment).filter(models.Assignment.id == submission.assignment_id).first()
    if not user_is_course_instructor(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    submission.grade = update.grade
    submission.feedback = update.feedback
    db.commit()
    db.refresh(submission)

    # Notify + email student their work was graded
    if update.grade is not None:
        create_notification(
            db,
            user_id=submission.student_id,
            message=f"Your submission for \"{assignment.title}\" was graded: {update.grade}/100",
            notif_type="grade",
            link="/exams",
        )
        db.commit()

        student = db.query(models.User).filter(models.User.id == submission.student_id).first()
        course = db.query(models.Course).filter(models.Course.id == assignment.course_id).first()
        if student and course:
            threading.Thread(
                target=send_email,
                args=(
                    student.email,
                    f"Graded: {assignment.title}",
                    email_grade_received(
                        student.name,
                        course.title,
                        assignment.title,
                        update.grade,
                        update.feedback or "",
                    ),
                ),
                daemon=True,
            ).start()

    return submission

# ADD THIS to the end of assignments.py

from fastapi.responses import FileResponse

@router.get("/submissions/{submission_id}/file")
def download_submission_file(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    submission = db.query(models.AssignmentFile).filter(
        models.AssignmentFile.id == submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Students can only download their own submissions
    if current_user.role == "student" and submission.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your submission")

    if not os.path.exists(submission.path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=submission.path,
        filename=submission.filename,
        media_type=submission.filetype
    )


@router.get("/{assignment_id}/attachment/download")
def download_assignment_attachment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Access control: admin, course tutor, or enrolled student
    course = db.query(models.Course).filter(models.Course.id == assignment.course_id).first()
    if current_user.role == "student":
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == current_user.id,
            models.Enrollment.course_id == assignment.course_id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="You are not enrolled in this course")
    elif current_user.role == "tutor":
        if not user_is_course_instructor(db, current_user, assignment.course_id):
            raise HTTPException(status_code=403, detail="Not your course")

    if not assignment.attachment_path or not os.path.exists(assignment.attachment_path):
        raise HTTPException(status_code=404, detail="No attachment for this assignment")

    return FileResponse(
        path=assignment.attachment_path,
        filename=assignment.attachment_filename,
        media_type="application/octet-stream"
    )
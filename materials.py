from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
import shutil
import os
import re
import chromadb
from database import get_db, get_chroma_client
import models
from auth import get_current_user, has_role
from permissions import user_is_course_instructor

UPLOAD_DIRECTORY = "uploaded_materials"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB hard limit on uploads


def _safe_filename(filename: str) -> str:
    base = os.path.basename(filename or "")
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base)
    return cleaned or "file"


def _user_can_access_course(db: Session, user: models.User, course_id: int) -> bool:
    """Tutor of the course, admin, or enrolled student."""
    if user.role == "admin":
        return True
    if user.role == "tutor":
        course = db.query(models.Course).filter(models.Course.id == course_id).first()
        return course is not None and course.tutor_id == user.id
    # student
    return db.query(models.Enrollment).filter(
        models.Enrollment.student_id == user.id,
        models.Enrollment.course_id == course_id,
    ).first() is not None


class MaterialFileResponse(BaseModel):
    id: int
    course_id: int
    filename: str
    filetype: str
    path: str

    class Config:
        from_attributes = True


class MaterialFileUpdate(BaseModel):
    filename: Optional[str] = None


router = APIRouter(prefix="/materials", tags=["materials"])


def extract_text(file_path: str, filetype: str) -> str:
    """Extract plain text from a file. Supports txt and pdf."""
    try:
        if filetype == "text/plain":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()

        elif filetype == "application/pdf":
            import pymupdf  # PyMuPDF
            text_parts = []
            doc = pymupdf.open(file_path)
            for page in doc:
                text_parts.append(page.get_text())
            doc.close()
            return "\n\n".join(text_parts)

    except Exception as e:
        print(f"Text extraction failed for {file_path}: {e}")
    return ""


def index_in_chroma(chroma_client, text: str, material_id: int, course_id: int):
    """Split text into chunks and store in ChromaDB."""
    if not text.strip():
        return

    # Split by double newline (paragraphs), fallback to fixed chunks
    raw_chunks = text.split("\n\n")
    chunks = []
    for chunk in raw_chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        # If a chunk is very long, split it further (ChromaDB has limits)
        if len(chunk) > 1000:
            words = chunk.split()
            sub = []
            for word in words:
                sub.append(word)
                if len(" ".join(sub)) > 800:
                    chunks.append(" ".join(sub))
                    sub = []
            if sub:
                chunks.append(" ".join(sub))
        else:
            chunks.append(chunk)

    if not chunks:
        return

    collection = chroma_client.get_or_create_collection(name="course_materials")
    doc_ids = [f"material_{material_id}_chunk_{i}" for i in range(len(chunks))]
    collection.add(
        documents=chunks,
        ids=doc_ids,
        metadatas=[{"course_id": course_id, "material_id": material_id}] * len(chunks)
    )
    print(f"Indexed {len(chunks)} chunks for material {material_id}")


@router.post("/upload/", response_model=MaterialFileResponse, status_code=status.HTTP_201_CREATED)
def upload_material_file(
    course_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    chroma_client: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not user_is_course_instructor(db, current_user, course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    # Validate file type
    allowed_types = ["text/plain", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported"
        )

    safe_filename = _safe_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIRECTORY, f"{course_id}_{safe_filename}")

    try:
        with open(file_path, "wb") as buffer:
            written = 0
            while True:
                chunk = file.file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_FILE_SIZE:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    finally:
        file.file.close()

    db_material = models.MaterialFile(
        course_id=course_id,
        filename=safe_filename,
        filetype=file.content_type,
        path=file_path
    )

    try:
        db.add(db_material)
        db.commit()
        db.refresh(db_material)

        # Extract and index text
        try:
            text = extract_text(file_path, file.content_type)
            if text.strip():
                index_in_chroma(chroma_client, text, db_material.id, course_id)
            else:
                print(f"Warning: No text extracted from {file.filename}")
        except Exception as e:
            print(f"Indexing failed for material {db_material.id}: {e}")

        return db_material

    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.get("/{material_id}", response_model=MaterialFileResponse)
def read_material_file(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    material = db.query(models.MaterialFile).filter(
        models.MaterialFile.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material file not found")
    return material


@router.get("/course/{course_id}", response_model=List[MaterialFileResponse])
def read_course_materials(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return db.query(models.MaterialFile).filter(
        models.MaterialFile.course_id == course_id
    ).all()


@router.put("/{material_id}", response_model=MaterialFileResponse)
def update_material_file(
    material_id: int,
    material_update: MaterialFileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    material = db.query(models.MaterialFile).filter(
        models.MaterialFile.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material file not found")

    course = db.query(models.Course).filter(
        models.Course.id == material.course_id
    ).first()
    if not user_is_course_instructor(db, current_user, material.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    if material_update.filename:
        material.filename = material_update.filename
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}")
def delete_material_file(
    material_id: int,
    db: Session = Depends(get_db),
    chroma_client: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(has_role(["tutor", "admin"]))
):
    material = db.query(models.MaterialFile).filter(
        models.MaterialFile.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material file not found")

    course = db.query(models.Course).filter(
        models.Course.id == material.course_id
    ).first()
    if not user_is_course_instructor(db, current_user, material.course_id):
        raise HTTPException(status_code=403, detail="You're not an instructor of this course")

    # Remove from ChromaDB
    try:
        collection = chroma_client.get_collection(name="course_materials")
        collection.delete(where={"material_id": material_id})
    except Exception as e:
        print(f"ChromaDB deletion failed for material {material_id}: {e}")

    # Remove physical file
    if os.path.exists(material.path):
        try:
            os.remove(material.path)
        except Exception as e:
            print(f"File deletion failed: {e}")

    db.delete(material)
    db.commit()
    return {"message": "Material deleted successfully"}

from fastapi.responses import FileResponse

@router.get("/{material_id}/download")
def download_material_file(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    material = db.query(models.MaterialFile).filter(
        models.MaterialFile.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material file not found")
    if not _user_can_access_course(db, current_user, material.course_id):
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")
    if not os.path.exists(material.path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=material.path,
        filename=material.filename,
        media_type=material.filetype or "application/octet-stream"
    )
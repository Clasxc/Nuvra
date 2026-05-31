from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import json as _json
import chromadb

from google import genai

from database import get_db, get_chroma_client
import models, config
from auth import get_current_user


def _cleanup_old_ai_messages(db: Session, user_id: int):
    """Lazy cleanup: delete AI messages older than 7 days for this user."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    try:
        deleted = db.query(models.AIMessage).filter(
            models.AIMessage.user_id == user_id,
            models.AIMessage.created_at < cutoff,
        ).delete(synchronize_session=False)
        if deleted:
            db.commit()
    except Exception as e:
        print(f"AI history cleanup failed: {e}")
        db.rollback()

# Configure the new google-genai client
client = None
if config.GOOGLE_API_KEY:
    try:
        client = genai.Client(api_key=config.GOOGLE_API_KEY)
        print("Gemini client configured successfully.")
    except Exception as e:
        print(f"Warning: Gemini client failed to configure: {e}")
else:
    print("Warning: GOOGLE_API_KEY missing.")


class AssistantQueryRequest(BaseModel):
    query_text: str
    course_id: int

class RetrievedDoc(BaseModel):
    source_filename: str
    chunk_text: str
    similarity_score: float

class AssistantQueryResponse(BaseModel):
    generated_response: str
    retrieved_documents: List[RetrievedDoc]


router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


@router.post("/query/", response_model=AssistantQueryResponse)
def query_assistant(
    request: AssistantQueryRequest,
    db: Session = Depends(get_db),
    chroma_client: chromadb.Client = Depends(get_chroma_client),
    current_user: models.User = Depends(get_current_user),
):
    # 1) Retrieval — get relevant chunks from ChromaDB
    try:
        collection = chroma_client.get_or_create_collection(name="course_materials")
        results = collection.query(
            query_texts=[request.query_text],
            n_results=5,
            where={"course_id": request.course_id},
        )
    except Exception as e:
        print(f"ChromaDB query failed: {e}")
        results = None

    retrieved_documents: List[RetrievedDoc] = []

    if results and results.get("ids") and results["ids"][0]:
        material_ids = list(set([m["material_id"] for m in results["metadatas"][0]]))
        material_files = db.query(models.MaterialFile).filter(
            models.MaterialFile.id.in_(material_ids)
        ).all()
        filename_map = {mf.id: mf.filename for mf in material_files}

        for i in range(len(results["ids"][0])):
            retrieved_documents.append(RetrievedDoc(
                source_filename=filename_map.get(
                    results["metadatas"][0][i]["material_id"], "Unknown"
                ),
                chunk_text=results["documents"][0][i],
                similarity_score=results["distances"][0][i],
            ))

    # 2) Log AI usage for progress tracking
    if current_user.role == "student":
        try:
            log = models.AIUsageLog(
                student_id=current_user.id,
                course_id=request.course_id,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            print(f"AI usage log failed: {e}")

    # 3) Generation
    context_text = "\n---\n".join([doc.chunk_text for doc in retrieved_documents])

    if not context_text:
        return AssistantQueryResponse(
            generated_response=(
                "Your tutor hasn't uploaded any study materials for this course yet. "
                "Once they do, I'll be able to answer your questions based on exactly "
                "what they taught you."
            ),
            retrieved_documents=[],
        )

    prompt = f"""You are a helpful and friendly teaching assistant for an online education platform.
Your job is to help students understand concepts using ONLY the provided course material.
Your tone should be encouraging and educational — guide the student toward understanding, don't just give the answer.

Rules:
- Answer ONLY from the CONTEXT below. Do not use external knowledge.
- If the context doesn't contain the answer, say so clearly.
- Explain concepts in your own words like a tutor would.
- Be concise but thorough.

CONTEXT (from course materials):
{context_text}

STUDENT QUESTION:
{request.query_text}

ANSWER:""".strip()

    if not client:
        raise HTTPException(
            status_code=500,
            detail="Gemini is not configured. Set GOOGLE_API_KEY in your .env file.",
        )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        final_answer = response.text or "No response returned by Gemini."
    except Exception as e:
        print(f"Gemini API call failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI response failed: {str(e)}",
        )

    # Persist conversation (user question + AI response) for history
    try:
        sources_list = list(set(d.source_filename for d in retrieved_documents))
        db.add(models.AIMessage(
            user_id=current_user.id,
            course_id=request.course_id,
            role="user",
            content=request.query_text,
            sources=None,
        ))
        db.add(models.AIMessage(
            user_id=current_user.id,
            course_id=request.course_id,
            role="assistant",
            content=final_answer,
            sources=_json.dumps(sources_list) if sources_list else None,
        ))
        db.commit()
    except Exception as e:
        print(f"AI history save failed: {e}")
        db.rollback()

    # Lazy cleanup: drop messages older than 7 days
    _cleanup_old_ai_messages(db, current_user.id)

    return AssistantQueryResponse(
        generated_response=final_answer,
        retrieved_documents=retrieved_documents,
    )


class AIHistoryMessage(BaseModel):
    id: int
    course_id: int
    role: str
    content: str
    sources: Optional[List[str]] = None
    created_at: datetime


@router.get("/history", response_model=List[AIHistoryMessage])
def get_ai_history(
    course_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get recent AI conversation history for the current user, optionally
    scoped to a course. Auto-cleans up records older than 7 days first."""
    _cleanup_old_ai_messages(db, current_user.id)

    q = db.query(models.AIMessage).filter(models.AIMessage.user_id == current_user.id)
    if course_id is not None:
        q = q.filter(models.AIMessage.course_id == course_id)
    msgs = q.order_by(models.AIMessage.created_at.desc()).limit(limit).all()
    # Return in chronological order (oldest first) for natural reading
    msgs.reverse()

    out: List[AIHistoryMessage] = []
    for m in msgs:
        sources_parsed: Optional[List[str]] = None
        if m.sources:
            try:
                sources_parsed = _json.loads(m.sources)
            except Exception:
                sources_parsed = None
        out.append(AIHistoryMessage(
            id=m.id,
            course_id=m.course_id,
            role=m.role,
            content=m.content,
            sources=sources_parsed,
            created_at=m.created_at,
        ))
    return out


@router.delete("/history", status_code=204)
def clear_ai_history(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Wipe all AI history for the user (optionally scoped to one course)."""
    q = db.query(models.AIMessage).filter(models.AIMessage.user_id == current_user.id)
    if course_id is not None:
        q = q.filter(models.AIMessage.course_id == course_id)
    q.delete(synchronize_session=False)
    db.commit()
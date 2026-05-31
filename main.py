from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from courses import router as courses_router
from sessions import router as sessions_router
from materials import router as materials_router
from assignments import router as assignments_router
from assistant import router as assistant_router
from enrollments import router as enrollments_router
from progress import router as progress_router
from attendance import router as attendance_router
from admin import router as admin_router
from quizzes import router as quizzes_router
from notifications import router as notifications_router
from programs import router as programs_router
from scheduling import router as scheduling_router
from financier import router as financier_router

from database import create_db_tables

app = FastAPI(
    title="Genius Learn AI Backend",
    description="Backend API for Genius Learn AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # Allow any LAN origin for multi-machine demo testing.
    # In prod, restrict this to your actual deployed frontend domain.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+|\[::1\])(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_tables()

app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(sessions_router)
app.include_router(materials_router)
app.include_router(assignments_router)
app.include_router(assistant_router)
app.include_router(enrollments_router)
app.include_router(progress_router)
app.include_router(attendance_router)
app.include_router(admin_router)
app.include_router(quizzes_router)
app.include_router(notifications_router)
app.include_router(programs_router)
app.include_router(scheduling_router)
app.include_router(financier_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"Hello": "World"}
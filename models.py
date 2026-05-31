from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Table, Boolean
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

session_attendees = Table(
    "session_attendees",
    Base.metadata,
    Column("session_id", Integer, ForeignKey("sessions.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, index=True)

    courses = relationship("Course", back_populates="tutor")
    assignment_files = relationship("AssignmentFile", back_populates="student")
    attended_sessions = relationship("Session", secondary=session_attendees, back_populates="attendees")
    enrollments = relationship("Enrollment", back_populates="student")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    tutor_id = Column(Integer, ForeignKey("users.id"))

    tutor = relationship("User", back_populates="courses")
    sessions = relationship("Session", back_populates="course", cascade="all, delete-orphan")
    materials = relationship("MaterialFile", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    zoom_link = Column(String)

    course = relationship("Course", back_populates="sessions")
    attendees = relationship("User", secondary=session_attendees, back_populates="attended_sessions")


class MaterialFile(Base):
    __tablename__ = "material_files"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    filename = Column(String)
    filetype = Column(String)
    path = Column(String)

    course = relationship("Course", back_populates="materials")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String)
    description = Column(String)
    due_date = Column(DateTime)
    attachment_filename = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)

    course = relationship("Course", back_populates="assignments")
    submissions = relationship("AssignmentFile", back_populates="assignment", cascade="all, delete-orphan")


class AssignmentFile(Base):
    __tablename__ = "assignment_files"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    assignment_id = Column(Integer, ForeignKey("assignments.id"))
    filename = Column(String)
    filetype = Column(String)
    path = Column(String)
    upload_time = Column(DateTime, default=datetime.utcnow)
    grade = Column(Integer, nullable=True)
    feedback = Column(String, nullable=True)

    student = relationship("User", back_populates="assignment_files")
    assignment = relationship("Assignment", back_populates="submissions")


# --- NEW ---
class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    
class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"
 
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    asked_at = Column(DateTime, default=datetime.utcnow)
 
    student = relationship("User", backref="ai_usage_logs")
    course = relationship("Course", backref="ai_usage_logs")
    
class AttendanceCode(Base):
    __tablename__ = "attendance_codes"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    code = Column(String, index=True)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    session = relationship("Session", backref="attendance_codes")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    notif_type = Column(String)  # "session", "assignment", "grade"
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="notifications")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String)
    questions = Column(String)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))

    course = relationship("Course", backref="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    score = Column(Integer)
    answers = Column(String)  # JSON string — list of chosen option indices
    attempted_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", backref="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")


# ─── Scheduling system ──────────────────────────────────────────────────────

class Program(Base):
    """A course offering with frequency, type, and pricing.
    E.g. 'SAT — Individual — 3x/week' or 'Calculus — Group — 2x/week'."""
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    name = Column(String)
    session_type = Column(String)  # "individual" | "group"
    sessions_per_week = Column(Integer)
    session_duration_minutes = Column(Integer)  # 60 / 90 / 120
    price_per_month = Column(Integer)  # whole currency units
    max_students_per_class = Column(Integer, default=1)

    course = relationship("Course", backref="programs")


class TutorAvailability(Base):
    """A tutor's recurring weekly free time block.
    day_of_week: 0=Mon … 6=Sun. Times are 'HH:MM' strings (24h)."""
    __tablename__ = "tutor_availability"

    id = Column(Integer, primary_key=True, index=True)
    tutor_id = Column(Integer, ForeignKey("users.id"))
    day_of_week = Column(Integer)
    start_time = Column(String)  # "14:00"
    end_time = Column(String)    # "18:00"

    tutor = relationship("User", backref="availability_blocks")


class ScheduledClass(Base):
    """A weekly recurring class slot. For individual programs, max_students=1.
    For group programs, multiple students share the slot."""
    __tablename__ = "scheduled_classes"

    id = Column(Integer, primary_key=True, index=True)
    tutor_id = Column(Integer, ForeignKey("users.id"))
    program_id = Column(Integer, ForeignKey("programs.id"))
    day_of_week = Column(Integer)
    start_time = Column(String)  # "14:00"
    duration_minutes = Column(Integer)
    max_students = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    tutor = relationship("User", backref="scheduled_classes")
    program = relationship("Program", backref="scheduled_classes")


class ProgramEnrollment(Base):
    """A student's enrollment in a Program. Tracks payment status and links
    to the specific ScheduledClass slots they attend."""
    __tablename__ = "program_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    program_id = Column(Integer, ForeignKey("programs.id"))
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    payment_status = Column(String, default="pending")  # "paid" | "pending" | "overdue"
    amount_paid = Column(Integer, default=0)
    payment_due_date = Column(DateTime, nullable=True)

    student = relationship("User", backref="program_enrollments")
    program = relationship("Program", backref="enrollments")


class CourseInstructor(Base):
    """M2M between courses and tutor users. role: 'primary' | 'co_teacher'.
    Course.tutor_id stays as the original 'creator/owner' but permissions are
    checked against this table (any instructor can edit the course's content)."""
    __tablename__ = "course_instructors"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="co_teacher")  # 'primary' | 'co_teacher'
    added_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", backref="instructors")
    user = relationship("User", backref="instructed_courses")


class AIMessage(Base):
    """A single AI assistant Q or A message. Auto-cleaned after 7 days."""
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    role = Column(String)  # "user" | "assistant"
    content = Column(String)
    sources = Column(String, nullable=True)  # JSON list of filenames
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="ai_messages")


class ScheduledClassMember(Base):
    """Association: which students attend which scheduled classes."""
    __tablename__ = "scheduled_class_members"

    id = Column(Integer, primary_key=True, index=True)
    scheduled_class_id = Column(Integer, ForeignKey("scheduled_classes.id"))
    program_enrollment_id = Column(Integer, ForeignKey("program_enrollments.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)

    scheduled_class = relationship("ScheduledClass", backref="members")
    program_enrollment = relationship("ProgramEnrollment", backref="class_memberships")
 
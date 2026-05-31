from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CourseMini(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    tutor_id: int

    model_config = {"from_attributes": True}


class SessionMini(BaseModel):
    id: int
    course_id: int
    start_time: datetime
    zoom_link: str

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: int
    course_id: int
    start_time: datetime
    zoom_link: str
    course: Optional[CourseMini] = None

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    tutor_id: int
    sessions: List[SessionMini] = []

    model_config = {"from_attributes": True}

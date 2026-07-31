from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import UserRole, SubmissionStatus


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = None
    role: UserRole = UserRole.employee


class SubmissionCreate(BaseModel):
    var1: float
    var2: float
    var3: float


class SubmissionOut(BaseModel):
    id: int
    var1: float
    var2: float
    var3: float
    average_berry_weight: float
    status: SubmissionStatus
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    employee: UserOut
    reviewed_by: Optional[UserOut] = None

    class Config:
        from_attributes = True


class SubmissionReview(BaseModel):
    status: SubmissionStatus

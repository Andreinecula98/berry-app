from datetime import date as dt_date, datetime, time as dt_time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = None
    role: UserRole = UserRole.employee


class FieldCreate(BaseModel):
    name: str = Field(min_length=1)
    total_meters: int = Field(gt=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be empty")
        return stripped


class FieldOut(BaseModel):
    id: int
    name: str
    total_meters: int

    model_config = ConfigDict(from_attributes=True)


class MeterReadingCreate(BaseModel):
    meter_number: int = Field(ge=1)
    orange_fruit: int = Field(ge=0)
    white_pink_fruit: int = Field(ge=0)
    white_fruit: int = Field(ge=0)
    big_green_fruit: int = Field(ge=0)
    small_green_fruit: int = Field(ge=0)
    opened_flowers: int = Field(ge=0)
    buds: int = Field(ge=0)


class MeterReadingOut(MeterReadingCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SubmissionCreate(BaseModel):
    field_id: int
    date: dt_date
    time: Optional[dt_time] = None
    meters: list[MeterReadingCreate] = Field(min_length=1)


class SubmissionOut(BaseModel):
    id: int
    field: FieldOut
    date: dt_date
    time: Optional[dt_time] = None
    status: SubmissionStatus
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    employee: UserOut
    reviewed_by: Optional[UserOut] = None
    meters: list[MeterReadingOut]

    model_config = ConfigDict(from_attributes=True)


class SubmissionReview(BaseModel):
    status: SubmissionStatus

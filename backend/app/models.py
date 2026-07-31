import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Date, Time
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, enum.Enum):
    employee = "employee"
    admin = "admin"


class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.employee)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    submissions = relationship("Submission", back_populates="employee", foreign_keys="Submission.employee_id")


class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    total_meters = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    submissions = relationship("Submission", back_populates="field")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=True)
    status = Column(Enum(SubmissionStatus), nullable=False, default=SubmissionStatus.pending)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    employee = relationship("User", back_populates="submissions", foreign_keys=[employee_id])
    field = relationship("Field", back_populates="submissions")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    meters = relationship(
        "MeterReading",
        back_populates="submission",
        cascade="all, delete-orphan",
        order_by="MeterReading.meter_number",
    )


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    meter_number = Column(Integer, nullable=False)
    orange_fruit = Column(Integer, nullable=False)
    white_pink_fruit = Column(Integer, nullable=False)
    white_fruit = Column(Integer, nullable=False)
    big_green_fruit = Column(Integer, nullable=False)
    small_green_fruit = Column(Integer, nullable=False)
    opened_flowers = Column(Integer, nullable=False)
    buds = Column(Integer, nullable=False)

    submission = relationship("Submission", back_populates="meters")

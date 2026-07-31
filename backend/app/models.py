import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey
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


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    var1 = Column(Float, nullable=False)
    var2 = Column(Float, nullable=False)
    var3 = Column(Float, nullable=False)
    average_berry_weight = Column(Float, nullable=False)
    status = Column(Enum(SubmissionStatus), nullable=False, default=SubmissionStatus.pending)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    employee = relationship("User", back_populates="submissions", foreign_keys=[employee_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

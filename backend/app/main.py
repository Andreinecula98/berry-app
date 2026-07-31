from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from .config import INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PASSWORD, CORS_ORIGINS
from .database import Base, engine, get_db
from .models import User, UserRole, Submission, SubmissionStatus
from .reports import build_excel_report, build_pdf_report

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Berry Weight App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed_admin():
    db = next(get_db())
    try:
        existing = db.query(User).filter(User.username == INITIAL_ADMIN_USERNAME).first()
        if not existing:
            admin = User(
                username=INITIAL_ADMIN_USERNAME,
                full_name="Administrator",
                password_hash=hash_password(INITIAL_ADMIN_PASSWORD),
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "ok", "service": "berry-weight-app-backend"}


@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizator sau parolă incorectă")
    token = create_access_token(user.username)
    return schemas.Token(access_token=token, role=user.role, username=user.username)


@app.get("/users/me", response_model=schemas.UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# ---------- Employee endpoints ----------

@app.post("/submissions", response_model=schemas.SubmissionOut, status_code=201)
def create_submission(
    payload: schemas.SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    average = (payload.var1 + payload.var2 + payload.var3) / 3
    submission = Submission(
        employee_id=current_user.id,
        var1=payload.var1,
        var2=payload.var2,
        var3=payload.var3,
        average_berry_weight=average,
        status=SubmissionStatus.pending,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@app.get("/submissions/me", response_model=list[schemas.SubmissionOut])
def list_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Submission)
        .filter(Submission.employee_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .all()
    )


# ---------- Admin endpoints ----------

@app.post("/admin/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Acest utilizator există deja")
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/admin/users", response_model=list[schemas.UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@app.get("/admin/submissions", response_model=list[schemas.SubmissionOut])
def list_all_submissions(
    status_filter: SubmissionStatus | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Submission)
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    return query.order_by(Submission.created_at.desc()).all()


def _get_submissions_for_export(db: Session, status_filter: SubmissionStatus | None) -> list[Submission]:
    query = db.query(Submission)
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    return query.order_by(Submission.created_at.desc()).all()


@app.get("/admin/submissions/export/excel")
def export_submissions_excel(
    status_filter: SubmissionStatus | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    submissions = _get_submissions_for_export(db, status_filter)
    content = build_excel_report(submissions)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=raport_berry_weight.xlsx"},
    )


@app.get("/admin/submissions/export/pdf")
def export_submissions_pdf(
    status_filter: SubmissionStatus | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    submissions = _get_submissions_for_export(db, status_filter)
    content = build_pdf_report(submissions)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=raport_berry_weight.pdf"},
    )


@app.patch("/admin/submissions/{submission_id}", response_model=schemas.SubmissionOut)
def review_submission(
    submission_id: int,
    payload: schemas.SubmissionReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.status = payload.status
    submission.reviewed_at = datetime.now(timezone.utc)
    submission.reviewed_by_id = admin.id
    db.commit()
    db.refresh(submission)
    return submission

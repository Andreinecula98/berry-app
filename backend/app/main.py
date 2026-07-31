from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, selectinload

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
from .models import Field, User, UserRole, Submission, SubmissionStatus, MeterReading
from .reports import build_excel_report, build_pdf_report

FIELD_SEED_DATA = [
    ("25GRO BB 2 KARIMA", 18330),
    ("25GRO DOG 1 KARIMA", 18814),
    ("25GRO DOG 1 FAVORI", 5416),
    ("25GRO DOG 2AB ANIA", 18945),
    ("25GRO DOG 2CD ANIA", 17502),
    ("25GRO DOG 2CD - T1 BT 1606", 600),
    ("25GRO DOG 2CD - T2 LIMORE 1", 600),
    ("25GRO DOG 3 ANIA", 31854),
    ("25GRO DOG 4 A PETRA", 4425),
    ("25GRO DOG 4 B BRINA", 1650),
    ("25GRO DOG 4 C BRINA", 2826),
    ("25GRO DOG 4 D PETRA", 3150),
    ("25GRO DOG 5 FAVORI", 16705),
    ("25GRO JD 3 KARIMA", 21402),
    ("25GRO JD 4 KARIMA", 11832),
    ("25GRO LONG 11 A MURANO", 11772),
    ("25GRO LONG 11 B MURANO", 9474),
    ("25GRO QU 1A MORANO", 11898),
    ("25GRO QU 1B MURANO", 12636),
    ("25GRO QU 1C MURANO", 14916),
    ("25GRO QU 2 FLORICE", 13723),
    ("25GRO QU 3 FLORICE", 16302),
    ("25GRO QU 5 MURANO", 21102),
    ("25GRO ST 1 FLORICE", 23472),
    ("25GRO TRAV 1 A BRINA", 3948),
    ("25GRO TRAV 1 B PETRA", 3948),
    ("25GRO TRAV 1 C BRINA", 3948),
    ("25GRO TRAV 1 D PETRA", 3384),
    ("25GRO TRAV 2 ANIA", 15088),
    ("25GRO TRAV 3 FLORICE", 17778),
    ("25GRO TRAV 4 - Mur", 18103),
    ("25GRO TRAV 4 - Flo", 972),
    ("25GRO WL 1 MURANO", 12388),
    ("25GRO WL 2 MURANO", 14867),
    ("25GRO WL 3 A FLORICE", 8410),
    ("25GRO WL 3 B FLORICE", 6318),
    ("25GRO WL 4 FAVORI", 16836),
    ("25GRO WL 5 FAVORI", 15174),
    ("25GRO WL 6 FAVORI", 15312),
    ("25MAN 2A ANIA", 16800),
    ("25MAN 2B ANIA", 16800),
    ("25MAN 3A  PARLANDO", 13776),
    ("25MAN 3B PARLANDO", 14154),
    ("25MAN 3C FAVORI", 15218),
    ("25MAN 5A KARIMA", 15069),
    ("25MAN 5B KARIMA", 15672),
    ("25MAN GUL FAVORI", 20271),
]

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Berry App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_admin(db: Session):
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
        return

    # The admin account already exists (e.g. from a previous deploy). If the
    # INITIAL_ADMIN_PASSWORD env var was changed since then, keep the stored
    # password in sync so updating the env var + redeploying actually takes
    # effect, instead of silently keeping the old password forever.
    if not verify_password(INITIAL_ADMIN_PASSWORD, existing.password_hash):
        existing.password_hash = hash_password(INITIAL_ADMIN_PASSWORD)
        db.commit()


def seed_fields(db: Session):
    if db.query(Field).first():
        return
    db.add_all(Field(name=name, total_meters=total_meters) for name, total_meters in FIELD_SEED_DATA)
    db.commit()


@app.on_event("startup")
def seed_initial_data():
    db = next(get_db())
    try:
        seed_admin(db)
        seed_fields(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "ok", "service": "berry-app-backend"}


@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(user.username)
    return schemas.Token(access_token=token, role=user.role, username=user.username)


@app.get("/users/me", response_model=schemas.UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/fields", response_model=list[schemas.FieldOut])
def list_fields(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Field).order_by(Field.name.asc()).all()


# ---------- Employee endpoints ----------

@app.post("/submissions", response_model=schemas.SubmissionOut, status_code=201)
def create_submission(
    payload: schemas.SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = db.query(Field).filter(Field.id == payload.field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    submission = Submission(
        employee_id=current_user.id,
        field_id=field.id,
        date=payload.date,
        time=payload.time,
        status=SubmissionStatus.pending,
        meters=[
            MeterReading(
                meter_number=meter.meter_number,
                orange_fruit=meter.orange_fruit,
                white_pink_fruit=meter.white_pink_fruit,
                white_fruit=meter.white_fruit,
                big_green_fruit=meter.big_green_fruit,
                small_green_fruit=meter.small_green_fruit,
                opened_flowers=meter.opened_flowers,
                buds=meter.buds,
            )
            for meter in payload.meters
        ],
    )
    db.add(submission)
    db.commit()

    return _get_submission_or_404(db, submission.id)


@app.get("/submissions/me", response_model=list[schemas.SubmissionOut])
def list_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        _submission_query(db)
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
        raise HTTPException(status_code=400, detail="This username already exists")
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


@app.post("/admin/fields", response_model=schemas.FieldOut, status_code=201)
def create_field(
    payload: schemas.FieldCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(Field).filter(Field.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="This field name already exists")
    field = Field(name=payload.name, total_meters=payload.total_meters)
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@app.get("/admin/submissions", response_model=list[schemas.SubmissionOut])
def list_all_submissions(
    status_filter: SubmissionStatus | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = _submission_query(db)
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    return query.order_by(Submission.created_at.desc()).all()


def _submission_query(db: Session):
    return db.query(Submission).options(
        joinedload(Submission.employee),
        joinedload(Submission.reviewed_by),
        joinedload(Submission.field),
        selectinload(Submission.meters),
    )


def _get_submission_or_404(db: Session, submission_id: int) -> Submission:
    submission = _submission_query(db).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


def _get_submissions_for_export(db: Session, status_filter: SubmissionStatus | None) -> list[Submission]:
    query = _submission_query(db)
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
        headers={"Content-Disposition": "attachment; filename=daily_tl_counts_report.xlsx"},
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
        headers={"Content-Disposition": "attachment; filename=daily_tl_counts_report.pdf"},
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
    return _get_submission_or_404(db, submission_id)

import os
from datetime import timedelta

# Database URL. Render provides DATABASE_URL for its managed Postgres.
# Falls back to a local SQLite file for quick local development/testing.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

# Render's Postgres URLs sometimes start with "postgres://" which SQLAlchemy
# no longer accepts directly; normalize to "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(hours=12)

# Initial admin account, created automatically on first startup if it
# doesn't already exist. Change these via environment variables in production.
INITIAL_ADMIN_USERNAME = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD", "admin123")

# Comma-separated list of allowed CORS origins (frontend URL(s)).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

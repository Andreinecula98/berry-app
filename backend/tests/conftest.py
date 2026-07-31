"""Pytest fixtures. Sets up an isolated SQLite test database before the app
module (and thus its DB engine) is ever imported.
"""
import os
import tempfile

import pytest

# Point the app at a fresh temporary SQLite file for the whole test session,
# instead of touching the local dev database or requiring Postgres.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["INITIAL_ADMIN_USERNAME"] = "admin"
os.environ["INITIAL_ADMIN_PASSWORD"] = "admin123"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]

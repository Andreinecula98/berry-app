# Berry Weight App

An application with 2 types of users:
- **Employee**: logs in and enters `var1`, `var2`, `var3`; the app automatically calculates the **average berry weight** (the average of the 3) and submits the entry for approval.
- **Admin**: logs in with their own credentials, sees all entries submitted by employees (values + average + who + when), can **Approve** or **Reject** them, and can create new employee accounts.

## Structure
```
backend/   - Python API (FastAPI + SQLAlchemy + PostgreSQL/SQLite + JWT)
frontend/  - React interface (Vite)
```

## Default admin account
On first startup, the backend automatically creates an admin account if one doesn't already exist:
- username: `admin`
- password: `admin123` (change it via the `INITIAL_ADMIN_PASSWORD` env var before deploying to production!)

---

## Running locally

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
By default it uses local SQLite (`local.db`). API available at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. The `.env` file contains `VITE_API_URL=http://localhost:8000`.

### Backend tests
```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

---

## CI/CD with GitHub Actions

The repo contains `.github/workflows/ci-cd.yml`, which on every push/PR to `main`:
1. Runs the backend's automated tests (`pytest`).
2. Does a test build of the frontend (`npm run build`).
3. **Only if both succeed** and it's a direct push to `main`, triggers an explicit deploy on Render and Vercel via **Deploy Hooks** — so a push that breaks something never makes it live.

### Initial setup (one-time)

**Render** (disable auto-deploy and generate a Deploy Hook):
1. `berry-app-backend` service → Settings → Auto-Deploy → set to **No**.
2. Settings → Deploy Hook → copy the generated URL.
3. In GitHub: repo → Settings → Secrets and variables → Actions → **New repository secret** → name `RENDER_DEPLOY_HOOK_URL`, value = the copied URL.

**Vercel** (ignore automatic git-push builds, generate a Deploy Hook):
1. Project → Settings → Git → **Ignored Build Step** → set the command to `exit 0` (this way normal pushes no longer trigger a build; deploy hooks ignore this setting and run anyway).
2. Project → Settings → Git → **Deploy Hooks** → create a new one for the `main` branch → copy the URL.
3. In GitHub: add a new secret `VERCEL_DEPLOY_HOOK_URL` with that URL.

After this setup, every push to `main` runs the tests, and the actual deploy only happens if everything passes.

---

## Deploying to production (Render for backend + Vercel for frontend)

### 1. Push the code to GitHub
Create a repo (it can contain both the `backend/` and `frontend/` folders) and push.

### 2. Backend on Render
1. Go to https://render.com → **New** → **Blueprint** and point it to the repo (it uses the included `render.yaml` file, which automatically creates a free PostgreSQL database too).
   - Alternatively, manually: **New Web Service** → select repo → *Root Directory*: `backend` → Build Command: `pip install -r requirements.txt` → Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. Create a **PostgreSQL** database (New → PostgreSQL, Free plan) if it wasn't created automatically from the blueprint.
3. Set the environment variables on the backend service:
   - `DATABASE_URL` → the connection string from the created Postgres database (Render links it automatically if you use `render.yaml`)
   - `SECRET_KEY` → a long, random, secret string
   - `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` → the admin credentials you want
   - `CORS_ORIGINS` → the frontend's Vercel URL (fill it in after step 3), e.g. `https://berry-app.vercel.app`
4. Deploy. Note the backend URL, e.g. `https://berry-app-backend.onrender.com`.

> Note: on the Free plan, Render puts the service to sleep after inactivity — the first request after a pause may take ~30s.

### 3. Frontend on Vercel
1. Go to https://vercel.com → **Add New Project** → import the same repo, with *Root Directory*: `frontend`.
2. Set the environment variable `VITE_API_URL` = the backend's Render URL (e.g. `https://berry-app-backend.onrender.com`).
3. Deploy. Vercel gives you a public URL, e.g. `https://berry-app.vercel.app`.
4. Go back to Render and update `CORS_ORIGINS` with this exact URL, then redeploy the backend.

### 4. Testing
Open the Vercel URL → log in with `admin` / the password you set → create an employee → log out → log in with the new employee → enter var1/var2/var3 → log back in as admin → approve/reject the entry.

---

## Main API endpoints
| Method | Route | Who | Description |
|---|---|---|---|
| POST | /auth/login | anyone | authenticate, returns a JWT |
| POST | /submissions | employee | submit var1/var2/var3, calculates the average |
| GET | /submissions/me | employee | list own submissions |
| POST | /admin/users | admin | create a new employee account |
| GET | /admin/users | admin | list users |
| GET | /admin/submissions | admin | all submissions (filterable by status) |
| GET | /admin/submissions/export/excel | admin | download an Excel report (.xlsx), filterable by status |
| GET | /admin/submissions/export/pdf | admin | download a PDF report, filterable by status |
| PATCH | /admin/submissions/{id} | admin | approve/reject a submission |

## Security
- Passwords are hashed with bcrypt.
- Authentication uses JWT (expires after 12 hours).
- Make sure to change `SECRET_KEY` and the default admin password before exposing the app publicly.

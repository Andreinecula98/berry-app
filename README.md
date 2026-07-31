# Berry Weight App

Aplicație cu 2 tipuri de utilizatori:
- **Angajat**: se loghează și introduce `var1`, `var2`, `var3`; aplicația calculează automat **average berry weight** (media celor 3) și trimite intrarea spre aprobare.
- **Admin**: se loghează cu propriile credențiale, vede toate intrările introduse de angajați (valori + medie + cine + când), le poate **Aproba** sau **Respinge**, și poate crea conturi noi de angajați.

## Structură
```
backend/   - API în Python (FastAPI + SQLAlchemy + PostgreSQL/SQLite + JWT)
frontend/  - Interfață React (Vite)
```

## Cont admin implicit
La primul start, backend-ul creează automat un cont admin dacă nu există deja:
- utilizator: `admin`
- parolă: `admin123` (schimbă-o din variabila `INITIAL_ADMIN_PASSWORD` înainte de deploy în producție!)

---

## Rulare locală

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Implicit folosește SQLite local (`local.db`). API disponibil la `http://localhost:8000` (documentație interactivă la `/docs`).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Deschide `http://localhost:5173`. Fișierul `.env` conține `VITE_API_URL=http://localhost:8000`.

---

## Deploy în producție (Render pentru backend + Vercel pentru frontend)

### 1. Pune codul pe GitHub
Creează un repo (poate conține ambele foldere `backend/` și `frontend/`) și fă push.

### 2. Backend pe Render
1. Mergi pe https://render.com → **New** → **Blueprint** și indică repo-ul (folosește fișierul `backend/render.yaml` inclus, care creează automat și o bază PostgreSQL gratuită).
   - Alternativ, manual: **New Web Service** → alege repo → *Root Directory*: `backend` → Build Command: `pip install -r requirements.txt` → Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. Creează o bază **PostgreSQL** (New → PostgreSQL, plan Free) dacă nu s-a creat automat din blueprint.
3. Setează variabilele de mediu pe serviciul backend:
   - `DATABASE_URL` → connection string-ul din baza Postgres creată (Render îl leagă automat dacă folosești `render.yaml`)
   - `SECRET_KEY` → un string aleatoriu lung și secret
   - `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` → credențialele admin dorite
   - `CORS_ORIGINS` → URL-ul frontend-ului de pe Vercel (îl completezi după pasul 3), ex: `https://berry-app.vercel.app`
4. Deploy. Notează URL-ul backend-ului, ex: `https://berry-app-backend.onrender.com`.

> Notă: pe planul Free, Render "adoarme" serviciul după inactivitate — primul request după pauză poate dura ~30s.

### 3. Frontend pe Vercel
1. Mergi pe https://vercel.com → **Add New Project** → importă același repo, cu *Root Directory*: `frontend`.
2. Setează variabila de mediu `VITE_API_URL` = URL-ul backend-ului de pe Render (ex: `https://berry-app-backend.onrender.com`).
3. Deploy. Vercel îți dă un URL public, ex: `https://berry-app.vercel.app`.
4. Întoarce-te în Render și actualizează `CORS_ORIGINS` cu acest URL exact, apoi redeploy backend-ul.

### 4. Testare
Deschide URL-ul de pe Vercel → login cu `admin` / parola setată → creează un angajat → delogare → login cu noul angajat → introdu var1/var2/var3 → login înapoi ca admin → aprobă/respinge intrarea.

---

## Endpoint-uri API principale
| Metodă | Rută | Cine | Descriere |
|---|---|---|---|
| POST | /auth/login | oricine | autentificare, întoarce JWT |
| POST | /submissions | angajat | trimite var1/var2/var3, calculează media |
| GET | /submissions/me | angajat | listă proprii intrări |
| POST | /admin/users | admin | creează cont angajat nou |
| GET | /admin/users | admin | listă utilizatori |
| GET | /admin/submissions | admin | toate intrările (filtrabil după status) |
| PATCH | /admin/submissions/{id} | admin | aprobă/respinge o intrare |

## Securitate
- Parolele sunt hash-uite cu bcrypt.
- Autentificarea folosește JWT (expiră după 12 ore).
- Schimbă neapărat `SECRET_KEY` și parola admin implicită înainte de a expune aplicația public.

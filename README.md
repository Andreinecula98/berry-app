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

## CI/CD cu GitHub Actions

Repo-ul conține `.github/workflows/ci-cd.yml`, care la fiecare push/PR pe `main`:
1. Rulează testele automate ale backend-ului (`pytest`).
2. Face build de test pentru frontend (`npm run build`).
3. **Doar dacă ambele reușesc** și e push direct pe `main`, declanșează deploy-ul explicit pe Render și Vercel prin **Deploy Hooks** — astfel un push care strică ceva nu ajunge niciodată live.

### Configurare inițială (o singură dată)

**Render** (dezactivează auto-deploy și generează un Deploy Hook):
1. Serviciul `berry-app-backend` → Settings → Auto-Deploy → setează pe **No**.
2. Settings → Deploy Hook → copiază URL-ul generat.
3. În GitHub: repo → Settings → Secrets and variables → Actions → **New repository secret** → nume `RENDER_DEPLOY_HOOK_URL`, valoare = URL-ul copiat.

**Vercel** (ignoră build-urile automate din git push, generează un Deploy Hook):
1. Proiect → Settings → Git → **Ignored Build Step** → setează comanda la `exit 0` (astfel push-urile normale nu mai declanșează build; deploy hook-urile ignoră această setare și rulează oricum).
2. Proiect → Settings → Git → **Deploy Hooks** → creează unul nou pentru branch-ul `main` → copiază URL-ul.
3. În GitHub: adaugă secret nou `VERCEL_DEPLOY_HOOK_URL` cu acel URL.

După acest setup, orice push pe `main` rulează testele, iar deploy-ul real se întâmplă doar dacă totul trece.

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
| GET | /admin/submissions/export/excel | admin | descarcă raport Excel (.xlsx), filtrabil după status |
| GET | /admin/submissions/export/pdf | admin | descarcă raport PDF, filtrabil după status |
| PATCH | /admin/submissions/{id} | admin | aprobă/respinge o intrare |

## Securitate
- Parolele sunt hash-uite cu bcrypt.
- Autentificarea folosește JWT (expiră după 12 ore).
- Schimbă neapărat `SECRET_KEY` și parola admin implicită înainte de a expune aplicația public.

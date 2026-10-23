# ExamPilot AI

ExamPilot AI is an AZ-900 practice app with a Django REST API, a React/Vite frontend, saved quiz history, Supabase Google sign-in, and optional Groq study guidance.

## Local setup (Windows PowerShell)

Use two terminals from the repository root. Install Python 3.10+ and Node.js 22.19+ (the locked frontend test dependencies require Node 22.19 or newer). The local Django settings use SQLite and allow the Vite development origin. Vite proxies `/api` to Django, so set `VITE_API_BASE_URL=/api` in `frontend/.env`.

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate --settings=config.settings_local
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.settings_local
```

If the repository's `backend/venv` already exists, reuse it. Copy `backend/.env.example` to `backend/.env` and set a development `SECRET_KEY` before starting Django. To enable signed-in profiles, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same Supabase project used by the frontend. Set `GROQ_API_KEY` to enable AI-generated study guidance and answer explanations. These variables are optional for local guest practice.

### Frontend

```powershell
cd frontend
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env` to enable Google sign-in. These are public client values; do not put a service-role key in a `VITE_` variable. In Supabase, enable Google under **Authentication → Providers** and use the callback URL shown there as the authorized redirect URI in Google Cloud. Set the Supabase site URL and allowed redirect URL to `http://localhost:5173`. Open the Vite URL printed by the dev server (normally `http://localhost:5173`). The repository does not automatically seed the question bank; add questions before starting a practice quiz.

## Authentication and profile sync

Supabase restores the browser session and supplies an access token to Django. Django validates that token with Supabase before creating or updating the local `UserProfile` using the verified Supabase UID, email, and full name. The profile is synced on sign-in and is also resolved from the bearer token on authenticated API requests. Quiz attempts are saved against that profile, and the dashboard greets a signed-in learner by first name. Guests can practice too; their attempts remain anonymous and are isolated from signed-in account history.

If Google sign-in returns `Unable to exchange external code`, confirm the Google OAuth client ID and secret configured in Supabase and that Google Cloud has the exact Supabase callback URL authorized. The callback URL is distinct from the app's post-login redirect URL.

## Quiz history and study insights

Quiz submissions save the score, correct-answer tally, timestamp, and question-level answer snapshot. **My performance** reads the signed-in user's saved attempts in chronological order; guest history is limited to that guest session's anonymous attempts. Topic accuracy, missed domains, strengths, and trends are calculated from saved answers. Attempts without answer snapshots remain visible but cannot contribute to topic analysis.

The study guidance action sends no performance scores from the browser. Django builds the Groq prompt from the requesting user's saved attempts and missed question domains. When there is not enough saved data or Groq is unavailable, the API returns a rule-based response derived from the available history (or explains that more quiz data is needed); quiz results remain available. Groq calls require `GROQ_API_KEY` in `backend/.env` or the backend process environment.

## Automated checks

Run the backend API tests against the local test settings and the frontend checks from separate terminals:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py test api --settings=config.settings_local
```

```powershell
cd frontend
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

The Django test runner uses its test database and does not modify the local development database.

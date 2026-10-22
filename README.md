# ExamPilot AI

## Local practice quiz

The local frontend uses Vite to proxy `/api` requests to Django at `127.0.0.1:8000`. Run the backend with `config.settings_local` to use SQLite; this does not change the production database settings or require Supabase credentials.

1. In a terminal, create the backend environment if needed, then install dependencies and apply migrations:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe manage.py migrate --settings=config.settings_local
   ```

2. Start Django in that terminal:

   ```powershell
   .\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.settings_local
   ```

3. In a second terminal, install frontend dependencies and start Vite:

   ```powershell
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```

4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`) and choose **Practice quizzes**. The quiz reads questions already present in the local question bank; this setup does not seed or generate question data. To use a different API URL, set `VITE_API_BASE_URL` to its `/api` base URL before starting Vite.

## Supabase Google sign-in

The app remains usable as a guest without Supabase. To enable **Sign in with Google**:

1. Copy `frontend/.env.example` to `frontend/.env`. Set `VITE_SUPABASE_URL` to the Supabase Project URL and `VITE_SUPABASE_ANON_KEY` to its publishable key (or legacy anon key). These are public client values; never put a service-role/secret key in a `VITE_` variable.
2. Copy `backend/.env.example` to `backend/.env`. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same project URL and public key. The backend uses the signed-in access token to request the verified user identity from Supabase before syncing a profile.
3. In Supabase, enable the Google provider with an OAuth client ID and client secret from your Google Cloud project. In Google Cloud, add `http://localhost:5173` as an authorized JavaScript origin and the callback URL shown in Supabase's Google provider settings as an authorized redirect URI.
4. In Supabase **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and add it to the allowed redirect URLs. If Vite uses another port, update both origins to match.
5. Restart Django and Vite after changing the environment files. Supabase Auth restores browser sessions and refreshes tokens. The backend rejects profile sync without a valid bearer token and derives the profile ID, email, and name from Supabase's verified user response rather than browser-supplied identity fields.

This integration syncs account profiles only. Quiz attempts, results, and learning insights still use the shared anonymous history. The backend does not provide per-account history or learner-specific authorization for those endpoints; sign-in must not be treated as privacy or access control for quiz data. The UI tells signed-in learners this after successful profile sync.

## Quiz results and performance

Submitting a quiz saves its score and a question-by-question answer snapshot on the attempt. **My performance** reads persisted anonymous attempts from `GET /api/attempts/performance/` for history, score trends, topic accuracy, and answer review. Signing in syncs a profile but does not associate attempts or provide per-account history; anonymous attempts cannot be separated by person, and profile-linked attempts are excluded from this endpoint. The API rejects client-supplied `supabase_uid` on quiz submission so a caller cannot misattribute an attempt to another profile. Existing attempts created before this feature remain in history; their question-level review and topic breakdown are unavailable because those answers were not previously stored. Topic accuracy and rule-based recommendations use saved answer snapshots; optional AI guidance can fail without hiding quiz results.

## Learning explanations

Answer review always shows the explanation saved with each question. Select **Explain my answer** to request a question-specific explanation from the backend Groq integration. The server uses the stored question, choices, correct answer, and selected option; the browser cannot supply correctness data or a custom prompt. Explanations are generated only when requested and do not affect quiz scoring. If Groq is not configured or unavailable, the saved explanation remains visible and is returned as a fallback.

AI explanations are optional for local development. The existing backend reads `GROQ_API_KEY` from the backend process environment or `backend/.env` (loaded by `python-dotenv`). To enable them locally, add this line to `backend/.env` with your own key:

```dotenv
GROQ_API_KEY=your_groq_api_key
```

Do not add `.env` files or real API keys to source control. Without this variable, quiz submission, saved answer review, and performance history continue to work; the explanation action displays the stored question explanation.

## Topic insights and recommendations

**My performance** now includes a rule-based study plan calculated from saved question results. A topic is assessed after at least 3 saved answers: below 70% is a focus area, 70–79% is developing, and 80% or higher is a strength. Topics below the sample minimum are marked as needing more answers rather than being called weak. Topic changes compare the latest saved attempt for that topic with earlier saved answers when both samples contain at least 3 answers; a change over 5 percentage points is marked improving or declining.

These rules and their recommendations work without AI. **Get study guidance** optionally asks the existing Groq service for a concise narrative based on the same server-calculated results; if `GROQ_API_KEY` is missing or Groq fails, the rule-based plan remains available. The request does not accept client scores as evidence.

Topic insights use the same anonymous quiz attempts visible in shared history; they are not isolated to an individual account, even when the learner signs in. Attempts without saved question-level results cannot contribute to topic recommendations.

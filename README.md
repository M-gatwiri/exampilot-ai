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

## Quiz results and performance

Submitting a quiz saves its score and a question-by-question answer snapshot on the attempt. **My performance** reads persisted anonymous attempts from `GET /api/attempts/performance/` for history, score trends, topic accuracy, and answer review. The app does not currently authenticate learners, so anonymous attempts cannot be separated by person; profile-linked attempts are excluded from this endpoint. Existing attempts created before this feature remain in history; their question-level review and topic breakdown are unavailable because those answers were not previously stored. Topic accuracy and rule-based recommendations use saved answer snapshots; optional AI guidance can fail without hiding quiz results.

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

The application does not currently identify learners. As with the existing performance endpoint, topic insights use the anonymous quiz attempts visible in the shared history; they are not isolated to an individual account. Attempts without saved question-level results cannot contribute to topic recommendations.

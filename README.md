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

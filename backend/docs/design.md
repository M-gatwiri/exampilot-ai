# 🏛️ ExamPilot AI (AZ-900) – Backend System Design & Architecture

## 1. Overview

The ExamPilot AI backend is built with **Django** and **Django REST Framework (DRF)**. It is the core orchestration and business-logic layer for the Azure-900 exam preparation platform. It:

- Persists data in a **Supabase PostgreSQL** database.
- Integrates with LLM APIs (**Groq / Gemini**) for dynamic, real-time question generation and concept explanations.

---

## 2. System Architecture & Request Flow

```text
[ React + Vite Frontend ]
       │ (HTTP POST / GET with JSON payload)
       ▼
[ Django REST Framework (DRF) API ]
  ├── /api/auth/        -> User Authentication / Profiles
  ├── /api/quiz/        -> Dynamic Question Generation & Submission
  ├── /api/flashcards/  -> AI Concept Explanations & Decks
  └── /api/readiness/   -> Exam Readiness Score Calculation Engine
       │
       ▼
[ Supabase PostgreSQL Database ] (Managed via Django ORM & Migrations)
```

---

## 3. Database Schema Design (Django Models)

### 3.1 User Profile (extends Django `User`)

| Field        | Type                       |
|--------------|----------------------------|
| `id`         | PK (UUID / AutoField)      |
| `user`       | OneToOne → Django `User`   |
| `created_at` | DateTime                   |

### 3.2 Question Bank & Dynamic Cache (`Question`)

| Field            | Type         | Notes                                                                                   |
|------------------|--------------|-----------------------------------------------------------------------------------------|
| `id`             | PK           |                                                                                         |
| `domain`         | CharField    | e.g. "Cloud Concepts", "Azure Architecture", "Management & Governance"                  |
| `question_text`  | TextField    |                                                                                         |
| `options`        | JSONField    | Stores the multiple-choice options                                                      |
| `correct_answer` | CharField    |                                                                                         |
| `explanation`    | TextField    |                                                                                         |
| `is_ai_generated`| BooleanField |                                                                                         |
| `created_at`     | DateTime     |                                                                                         |

### 3.3 Quiz Attempt & Results (`QuizAttempt`)

| Field              | Type                | Notes                                  |
|--------------------|---------------------|----------------------------------------|
| `id`               | PK                  |                                        |
| `user`             | ForeignKey → `User` |                                        |
| `score`            | IntegerField        |                                        |
| `total_questions`  | IntegerField        |                                        |
| `domain_breakdown` | JSONField           | Tracks performance per domain          |
| `completed_at`     | DateTime            |                                        |

### 3.4 Saved Flashcards (`Flashcard`)

| Field              | Type                |
|--------------------|---------------------|
| `id`               | PK                  |
| `user`             | ForeignKey → `User` |
| `front_concept`    | CharField           |
| `back_explanation` | TextField           |
| `domain`           | CharField           |

---

## 4. API Endpoints Specification

| Endpoint               | Method     | Description                                                                                     |
|------------------------|------------|-------------------------------------------------------------------------------------------------|
| `/api/quiz/generate/`  | POST       | Calls the AI service layer to generate a fresh batch of Azure-900 MCQs for the requested domain. |
| `/api/quiz/submit/`    | POST       | Evaluates user answers, saves the `QuizAttempt`, and recalculates readiness.                     |
| `/api/flashcards/`     | GET / POST | Retrieves or saves AI-generated flashcards for user review.                                      |
| `/api/readiness/`      | GET        | Computes the overall exam readiness percentage from historical quiz performance.                 |

---

## 5. Security & Configuration

- **CORS:** Configured explicitly to allow traffic from the Vite frontend development origin (`http://localhost:5173`) and production domains.
- **Environment Variables:** Database credentials and LLM API keys are managed via `.env` and loaded through `python-dotenv`. The `.env` file must never be committed to version control.
# AZ-900 Prep App - Backend API Contract

Base URL (Local): `http://127.0.0.1:8000/api/`

## Endpoints

### 1. Questions
- **GET** `/api/questions/` - Retrieve a list of all exam questions.
- **POST** `/api/questions/` - Create a new manual question.
- **POST** `/api/questions/generate_ai/` - Generate custom AI questions via Groq and save them to the DB.
  - *Expected JSON Payload:* 
    ```json
    {
      "topic": "Azure Pricing and Support",
      "count": 3
    }
    ```

### 2. Flashcards
- **GET** `/api/flashcards/` - Retrieve all flashcards.
- **POST** `/api/flashcards/` - Create a new flashcard.

### 3. Quiz Attempts
- **GET** `/api/attempts/` - View user quiz history / scores.
- **POST** `/api/attempts/` - Submit a completed quiz score.

### 4. User Profiles
- **GET** `/api/profiles/` - Retrieve user profiles.
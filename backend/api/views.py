import os
import json
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from groq import Groq
from .models import UserProfile, Question, QuizAttempt, Flashcard
from .serializers import (
    UserProfileSerializer,
    QuestionSerializer,
    QuizAttemptSerializer,
    FlashcardSerializer,
)

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer

    @action(detail=False, methods=['post'])
    def generate_ai(self, request):
        """
        Calls Groq to generate AZ-900 practice questions and saves them to Supabase.
        Expected JSON payload: { "topic": "Azure Pricing and Support", "count": 3 }
        """
        topic = request.data.get('topic', 'Azure Cloud Concepts')
        count = int(request.data.get('count', 3))

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return Response(
                {"error": "Groq API key not configured on backend."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        client = Groq(api_key=api_key)

        prompt = f"""
        You are an expert Microsoft Azure certified instructor. Generate {count} multiple-choice practice questions for the AZ-900 (Azure Fundamentals) exam focusing on the topic: "{topic}".
        
        You MUST return a valid JSON array of objects. Do not include markdown code blocks (like ```json) or any extra text, just raw JSON.
        
        Each object in the array must have these exact keys:
        - "question_text": The question statement.
        - "option_a": Text for option A.
        - "option_b": Text for option B.
        - "option_c": Text for option C.
        - "option_d": Text for option D.
        - "correct_answer": A single letter ("A", "B", "C", or "D") indicating the correct option.
        - "explanation": Brief explanation why the correct answer is right.
        """

        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a precise JSON-only generator for educational quizzes."},
                    {"role": "user", "content": prompt}
                ],
                model="openai/gpt-oss-20b",  # Stable production model ID on Groq
                temperature=0.7,
            )

            raw_content = chat_completion.choices[0].message.content.strip()
            
            # Clean up markdown code blocks if the model accidentally includes them
            if raw_content.startswith("```"):
                raw_content = raw_content.split("```")[1]
                if raw_content.startswith("json"):
                    raw_content = raw_content[4:].strip()

            questions_data = json.loads(raw_content)
            saved_questions = []

            # Save each generated question into the Supabase DB
            for q in questions_data:
                options_payload = {
                    "A": q.get("option_a"),
                    "B": q.get("option_b"),
                    "C": q.get("option_c"),
                    "D": q.get("option_d"),
                }

                question_obj = Question.objects.create(
                    domain="cloud_concepts",
                    question_text=q.get("question_text"),
                    options=options_payload,
                    correct_answer=q.get("correct_answer"),
                    explanation=q.get("explanation"),
                    is_ai_generated=True
                )
                saved_questions.append(QuestionSerializer(question_obj).data)

            return Response({
                "message": f"Successfully generated and saved {len(saved_questions)} questions!",
                "questions": saved_questions
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class QuizAttemptViewSet(viewsets.ModelViewSet):
    queryset = QuizAttempt.objects.all()
    serializer_class = QuizAttemptSerializer

class FlashcardViewSet(viewsets.ModelViewSet):
    queryset = Flashcard.objects.all()
    serializer_class = FlashcardSerializer
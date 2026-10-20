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

    @action(detail=False, methods=['post'])
    def submit_quiz(self, request):
        """
        Calculates score for submitted answers and saves a QuizAttempt.
        Payload: { "user_profile_id": 1, "answers": { "question_id_1": "A", "question_id_2": "C" } }
        """
        user_id = request.data.get('user_profile_id')
        submitted_answers = request.data.get('answers', {})  # Dict of {question_id: selected_option}
        
        total_questions = len(submitted_answers)
        if total_questions == 0:
            return Response({"error": "No answers provided."}, status=status.HTTP_400_BAD_REQUEST)

        correct_count = 0
        for q_id, chosen_option in submitted_answers.items():
            try:
                question = Question.objects.get(pk=q_id)
                if question.correct_answer.strip().upper() == chosen_option.strip().upper():
                    correct_count += 1
            except Question.DoesNotExist:
                continue

        score_percentage = (correct_count / total_questions) * 100

        # Retrieve user profile if provided
        user_profile = None
        if user_id:
            try:
                user_profile = UserProfile.objects.get(pk=user_id)
            except UserProfile.DoesNotExist:
                pass

        # Save the attempt
        attempt = QuizAttempt.objects.create(
            user=user_profile,
            score=score_percentage
        )

        return Response({
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "score": score_percentage,
            "attempt_id": attempt.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def generate_insights(self, request):
        """
        Uses Groq to analyze recent quiz performance and give study recommendations.
        Payload: { "topic_scores": { "Cloud Concepts": 50, "Azure Pricing": 80 } }
        """
        topic_scores = request.data.get('topic_scores', {})
        
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return Response(
                {"error": "Groq API key not configured on backend."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        client = Groq(api_key=api_key)
        prompt = f"""
        Analyze these AZ-900 exam practice scores by topic: {topic_scores}.
        Provide constructive learning insights, highlight weak areas, and offer 3 bullet-point study recommendations for the Azure Fundamentals exam. Keep it concise and encouraging.
        """

        try:
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="openai/gpt-oss-20b",
            )
            
            insights = chat_completion.choices[0].message.content.strip()
            return Response({"insights": insights}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class FlashcardViewSet(viewsets.ModelViewSet):
    queryset = Flashcard.objects.all()
    serializer_class = FlashcardSerializer
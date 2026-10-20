from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    supabase_uid = models.CharField(max_length=255, unique=True, null=True, blank=True) # Maps to Supabase Auth UUID
    username = models.CharField(max_length=150)
    email = models.EmailField(unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username

class Question(models.Model):
    DOMAIN_CHOICES = [
        ('cloud_concepts', 'Cloud Concepts'),
        ('azure_architecture', 'Azure Architecture & Services'),
        ('management_governance', 'Azure Management & Governance'),
    ]

    domain = models.CharField(max_length=50, choices=DOMAIN_CHOICES)
    question_text = models.TextField()
    options = models.JSONField(help_text="Store choices as a JSON array/object")
    correct_answer = models.CharField(max_length=255)
    explanation = models.TextField()
    is_ai_generated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.domain}] {self.question_text[:50]}..."


class QuizAttempt(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, null=True, blank=True) # <-- Added null=True, blank=True
    score = models.FloatField()
    total_questions = models.IntegerField()
    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - Score: {self.score}/{self.total_questions}"


class Flashcard(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='flashcards', null=True, blank=True)
    front_concept = models.CharField(max_length=255)
    back_explanation = models.TextField()
    domain = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Flashcard: {self.front_concept}"
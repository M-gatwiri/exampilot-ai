from django.contrib import admin
from .models import UserProfile, Question, QuizAttempt, Flashcard

admin.site.register(UserProfile)
admin.site.register(Question)
admin.site.register(QuizAttempt)
admin.site.register(Flashcard)
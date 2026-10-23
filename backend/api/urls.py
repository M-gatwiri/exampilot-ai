from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserProfileViewSet,
    QuestionViewSet,
    QuizAttemptViewSet,
    FlashcardViewSet,
)

router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'attempts', QuizAttemptViewSet)
router.register(r'flashcards', FlashcardViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
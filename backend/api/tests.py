import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Question, QuizAttempt, UserProfile


class SupabaseProfileSyncTests(APITestCase):
    url = "/api/profiles/google_auth/"

    def supabase_response(self, user):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(user).encode("utf-8")
        return response

    @override_settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_ANON_KEY="public-anon-key")
    @patch("api.views.urlopen")
    def test_profile_sync_uses_verified_supabase_identity(self, urlopen):
        urlopen.return_value = self.supabase_response({
            "id": "verified-user-id",
            "email": "learner@example.com",
            "user_metadata": {"full_name": "A Learner"},
        })

        response = self.client.post(
            self.url,
            {"supabase_uid": "attacker-id", "email": "attacker@example.com", "username": "Attacker"},
            format="json",
            HTTP_AUTHORIZATION="Bearer verified-access-token",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])
        self.assertEqual(response.data["profile"]["supabase_uid"], "verified-user-id")
        self.assertEqual(response.data["profile"]["email"], "learner@example.com")
        self.assertEqual(response.data["profile"]["username"], "A Learner")
        self.assertEqual(UserProfile.objects.count(), 1)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://project.supabase.co/auth/v1/user")
        self.assertEqual(request.get_header("Authorization"), "Bearer verified-access-token")
        self.assertEqual(request.get_header("Apikey"), "public-anon-key")

    @override_settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_ANON_KEY="public-anon-key")
    @patch("api.views.urlopen")
    def test_profile_sync_updates_existing_verified_profile(self, urlopen):
        profile = UserProfile.objects.create(
            supabase_uid="verified-user-id", email="old@example.com", username="Old Name"
        )
        urlopen.return_value = self.supabase_response({
            "id": "verified-user-id",
            "email": "new@example.com",
            "user_metadata": {"name": "New Name"},
        })

        response = self.client.post(self.url, {}, format="json", HTTP_AUTHORIZATION="Bearer valid-token")

        profile.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["created"])
        self.assertEqual(profile.email, "new@example.com")
        self.assertEqual(profile.username, "New Name")
        self.assertEqual(UserProfile.objects.count(), 1)

    @override_settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_ANON_KEY="public-anon-key")
    @patch("api.views.urlopen")
    def test_profile_sync_links_existing_email_profile_to_verified_supabase_uid(self, urlopen):
        profile = UserProfile.objects.create(email="learner@example.com", username="Old Name")
        urlopen.return_value = self.supabase_response({
            "id": "verified-user-id",
            "email": "learner@example.com",
            "user_metadata": {"full_name": "A Learner"},
        })

        response = self.client.post(self.url, {}, format="json", HTTP_AUTHORIZATION="Bearer valid-token")

        profile.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["created"])
        self.assertEqual(profile.supabase_uid, "verified-user-id")
        self.assertEqual(profile.username, "A Learner")
        self.assertEqual(UserProfile.objects.count(), 1)

    @patch("api.views.urlopen")
    def test_profile_sync_requires_bearer_token_and_backend_configuration(self, urlopen):
        public_profile_list = self.client.get("/api/profiles/")
        self.assertEqual(public_profile_list.status_code, 404)

        missing_token = self.client.post(self.url, {}, format="json")
        self.assertEqual(missing_token.status_code, 401)
        urlopen.assert_not_called()

        with override_settings(SUPABASE_URL="", SUPABASE_ANON_KEY=""):
            unconfigured = self.client.post(
                self.url, {}, format="json", HTTP_AUTHORIZATION="Bearer valid-token"
            )
        self.assertEqual(unconfigured.status_code, 503)
        urlopen.assert_not_called()

    @override_settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_ANON_KEY="public-anon-key")
    @patch("api.views.urlopen")
    def test_profile_sync_rejects_invalid_supabase_session(self, urlopen):
        from urllib.error import HTTPError

        urlopen.side_effect = HTTPError("https://project.supabase.co/auth/v1/user", 401, "invalid", {}, None)
        response = self.client.post(
            self.url, {}, format="json", HTTP_AUTHORIZATION="Bearer expired-token"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(UserProfile.objects.count(), 0)


class QuizApiTests(APITestCase):
    def setUp(self):
        self.question = Question.objects.create(
            domain="cloud_concepts",
            question_text="Which service provides virtual machines?",
            options={"A": "Azure Virtual Machines", "B": "Azure DNS"},
            correct_answer="A",
            explanation="Virtual Machines provide compute instances.",
            is_ai_generated=False,
        )

    def test_questions_endpoint_returns_existing_question_contract(self):
        response = self.client.get(
            "/api/questions/", HTTP_ORIGIN="http://127.0.0.1:5173"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.question.id)
        self.assertEqual(response.data[0]["options"]["A"], "Azure Virtual Machines")
        self.assertEqual(
            response["Access-Control-Allow-Origin"], "http://127.0.0.1:5173"
        )

    def test_complete_question_fetch_and_quiz_submission_flow(self):
        questions_response = self.client.get("/api/questions/")
        question_id = questions_response.data[0]["id"]

        submit_response = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(question_id): "A"}},
            format="json",
        )

        self.assertEqual(questions_response.status_code, 200)
        self.assertEqual(submit_response.status_code, 201)
        self.assertEqual(submit_response.data["total_questions"], 1)
        self.assertEqual(submit_response.data["correct_answers"], 1)
        self.assertEqual(submit_response.data["score"], 100)
        self.assertEqual(submit_response.data["question_results"][0]["explanation"], self.question.explanation)

        performance_response = self.client.get("/api/attempts/performance/")
        self.assertEqual(performance_response.status_code, 200)
        self.assertEqual(len(performance_response.data["attempts"]), 1)
        self.assertEqual(performance_response.data["attempts"][0]["id"], submit_response.data["attempt_id"])
        self.assertTrue(performance_response.data["attempts"][0]["review_available"])
        self.assertEqual(performance_response.data["domains"][0]["domain"], "Cloud Concepts")

    def test_submit_quiz_rejects_client_supplied_profile_identity(self):
        profile = UserProfile.objects.create(supabase_uid="known-user", username="Learner")

        response = self.client.post(
            "/api/attempts/submit_quiz/",
            {"supabase_uid": profile.supabase_uid, "answers": {str(self.question.id): "A"}},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(QuizAttempt.objects.count(), 0)

    def test_performance_endpoint_returns_empty_history(self):
        response = self.client.get("/api/attempts/performance/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["attempts"], [])
        self.assertEqual(response.data["domains"], [])
        self.assertEqual(response.data["learning_insights"]["status"], "insufficient_data")
        self.assertEqual(response.data["learning_insights"]["recommendations"], [])

    def test_performance_aggregates_saved_results_and_old_attempts(self):
        azure_question = Question.objects.create(
            domain="azure_architecture",
            question_text="Which service runs virtual machines?",
            options={"A": "Virtual Machines", "B": "DNS"},
            correct_answer="A",
            explanation="Virtual Machines provide compute.",
            is_ai_generated=False,
        )
        submission = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(self.question.id): "A", str(azure_question.id): "B"}},
            format="json",
        )
        self.assertEqual(submission.status_code, 201)
        self.assertFalse(submission.data["question_results"][1]["correct"])
        self.assertEqual(submission.data["question_results"][1]["selected_answer"], "B")
        legacy_attempt = QuizAttempt.objects.create(score=50, total_questions=2)

        response = self.client.get("/api/attempts/performance/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["attempts"]), 2)
        legacy_result = next(item for item in response.data["attempts"] if item["id"] == legacy_attempt.id)
        self.assertFalse(legacy_result["review_available"])
        self.assertEqual(legacy_result["correct_answers"], 1)
        scores = {item["domain"]: item["score"] for item in response.data["domains"]}
        self.assertEqual(scores["Cloud Concepts"], 100)
        self.assertEqual(scores["Azure Architecture & Services"], 0)

    def test_performance_does_not_return_profile_linked_attempts(self):
        profile = UserProfile.objects.create(username="Learner")
        QuizAttempt.objects.create(user=profile, score=100, total_questions=1)

        response = self.client.get("/api/attempts/performance/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["attempts"], [])

    def test_general_attempt_serializer_does_not_expose_answer_snapshots(self):
        self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(self.question.id): "A"}},
            format="json",
        )

        response = self.client.get("/api/attempts/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("question_results", response.data[0])

    def test_submit_quiz_rejects_invalid_or_missing_questions(self):
        invalid_option = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(self.question.id): "Z"}},
            format="json",
        )
        missing_question = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {"999999": "A"}},
            format="json",
        )
        duplicate_question = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(self.question.id): "A", f"0{self.question.id}": "B"}},
            format="json",
        )

        self.assertEqual(invalid_option.status_code, 400)
        self.assertEqual(missing_question.status_code, 400)
        self.assertEqual(duplicate_question.status_code, 400)
        self.assertEqual(QuizAttempt.objects.count(), 0)

    def test_submit_quiz_endpoint_scores_answers_and_returns_result_contract(self):
        response = self.client.post(
            "/api/attempts/submit_quiz/",
            {"answers": {str(self.question.id): "A"}},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["total_questions"], 1)
        self.assertEqual(response.data["correct_answers"], 1)
        self.assertEqual(response.data["score"], 100)
        self.assertTrue(response.data["attempt_id"])

    def test_submit_quiz_rejects_empty_answers(self):
        response = self.client.post(
            "/api/attempts/submit_quiz/", {"answers": {}}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "No answers provided.")


class ExplainAnswerApiTests(APITestCase):
    def setUp(self):
        self.question = Question.objects.create(
            domain="cloud_concepts",
            question_text="Which service provides virtual machines?",
            options={"A": "Azure Virtual Machines", "B": "Azure DNS"},
            correct_answer="A",
            explanation="Virtual Machines provide compute instances.",
            is_ai_generated=False,
        )
        self.url = f"/api/questions/{self.question.id}/explain_answer/"

    @staticmethod
    def completion(content):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-key")
    def test_generates_explanation_from_verified_question_and_answer(self, _getenv, groq):
        groq.return_value.chat.completions.create.return_value = self.completion(
            "Virtual Machines provide compute; DNS resolves names."
        )

        response = self.client.post(self.url, {"selected_answer": "B"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "ai")
        self.assertFalse(response.data["fallback"])
        self.assertFalse(response.data["retryable"])
        self.assertFalse(response.data["correct"])
        self.assertEqual(response.data["selected_answer"], "B")
        self.assertEqual(response.data["correct_answer"], "A")
        prompt = groq.return_value.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn("Azure Virtual Machines", prompt)
        self.assertIn("Learner choice: B — Azure DNS", prompt)
        self.assertIn("Learner was correct: false", prompt)
        groq.assert_called_once_with(api_key="test-key", timeout=12.0, max_retries=0)

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-key")
    def test_explains_correct_answers_without_changing_correctness(self, _getenv, groq):
        groq.return_value.chat.completions.create.return_value = self.completion(
            "Virtual Machines supply compute capacity."
        )

        response = self.client.post(self.url, {"selected_answer": "a"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["correct"])
        self.assertEqual(response.data["correct_answer"], "A")

    def test_missing_question_returns_not_found(self):
        response = self.client.post("/api/questions/999999/explain_answer/", {"selected_answer": "A"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_rejects_invalid_data_and_client_supplied_truth(self):
        missing = self.client.post(self.url, {}, format="json")
        invalid_option = self.client.post(self.url, {"selected_answer": "Z"}, format="json")
        invalid_type = self.client.post(self.url, {"selected_answer": 1}, format="json")
        mismatched_answer = self.client.post(self.url, {"selected_answer": "B", "question_id": 999}, format="json")
        forged_correctness = self.client.post(
            self.url,
            {"selected_answer": "B", "correct_answer": "B", "correct": True},
            format="json",
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid_option.status_code, 400)
        self.assertEqual(invalid_type.status_code, 400)
        self.assertEqual(mismatched_answer.status_code, 400)
        self.assertEqual(forged_correctness.status_code, 400)

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value=None)
    def test_missing_credentials_uses_stored_explanation(self, _getenv, groq):
        response = self.client.post(self.url, {"selected_answer": "B"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "stored")
        self.assertTrue(response.data["fallback"])
        self.assertFalse(response.data["retryable"])
        self.assertEqual(response.data["explanation"], self.question.explanation)
        groq.assert_not_called()

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-key")
    def test_provider_failures_fall_back_without_leaking_errors_or_secrets(self, _getenv, groq):
        create = groq.return_value.chat.completions.create
        for provider_error in (TimeoutError("test-key timed out"), RuntimeError("rate limited")):
            with self.subTest(error=type(provider_error).__name__):
                create.side_effect = provider_error
                response = self.client.post(self.url, {"selected_answer": "B"}, format="json")

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["source"], "stored")
                self.assertTrue(response.data["fallback"])
                self.assertTrue(response.data["retryable"])
                self.assertNotIn("test-key", str(response.data))
                self.assertNotIn("timed out", str(response.data))
                self.assertNotIn("rate limited", str(response.data))
                self.assertEqual(response.data["explanation"], self.question.explanation)

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-key")
    def test_empty_or_invalid_provider_responses_use_fallback(self, _getenv, groq):
        create = groq.return_value.chat.completions.create
        for content in (None, "", "x" * 2001):
            with self.subTest(content_length=len(content) if content else 0):
                create.return_value = self.completion(content)
                response = self.client.post(self.url, {"selected_answer": "B"}, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["fallback"])
                self.assertEqual(response.data["source"], "stored")

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value=None)
    def test_missing_stored_explanation_has_safe_database_based_fallback(self, _getenv, groq):
        self.question.explanation = ""
        self.question.save(update_fields=["explanation"])

        response = self.client.post(self.url, {"selected_answer": "B"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "basic")
        self.assertIn("Azure Virtual Machines", response.data["explanation"])
        self.assertNotIn("Azure DNS", response.data["explanation"])
        groq.assert_not_called()


class LearningInsightsApiTests(APITestCase):
    url = "/api/attempts/generate_insights/"

    @staticmethod
    def result(topic, correct):
        return {
            "question_id": 1,
            "question_text": f"Saved question in {topic}",
            "domain": topic,
            "selected_answer": "A",
            "correct_answer": "A" if correct else "B",
            "correct": correct,
            "explanation": "Saved explanation",
        }

    def create_attempt(self, topic, correct_count, missed_count, score=50):
        results = (
            [self.result(topic, True) for _ in range(correct_count)]
            + [self.result(topic, False) for _ in range(missed_count)]
        )
        return QuizAttempt.objects.create(
            score=score,
            total_questions=len(results),
            question_results=results,
        )

    def test_performance_calculates_accuracy_and_prioritizes_weak_topics(self):
        self.create_attempt("Cloud Concepts", correct_count=1, missed_count=3, score=25)
        self.create_attempt("Azure Architecture & Services", correct_count=4, missed_count=0, score=100)

        response = self.client.get("/api/attempts/performance/")

        self.assertEqual(response.status_code, 200)
        insights = response.data["learning_insights"]
        self.assertEqual(insights["status"], "ready")
        self.assertEqual(insights["minimum_answers_per_topic"], 3)
        topics = {topic["topic"]: topic for topic in insights["topics"]}
        self.assertEqual(topics["Cloud Concepts"]["accuracy"], 25)
        self.assertEqual(topics["Cloud Concepts"]["classification"], "focus")
        self.assertEqual(topics["Azure Architecture & Services"]["accuracy"], 100)
        self.assertEqual(topics["Azure Architecture & Services"]["classification"], "strength")
        self.assertEqual(insights["focus_areas"][0]["topic"], "Cloud Concepts")
        self.assertEqual(insights["recommendations"][0]["priority"], "high")
        self.assertIn("1 of 4", insights["recommendations"][0]["recommendation"])

    def test_insufficient_samples_and_legacy_attempts_are_not_misclassified(self):
        self.create_attempt("Cloud Concepts", correct_count=1, missed_count=1, score=50)
        QuizAttempt.objects.create(score=100, total_questions=5, question_results=[])

        response = self.client.get("/api/attempts/performance/")

        insights = response.data["learning_insights"]
        self.assertEqual(insights["status"], "insufficient_data")
        self.assertEqual(insights["attempts_analyzed"], 2)
        self.assertEqual(insights["attempts_with_topic_data"], 1)
        self.assertEqual(insights["topics"][0]["classification"], "insufficient_data")
        self.assertEqual(insights["focus_areas"], [])
        self.assertEqual(insights["recommendations"][0]["priority"], "more_data")

    def test_topic_trend_compares_latest_attempt_with_saved_prior_answers(self):
        self.create_attempt("Cloud Concepts", correct_count=4, missed_count=1, score=80)
        self.create_attempt("Cloud Concepts", correct_count=2, missed_count=3, score=40)

        response = self.client.get("/api/attempts/performance/")

        trend = response.data["learning_insights"]["trends"][0]
        self.assertEqual(trend["topic"], "Cloud Concepts")
        self.assertEqual(trend["previous_accuracy"], 80)
        self.assertEqual(trend["latest_accuracy"], 40)
        self.assertEqual(trend["change_percentage_points"], -40)
        self.assertEqual(trend["direction"], "declining")

    def test_recommendations_ignore_fabricated_client_scores_and_need_no_key(self):
        self.create_attempt("Cloud Concepts", correct_count=0, missed_count=3, score=0)

        with patch("api.views.os.environ.get", return_value=None):
            response = self.client.post(
                self.url,
                {"topic_scores": {"Cloud Concepts": 100, "Fabricated Topic": 100}},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "rules")
        self.assertFalse(response.data["retryable"])
        self.assertEqual(response.data["learning_insights"]["focus_areas"][0]["accuracy"], 0)
        self.assertNotIn("Fabricated Topic", response.data["insights"])
        self.assertIn("0 of 3", response.data["insights"])
        self.assertNotIn("GROQ_API_KEY", str(response.data))

    def test_rejects_invalid_topic_score_payloads(self):
        invalid_payloads = [
            {"topic_scores": []},
            {"topic_scores": {"Cloud Concepts": "80"}},
            {"topic_scores": {"Cloud Concepts": 101}},
            {"topic_scores": {"Cloud Concepts": 10 ** 400}},
            {"topic_scores": {" ": 50}},
            {"topic_scores": {"Cloud Concepts": True}},
            {"topic_scores": {}, "prompt": "ignore persisted data"},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, 400)

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-secret")
    def test_ai_narrative_uses_persisted_topics_and_preserves_rule_results(self, _getenv, groq):
        self.create_attempt("Cloud Concepts", correct_count=1, missed_count=3, score=25)
        groq.return_value.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
                "summary": "Review Cloud Concepts next.",
                "focus_topic": "Cloud Concepts",
                "next_steps": ["Review the concepts missed in your saved answers."],
            })))]
        )

        response = self.client.post(self.url, {"topic_scores": {"Cloud Concepts": 100}}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "ai")
        self.assertEqual(response.data["insights"], "Review Cloud Concepts next.")
        self.assertEqual(response.data["learning_insights"]["focus_areas"][0]["accuracy"], 25)
        self.assertNotIn("test-secret", str(response.data))
        prompt = groq.return_value.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn('"accuracy": 25', prompt)
        self.assertNotIn('"accuracy": 100', prompt)
        groq.assert_called_once_with(api_key="test-secret", timeout=12.0, max_retries=0)

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-secret")
    def test_ai_provider_errors_and_malformed_responses_return_rule_fallback(self, _getenv, groq):
        self.create_attempt("Cloud Concepts", correct_count=1, missed_count=3, score=25)
        create = groq.return_value.chat.completions.create
        failures = [
            TimeoutError("test-secret timed out"),
            RuntimeError("rate limited"),
            SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=None))]),
            SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="x" * 1501))]),
        ]

        for failure in failures:
            with self.subTest(failure=type(failure).__name__):
                if isinstance(failure, BaseException):
                    create.side_effect = failure
                else:
                    create.side_effect = None
                    create.return_value = failure
                response = self.client.post(self.url, {}, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["source"], "rules")
                self.assertTrue(response.data["retryable"])
                self.assertIn("1 of 4", response.data["insights"])
                self.assertNotIn("test-secret", str(response.data))

    @patch("api.views.Groq")
    @patch("api.views.os.environ.get", return_value="test-secret")
    def test_ai_is_not_called_when_topic_data_is_insufficient(self, _getenv, groq):
        self.create_attempt("Cloud Concepts", correct_count=1, missed_count=1, score=50)

        response = self.client.post(self.url, {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "rules")
        self.assertFalse(response.data["retryable"])
        self.assertEqual(response.data["learning_insights"]["status"], "insufficient_data")
        groq.assert_not_called()

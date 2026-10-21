from rest_framework.test import APITestCase

from .models import Question, QuizAttempt, UserProfile


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

    def test_performance_endpoint_returns_empty_history(self):
        response = self.client.get("/api/attempts/performance/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"attempts": [], "domains": []})

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

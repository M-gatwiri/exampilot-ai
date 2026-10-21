from rest_framework.test import APITestCase

from .models import Question


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

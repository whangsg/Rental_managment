"""인증 API 기본 동작 테스트. 프로젝트 루트에서 실행: python -m unittest discover -s backend/tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from config import TestConfig
from extensions import db


class AuthApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig, start_scheduler=False)
        self.client = self.app.test_client()
        with self.app.app_context():
            db.drop_all()
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def register_user(self):
        return self.client.post(
            "/api/auth/register",
            json={
                "student_id": "20260001",
                "name": "테스트 사용자",
                "email": "test@example.com",
                "password": "password123",
            },
        )

    def test_register_and_duplicate(self):
        response = self.register_user()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()["success"])
        self.assertNotIn("password_hash", response.get_json()["data"])

        duplicate = self.register_user()
        self.assertEqual(duplicate.status_code, 409)
        self.assertFalse(duplicate.get_json()["success"])

    def test_login_me_logout(self):
        self.register_user()

        login_response = self.client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.get_json()["success"])

        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.get_json()["data"]["user"]["student_id"], "20260001")

        logout_response = self.client.post("/api/auth/logout")
        self.assertEqual(logout_response.status_code, 200)

        after_logout = self.client.get("/api/auth/me")
        self.assertEqual(after_logout.status_code, 401)

    def test_invalid_password(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "student_id": "20260002",
                "name": "테스트",
                "email": "weak@example.com",
                "password": "123",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"]["code"], "WEAK_PASSWORD")


if __name__ == "__main__":
    unittest.main()

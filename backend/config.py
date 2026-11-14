"""애플리케이션 설정."""
import os
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "rental.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # 세션 쿠키 기반 인증 설정
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # 프론트엔드 개발 서버 주소. 여러 개면 쉼표로 구분
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

    DEVICE_API_KEY = os.environ.get("DEVICE_API_KEY", "")
    CONFIRMATION_TIMEOUT_SECONDS = int(os.environ.get("CONFIRMATION_TIMEOUT_SECONDS", "60"))
    PICKUP_DEADLINE_HOURS = int(os.environ.get("PICKUP_DEADLINE_HOURS", "24"))


class TestConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret-key"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    DEVICE_API_KEY = "test-device-key"
    SESSION_COOKIE_SECURE = False
    CORS_ORIGINS = ["http://localhost"]

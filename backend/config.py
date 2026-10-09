import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "rental.db")
    )
    DEVICE_API_KEY = os.environ.get("DEVICE_API_KEY", "")
    CONFIRMATION_TIMEOUT_SECONDS = int(os.environ.get("CONFIRMATION_TIMEOUT_SECONDS", "60"))
    PICKUP_DEADLINE_HOURS = int(os.environ.get("PICKUP_DEADLINE_HOURS", "24"))


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    DEVICE_API_KEY = "test-device-key"

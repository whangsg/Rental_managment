"""Flask 애플리케이션 생성 및 공통 설정."""
import importlib

from flask import Flask, request
from sqlalchemy.exc import IntegrityError

from config import Config
from extensions import db, login_manager
from auth_utils import failure

BLUEPRINT_MODULES = ["auth", "items", "reservations", "device", "notifications", "admin"]


def create_app(config=Config, start_scheduler=True):
    # start_scheduler는 후속 알림/예약 브랜치와의 인터페이스를 위해 유지한다.
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.session_protection = "strong"

    import models

    @login_manager.user_loader
    def load_user(student_id):
        return db.session.get(models.User, student_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        return failure("UNAUTHORIZED", "로그인이 필요합니다.", 401)

    # 세션 쿠키를 사용하는 프론트엔드 요청에 필요한 CORS 헤더
    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        allowed_origins = app.config.get("CORS_ORIGINS", [])
        if origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Device-Key"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers.add("Vary", "Origin")
        return response

    @app.errorhandler(404)
    def not_found(_error):
        return failure("NOT_FOUND", "요청한 API를 찾을 수 없습니다.", 404)

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return failure("METHOD_NOT_ALLOWED", "지원하지 않는 HTTP 메서드입니다.", 405)

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(_error):
        db.session.rollback()
        return failure("CONFLICT", "중복되거나 유효하지 않은 데이터입니다.", 409)

    @app.errorhandler(500)
    def internal_server_error(_error):
        db.session.rollback()
        return failure("INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.", 500)

    for name in BLUEPRINT_MODULES:
        module = importlib.import_module(f"routes.{name}")
        app.register_blueprint(module.bp)

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    create_app().run(debug=True)

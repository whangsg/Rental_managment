import importlib

from flask import Flask, jsonify

from config import Config
from extensions import db, login_manager

BLUEPRINT_MODULES = ["auth", "items", "reservations", "device", "notifications", "admin"]


def create_app(config=Config, start_scheduler=True):
    # start_scheduler: 연체/자동취소 스케줄러 작업은 이후 브랜치에서 등록 (seed.py, gen_schema.py 호환용 인자)
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)
    login_manager.init_app(app)

    import models

    @login_manager.user_loader
    def load_user(student_id):
        return db.session.get(models.User, student_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify(error="login required"), 401

    for name in BLUEPRINT_MODULES:
        module = importlib.import_module(f"routes.{name}")
        app.register_blueprint(module.bp)

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    create_app().run(debug=True)

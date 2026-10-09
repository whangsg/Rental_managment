"""
Flask 확장(익스텐션) 인스턴스를 한 곳에 모아둡니다.
순환 임포트를 피하기 위해 app.py에서 init_app()으로 초기화합니다.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()
login_manager = LoginManager()
scheduler = BackgroundScheduler(daemon=True)


@event.listens_for(Engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record):
    """SQLite 연결마다 실행되는 PRAGMA 설정.

    foreign_keys=ON   SQLite 는 기본적으로 FK 를 검사하지 않는다. 켜서 잘못된 참조/삭제를 DB 가 거부.
    journal_mode=WAL  동시성: 읽는 중에도 쓸 수 있고 쓰는 중에도 읽을 수 있다 (기본 모드는 서로 막음).
                      여러 사용자가 동시에 접속하는 웹 서비스에서 SQLite 를 쓸 때의 표준 설정.
    busy_timeout      다른 연결이 쓰기 중이면 "database is locked" 로 즉시 실패하지 않고 최대 5초 대기.
                      쓰기 한 번은 수 ms 라 실제로는 거의 기다리지 않는다.
    """
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
    except Exception:  # noqa: BLE001 - SQLite 가 아닌 엔진이면 무시
        pass

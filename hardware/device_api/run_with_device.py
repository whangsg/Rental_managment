"""device.py 를 backend 를 수정하지 않고 끼워 넣어서 서버를 띄우는 임시 실행 스크립트.

    python hardware/device_api/run_with_device.py            (저장소 루트에서)
    옵션: --port 5000  --key esp32-dev-key-change-me  --db 기존DB경로

동작
  1) 임시 폴더에 새 DB 를 만들고 db-package/seed.py 로 시드를 넣는다. (backend/rental.db 는 건드리지 않음)
     매번 새로 만드는 이유: 시드의 예약은 만든 시각 기준 24시간 뒤 픽업 기한이 지나 만료되기 때문.
  2) backend/routes/device.py 대신 hardware/device_api/device.py 를 사용해 backend 앱을 띄운다.
  3) X-Device-Key 는 펌웨어(DEVICE_KEY)와 같은 값이어야 한다.
"""
import argparse
import importlib.util
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BACKEND = os.path.join(ROOT, "backend")
DB_PACKAGE = os.path.join(ROOT, "db-package")
DEFAULT_KEY = "esp32-dev-key-change-me"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def prepare_db(db_path=None, key=DEFAULT_KEY):
    """환경변수를 맞추고(DB 경로, 기기 키), db_path 가 없으면 임시 DB 를 새로 시드한다. 반환: 사용한 DB 경로."""
    os.environ["DEVICE_API_KEY"] = key
    reseed = db_path is None
    if reseed:
        db_path = os.path.join(tempfile.mkdtemp(prefix="rental_device_"), "rental_test.db")
    os.environ["DATABASE_URL"] = "sqlite:///" + db_path.replace("\\", "/")

    sys.path.insert(0, BACKEND)          # backend 모듈들을 reservations.py 와 같은 방식으로 import 하기 위해
    if reseed:
        _load("seed_for_device_test", os.path.join(DB_PACKAGE, "seed.py")).seed()
    return db_path


def build_app(start_scheduler=False):
    """routes.device 자리에 hardware/device_api/device.py 를 끼워 넣고 backend 앱을 만든다."""
    import routes  # noqa: F401  (routes 패키지를 먼저 불러 둠)
    _load("routes.device", os.path.join(HERE, "device.py"))
    from app import create_app
    return create_app(start_scheduler=start_scheduler)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5000)
    ap.add_argument("--key", default=DEFAULT_KEY)
    ap.add_argument("--db", default=None, help="지정하지 않으면 임시 DB 를 새로 시드해서 사용")
    a = ap.parse_args()

    db_path = prepare_db(a.db, a.key)
    app = build_app(start_scheduler=True)
    print(f"DB: {db_path}")
    print(f"기기 키(X-Device-Key): {a.key}")
    print(f"엔드포인트: POST http://<노트북IP>:{a.port}/api/device/tag")
    app.run(host="0.0.0.0", port=a.port, debug=False, use_reloader=False)

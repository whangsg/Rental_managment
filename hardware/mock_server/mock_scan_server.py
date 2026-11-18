"""
ESP32 모의테스트용 서버 (hardware/mock_server)

목적: 팀원의 backend(/api/device/tag 가 병합되기 전)에도,
      ESP32 <-> 서버 통신과 부저 소리를 검증한다.
      backend/ 코드는 import 하지도, 수정하지도 않는다.

DB 연결: db-package/rental.db 를 "읽기 전용"으로 열어 items.rfid_uid 를 조회한다.
         (쓰기 불가 -> 기존 DB를 망가뜨릴 수 없음)

응답 규칙 (실제 backend 의 POST /api/device/tag 와 같은 규칙, DB 는 읽기만 하므로 상태는 바뀌지 않음)
  rfid_uid 가 DB 에 없음                          -> UNKNOWN_TAG   (404)
  status = available (보관중)                     -> ERROR         (409)  예약 없이 태깅 = 거부
  status = reserved + 수령하기를 누른 예약 있음      -> WAIT_CONFIRM  (200)  예약자 본인확인 대기
  status = reserved + 수령하기를 누르지 않음         -> ERROR         (409)
  status = rented    (대여중)                     -> RETURN_OK     (200)  반납 처리
  uid 누락 / 키 불일치 / DB 오류                    -> ERROR         (400 / 401 / 500)
  (Wi-Fi/서버 연결 실패는 ESP32 가 스스로 NETWORK_FAIL 소리를 냄)
  ※ 예약 픽업 기한(24시간)과 본인확인 제한시간은 검사하지 않음 (DB 를 바꾸지 않는 모의 서버이므로)

실행:  pip install flask   ->   python mock_scan_server.py
옵션:  --db 경로   --port 5000   --path /api/device/tag
"""
import argparse
import os
import sqlite3

from flask import Flask, jsonify, request

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.normpath(os.path.join(HERE, "..", "..", "db-package", "rental.db"))
DEVICE_KEY = os.environ.get("DEVICE_API_KEY", "esp32-dev-key-change-me")

# items.status -> (result 코드, 메시지, HTTP 상태코드)   (reserved 는 수령하기 여부로 다시 갈림)
STATUS_RESULT = {
    "reserved":  ("WAIT_CONFIRM", "예약자 본인확인 대기 중", 200),
    "rented":    ("RETURN_OK", "반납 처리 (모의: DB 는 바뀌지 않음)", 200),
    "available": ("ERROR", "예약되지 않은 물품입니다.", 409),
}
PICKUP_NOT_REQUESTED = ("ERROR", "예약자가 아직 '수령하기'를 누르지 않았습니다.", 409)


def reply(result, message, code):
    """실제 backend 의 device.py 와 같은 응답 형식: result 를 최상위에 두고 success/error 도 함께 담는다."""
    body = {"success": code < 400, "result": result, "message": message}
    if code >= 400:
        body["error"] = {"code": result, "message": message}
    return jsonify(body), code


def create_app(db_path, scan_path):
    app = Flask(__name__)

    def lookup(uid):
        # mode=ro : 읽기 전용으로만 연다
        uri = "file:" + db_path.replace("\\", "/") + "?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        try:
            return conn.execute(
                "SELECT i.name, i.status,"
                " (SELECT COUNT(*) FROM reservations r WHERE r.item_id = i.id"
                "   AND r.status = 'pending' AND r.pickup_requested_at IS NOT NULL)"
                " FROM items i WHERE i.rfid_uid = ?", (uid,)).fetchone()
        finally:
            conn.close()

    @app.post(scan_path)
    def scan():
        if request.headers.get("X-Device-Key") != DEVICE_KEY:
            return reply("ERROR", "unauthorized", 401)
        uid = str((request.get_json(silent=True) or {}).get("uid", "")).strip().upper()
        if not uid:
            return reply("ERROR", "uid missing", 400)
        try:
            row = lookup(uid)
        except sqlite3.Error as e:
            print(f"DB 오류: {e}", flush=True)
            return reply("ERROR", "db error", 500)
        if not row:
            print(f"[{uid}] 미등록 -> UNKNOWN_TAG", flush=True)
            return reply("UNKNOWN_TAG", "등록되지 않은 태그", 404)
        name, status, pickup_requested = row
        if status == "reserved" and not pickup_requested:
            result, message, code = PICKUP_NOT_REQUESTED
        else:
            result, message, code = STATUS_RESULT.get(status, ("ERROR", f"알 수 없는 상태: {status}", 409))
        print(f"[{uid}] {name} (status={status}) -> {result}", flush=True)
        return reply(result, f"{name}: {message}", code)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", db=os.path.basename(db_path))

    return app


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--port", type=int, default=5000)
    ap.add_argument("--path", default="/api/device/tag")
    a = ap.parse_args()
    if not os.path.exists(a.db):
        raise SystemExit(f"DB 파일을 찾을 수 없습니다: {a.db}")
    print(f"DB(읽기 전용): {a.db}\n엔드포인트: POST {a.path}  (포트 {a.port})")
    create_app(a.db, a.path).run(host="0.0.0.0", port=a.port)

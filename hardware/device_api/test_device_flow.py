"""POST /api/device/tag 전체 흐름 검증 (서버를 따로 켜지 않아도 됨, backend/rental.db 는 건드리지 않음).

    python hardware/device_api/test_device_flow.py      (저장소 루트에서)
"""
import sys
from datetime import datetime, timedelta

from run_with_device import DEFAULT_KEY, build_app, prepare_db

prepare_db(key=DEFAULT_KEY)
app = build_app(start_scheduler=False)

from extensions import db  # noqa: E402  (prepare_db 로 sys.path 가 잡힌 뒤 import)
from models import Item, PendingConfirmation, Rental, Reservation, User  # noqa: E402

KEY = {"X-Device-Key": DEFAULT_KEY}
fails = 0

DRILL, DSLR, DRIVER, BASKET, CATAN = "75FD892A", "D5AB892A", "AB3127CA", "551A892A", "D5C9882A"


def check(label, cond, extra=""):
    global fails
    fails += not cond
    print(("PASS" if cond else "FAIL"), label, extra)


def scan(client, uid, headers=KEY):
    r = client.post("/api/device/tag", json={"uid": uid}, headers=headers)
    return r.status_code, r.get_json()


def item_status(uid):
    return Item.query.filter_by(rfid_uid=uid).first().status


def login(email, pw="test1234"):
    c = app.test_client()
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.get_json()
    return c


device = app.test_client()
with app.app_context():
    # --- 기본 응답 ----------------------------------------------------------------
    code, j = scan(device, DRIVER, headers={"X-Device-Key": "wrong"})
    check("잘못된 키 -> 401", code == 401, code)
    r = device.post("/api/device/tag", json={}, headers=KEY)
    check("uid 누락 -> 400 ERROR", r.status_code == 400 and r.get_json()["result"] == "ERROR")
    code, j = scan(device, "FFFFFFFF")
    check("미등록 태그 -> 404 UNKNOWN_TAG", code == 404 and j["result"] == "UNKNOWN_TAG")
    code, j = scan(device, DRIVER)
    check("available 물품 -> 409 ERROR", code == 409 and j["result"] == "ERROR", j["message"])
    code, j = scan(device, DSLR)
    check("예약만 됨(수령하기 안 누름) -> 409 ERROR", code == 409 and j["error"]["code"] == "PICKUP_NOT_REQUESTED")

    # --- 시드의 전동 드릴: 수령하기를 이미 누른 예약 -> 본인 확인 대기 ----------------------
    code, j = scan(device, DRILL.lower())
    check("수령하기 누른 예약(소문자 UID) -> 200 WAIT_CONFIRM", code == 200 and j["result"] == "WAIT_CONFIRM", j["message"])
    scan(device, DRILL)
    n = PendingConfirmation.query.filter_by(status="waiting").count()
    check("같은 태그 반복 스캔해도 대기 레코드 1건", n == 1, f"waiting={n}")

    hwang = login("sgwhang@example.com")
    data = hwang.get("/api/me/pending-confirm").get_json()["data"]["pending_confirmation"]
    check("예약자가 pending-confirm 에서 대기 건을 봄", data is not None and data["item_name"] == "전동 드릴")
    res_id = data["reservation_id"]
    r = hwang.post(f"/api/reservations/{res_id}/confirm", json={"confirmed": True})
    check("본인 확인 승인 -> 대여 시작(201)", r.status_code == 201, r.get_json().get("data", {}).get("message"))
    check("전동 드릴 상태 rented", item_status(DRILL) == "rented")

    code, j = scan(device, DRILL)
    check("대여중 물품 태깅 -> RETURN_OK", code == 200 and j["result"] == "RETURN_OK", j["message"])
    check("전동 드릴 상태 available 로 복귀", item_status(DRILL) == "available")
    rental = Rental.query.filter_by(reservation_id=res_id).first()
    check("대여 기록 returned + 반납일 기록", rental.status == "returned" and rental.return_date is not None)
    code, j = scan(device, DRILL)
    check("반납 후 다시 태깅 -> 409 ERROR", code == 409 and j["result"] == "ERROR")

    # --- 연체 대여 반납 -------------------------------------------------------------
    code, j = scan(device, CATAN)
    check("연체 중 물품 반납 -> RETURN_OK", code == 200 and j["result"] == "RETURN_OK")
    check("카탄 대여 returned", Rental.query.filter_by(item_id=Item.query.filter_by(rfid_uid=CATAN).first().id, status="returned").count() >= 1)

    # --- 처음부터 끝까지: 예약 -> 수령하기 -> 태그 -> 확인 -> 대여 -> 반납 --------------------------
    r = hwang.post("/api/reservations", json={"item_id": Item.query.filter_by(rfid_uid=DRIVER).first().id, "desired_loan_days": 3})
    check("드라이버 세트 예약(201)", r.status_code == 201, r.get_json().get("error", {}).get("message", ""))
    rid = r.get_json()["data"]["id"]
    code, j = scan(device, DRIVER)
    check("예약 직후(수령하기 전) 태깅 -> 409", code == 409 and j["error"]["code"] == "PICKUP_NOT_REQUESTED")
    r = hwang.post(f"/api/reservations/{rid}/pickup-request")
    check("수령하기 요청 200", r.status_code == 200)
    code, j = scan(device, DRIVER)
    check("수령하기 후 태깅 -> WAIT_CONFIRM", code == 200 and j["result"] == "WAIT_CONFIRM")

    # --- 본인 확인 시간 초과 ---------------------------------------------------------
    conf = PendingConfirmation.query.filter_by(reservation_id=rid, status="waiting").first()
    conf.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.session.commit()
    code, j = scan(device, DRIVER)
    check("확인 시간 초과 후 태깅 -> 수령하기를 다시 눌러야 함(409)", code == 409 and j["error"]["code"] == "PICKUP_NOT_REQUESTED")
    hwang.post(f"/api/reservations/{rid}/pickup-request")
    code, j = scan(device, DRIVER)
    check("수령하기 재요청 후 태깅 -> WAIT_CONFIRM", code == 200 and j["result"] == "WAIT_CONFIRM")

    # --- 본인 확인 거부 ---------------------------------------------------------------
    r = hwang.post(f"/api/reservations/{rid}/confirm", json={"confirmed": False})
    check("본인 확인 거부 200", r.status_code == 200)
    code, j = scan(device, DRIVER)
    check("거부 후 태깅 -> 409 (수령하기 다시 필요)", code == 409)
    check("거부해도 물품은 reserved 유지", item_status(DRIVER) == "reserved")

print("\n전부 통과" if not fails else f"\n실패 {fails}건")
sys.exit(1 if fails else 0)

"""ESP32 기기용 API: RFID 태그 스캔 처리.

이 파일은 backend/routes/device.py 에 그대로 복사해서 쓰는 참고 구현임.
(reservations.py 와 같은 방식으로 import 하므로 내용 수정 없이 복사만 하면 됨)

POST /api/device/tag     인증: 헤더 X-Device-Key
  요청  {"uid": "75FD892A"}
  응답  {"success": bool, "result": "<코드>", "message": "..."}  (+ 실패 시 error 객체)

ESP32 는 대여/반납을 구분하지 않고 이 API 하나만 호출하며, 서버가 물품 상태를 보고 판단함.

  물품 상태                                          result         HTTP
  ------------------------------------------------  -------------  ----
  등록되지 않은 UID                                   UNKNOWN_TAG    404
  reserved + 예약자가 수령하기를 누름(제한시간 이내)      WAIT_CONFIRM   200   (본인 확인 대기 레코드 생성)
  reserved + 수령하기를 누르지 않음                    ERROR          409
  rented                                             RETURN_OK      200   (반납 처리)
  available 등 그 외                                  ERROR          409
  uid 누락                                           ERROR          400
"""
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from auth_utils import device_key_required
from extensions import db
from models import Item, PendingConfirmation, Rental, Reservation, User
from reservation_tasks import expire_pending_confirmations, expire_reservations

bp = Blueprint("device", __name__, url_prefix="/api/device")


def device_response(result, message, status, code=None):
    """기기용 응답. 펌웨어가 읽기 쉽도록 result 를 최상위에 두고, 공통 형식(success/error)도 함께 담는다."""
    body = {"success": status < 400, "result": result, "message": message}
    if status >= 400:
        body["error"] = {"code": code or result, "message": message}
    return jsonify(body), status


@bp.post("/tag")
@device_key_required
def scan_tag():
    """태그 스캔값 전송. 물품 상태에 따라 본인 확인 대기 생성 또는 반납 처리."""
    body = request.get_json(silent=True)
    uid = str(body.get("uid", "")).strip().upper() if isinstance(body, dict) else ""
    if not uid:
        return device_response("ERROR", "uid 가 필요합니다.", 400, "INVALID_UID")

    now = datetime.utcnow()

    # 스케줄러 실행 전이라도 스캔 시점에 만료된 예약/본인 확인 요청을 먼저 정리
    expire_reservations(now)
    expire_pending_confirmations(now)

    item = Item.query.filter_by(rfid_uid=uid).first()
    if item is None:
        return device_response("UNKNOWN_TAG", "등록되지 않은 태그입니다.", 404)

    if item.status == "rented":
        return _return_item(item, now)

    if item.status == "reserved":
        return _wait_confirmation(item, now)

    return device_response("ERROR", f"'{item.name}'은(는) 예약되지 않은 물품입니다.", 409, "ITEM_NOT_RESERVED")


def _wait_confirmation(item, now):
    """예약된 물품 태깅: 예약자가 '수령하기'를 눌렀다면 본인 확인 대기 레코드를 만든다."""
    reservation = (
        Reservation.query
        .filter_by(item_id=item.id, status="pending")
        .order_by(Reservation.reserved_at.desc())
        .first()
    )
    if reservation is None:
        return device_response("ERROR", "유효한 예약을 찾을 수 없습니다.", 409, "RESERVATION_NOT_FOUND")

    if reservation.pickup_requested_at is None:
        return device_response(
            "ERROR", "예약자가 아직 '수령하기'를 누르지 않았습니다.", 409, "PICKUP_NOT_REQUESTED"
        )

    # 같은 태그를 연달아 읽어도 대기 레코드가 중복 생성되지 않도록, 유효한 대기가 있으면 그대로 사용
    waiting = PendingConfirmation.query.filter(
        PendingConfirmation.reservation_id == reservation.id,
        PendingConfirmation.status == "waiting",
        PendingConfirmation.expires_at > now,
    ).first()

    if waiting is None:
        waiting = PendingConfirmation(
            item_id=item.id,
            reservation_id=reservation.id,
            student_id=reservation.student_id,
            scanned_at=now,
            expires_at=now + timedelta(seconds=current_app.config["CONFIRMATION_TIMEOUT_SECONDS"]),
            status="waiting",
        )
        db.session.add(waiting)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return device_response("ERROR", "본인 확인 요청 생성 중 충돌이 발생했습니다.", 409, "CONFIRMATION_CONFLICT")

    return device_response("WAIT_CONFIRM", f"'{item.name}' 예약자 본인 확인 대기 중", 200)


def _return_item(item, now):
    """대여중 물품 태깅: 반납 처리."""
    rental = (
        Rental.query
        .filter(Rental.item_id == item.id, Rental.status.in_(["renting", "overdue"]))
        .order_by(Rental.rent_date.desc())
        .first()
    )
    if rental is None:
        return device_response("ERROR", "진행 중인 대여 기록을 찾을 수 없습니다.", 409, "RENTAL_NOT_FOUND")

    # 동시에 두 번 태깅돼도 한 번만 반납되도록 조건부 UPDATE
    result = db.session.execute(
        update(Item).where(Item.id == item.id, Item.status == "rented").values(status="available")
    )
    if result.rowcount != 1:
        db.session.rollback()
        return device_response("ERROR", "물품 상태가 변경되었습니다.", 409, "ITEM_STATUS_CONFLICT")

    rental.status = "returned"
    rental.return_date = now

    # 더 이상 연체 중인 대여가 없으면 사용자의 연체 표시를 해제
    still_overdue = Rental.query.filter(
        Rental.student_id == rental.student_id,
        Rental.status == "overdue",
        Rental.id != rental.id,
    ).first()
    if still_overdue is None:
        user = db.session.get(User, rental.student_id)
        if user is not None:
            user.is_overdue = False

    db.session.commit()
    return device_response("RETURN_OK", f"'{item.name}' 반납 완료", 200)

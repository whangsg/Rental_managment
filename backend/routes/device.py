"""ESP32 RFID 장치 연동 API."""
from datetime import datetime, timedelta
import re

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from auth_utils import device_key_required
from extensions import db
from models import Item, Reservation, PendingConfirmation, Rental, User
from reservation_tasks import expire_reservations, expire_pending_confirmations

bp = Blueprint("device", __name__, url_prefix="/api/device")


def device_response(result, message, status=200, **extra):
    """ESP32 펌웨어가 읽는 최상위 result/message 응답 형식."""
    return jsonify(result=result, message=message, **extra), status


def get_uid():
    """요청 JSON에서 RFID UID를 읽고 대문자로 정규화한다."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None

    uid = body.get("uid")
    if not isinstance(uid, str):
        return None

    uid = uid.strip().upper()

    if not re.fullmatch(r"[0-9A-F]+", uid):
        return None

    return uid


def update_user_overdue(student_id, now):
    """해당 사용자의 남은 연체 대여를 기준으로 연체 여부를 다시 계산한다."""
    user = db.session.get(User, student_id)
    if user is None:
        return

    user.is_overdue = (
        Rental.query.filter(
            Rental.student_id == student_id,
            or_(
                Rental.status == "overdue",
                (
                    (Rental.status == "renting")
                    & (Rental.due_date < now)
                ),
            ),
        ).first()
        is not None
    )


def return_item_by_uid(item, now):
    """RFID UID에 해당하는 대여를 반납 처리한다."""
    rental = (
        Rental.query
        .filter(
            Rental.item_id == item.id,
            Rental.status.in_(("renting", "overdue")),
        )
        .order_by(Rental.rent_date.desc())
        .first()
    )

    if rental is None:
        return device_response(
            "ERROR", "대여 중인 기록을 찾을 수 없습니다.", 409
        )

    # 스케줄러가 아직 실행되지 않았더라도 실제 기한을 기준으로 연체 여부를 반영한다.
    was_overdue = rental.status == "overdue" or rental.due_date < now

    rental.status = "returned"
    rental.return_date = now
    item.status = "available"

    # 반납한 대여 외에 남아 있는 연체 대여가 있는지 매번 다시 계산한다.
    update_user_overdue(rental.student_id, now)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return device_response("ERROR", "반납 처리 중 데이터 충돌이 발생했습니다.", 409)

    return device_response(
        "RETURN_OK",
        "반납이 완료되었습니다.",
        item={
            "id": item.id,
            "name": item.name,
            "status": item.status,
        },
        rental={
            "id": rental.id,
            "student_id": rental.student_id,
            "status": rental.status,
            "return_date": rental.return_date.isoformat(),
            "was_overdue": was_overdue,
        },
    )


@bp.post("/tag")
@device_key_required
def scan_tag():
    """ESP32가 읽은 RFID UID를 처리한다.

    - rented 물품: 반납 처리
    - reserved 물품: 예약자의 pickup-request 이후 태깅된 경우 본인 확인 생성
    - 그 외: 처리 거부
    """
    uid = get_uid()
    if uid is None:
        return device_response("ERROR", "올바른 RFID UID가 필요합니다.", 400)

    now = datetime.utcnow()

    # 스케줄러가 실행되기 전이라도 태깅 시점에 만료된 예약/확인 요청을 정리한다.
    expire_reservations(now)
    expire_pending_confirmations(now)

    item = Item.query.filter_by(rfid_uid=uid).first()
    if item is None:
        return device_response("UNKNOWN_TAG", "등록되지 않은 RFID 태그입니다.", 404)

    # 대여 중이거나 연체 중인 물품이면 태그 하나로 반납 처리한다.
    if item.status == "rented":
        return return_item_by_uid(item, now)

    if item.status == "reserved":
        reservation = (
            Reservation.query
            .filter_by(item_id=item.id, status="pending")
            .first()
        )

        if reservation is None:
            return device_response(
                "ERROR", "유효한 예약 정보를 찾을 수 없습니다.", 409
            )

        # 웹에서 '수령하기'를 누르지 않은 예약은 태그만으로 대여할 수 없다.
        if reservation.pickup_requested_at is None:
            return device_response(
                "ERROR", "웹에서 먼저 수령하기를 눌러주세요.", 409
            )

        # 이미 유효한 확인 요청이 있다면 중복 생성하지 않는다.
        waiting_confirmation = PendingConfirmation.query.filter(
            PendingConfirmation.reservation_id == reservation.id,
            PendingConfirmation.status == "waiting",
            PendingConfirmation.expires_at > now,
        ).first()

        if waiting_confirmation is not None:
            return device_response(
                "WAIT_CONFIRM",
                "이미 본인 확인 요청이 진행 중입니다.",
                reservation_id=reservation.id,
                expires_at=waiting_confirmation.expires_at.isoformat(),
            )

        confirmation = PendingConfirmation(
            item_id=item.id,
            reservation_id=reservation.id,
            student_id=reservation.student_id,
            scanned_at=now,
            expires_at=now + timedelta(
                seconds=current_app.config["CONFIRMATION_TIMEOUT_SECONDS"]
            ),
            status="waiting",
        )

        db.session.add(confirmation)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return device_response(
                "ERROR", "본인 확인 요청 생성 중 충돌이 발생했습니다.", 409
            )

        return device_response(
            "WAIT_CONFIRM",
            "RFID 인식 완료. 웹에서 본인 확인을 진행해주세요.",
            reservation_id=reservation.id,
            confirmation_id=confirmation.id,
            expires_at=confirmation.expires_at.isoformat(),
        )

    # available 상태는 예약 없이 태깅한 경우이므로 대여를 시작하지 않는다.
    if item.status == "available":
        return device_response(
            "ERROR", "예약된 물품이 아닙니다. 먼저 물품을 예약해주세요.", 409
        )

    return device_response("ERROR", "처리할 수 없는 물품 상태입니다.", 409)


@bp.post("/return")
@device_key_required
def return_item():
    """필요한 경우 UID를 지정해 반납만 수행하는 장치 전용 API.

    일반 ESP32 펌웨어는 /tag 하나만 호출해도 상태에 따라 자동 반납된다.
    """
    uid = get_uid()
    if uid is None:
        return device_response("ERROR", "올바른 RFID UID가 필요합니다.", 400)

    now = datetime.utcnow()
    item = Item.query.filter_by(rfid_uid=uid).first()

    if item is None:
        return device_response("UNKNOWN_TAG", "등록되지 않은 RFID 태그입니다.", 404)

    if item.status != "rented":
        return device_response("ERROR", "현재 반납할 수 있는 물품이 아닙니다.", 409)

    return return_item_by_uid(item, now)

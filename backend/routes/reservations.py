"""예약 및 대여 관련 API."""
from datetime import datetime, timedelta

from flask import Blueprint, request, current_app
from flask_login import current_user, login_required
from sqlalchemy import update, or_
from sqlalchemy.exc import IntegrityError

from auth_utils import success, failure
from extensions import db
from models import Item, Reservation, PendingConfirmation, Rental
from reservation_tasks import expire_reservations, expire_pending_confirmations

bp = Blueprint("reservations", __name__, url_prefix="/api")


def get_json_body():
    """요청 본문에서 JSON 데이터 가져오기."""
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


@bp.post("/reservations")
@login_required
def create_reservation():
    """물품 예약 신청."""
    body = get_json_body()

    if body is None:
        return failure("INVALID_JSON", "JSON 형식의 요청 본문이 필요합니다.", 400)

    item_id = body.get("item_id")
    desired_loan_days = body.get("desired_loan_days")

    if isinstance(item_id, bool) or not isinstance(item_id, int):
        return failure("INVALID_ITEM_ID", "올바른 물품 ID가 필요합니다.", 400)

    now = datetime.utcnow()

    overdue_rental = Rental.query.filter(
        Rental.student_id == current_user.student_id,
        or_(
            Rental.status == "overdue",
            (
                (Rental.status == "renting")
                & (Rental.due_date < now)
            ),
        ),
    ).first()

    if overdue_rental is not None:
        return failure("USER_OVERDUE", "연체 중인 사용자는 예약할 수 없습니다.", 403)

    item = db.session.get(Item, item_id)

    if item is None:
        return failure("ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.", 404)

    if desired_loan_days is None:
        desired_loan_days = item.default_loan_days

    if (
        isinstance(desired_loan_days, bool)
        or not isinstance(desired_loan_days, int)
        or desired_loan_days < 1
    ):
        return failure(
            "INVALID_LOAN_DAYS",
            "대여 일수는 1 이상의 정수여야 합니다.",
            400,
        )

    # 동시에 여러 사용자가 예약해도 한 명만 성공하도록 조건부 UPDATE
    result = db.session.execute(
        update(Item)
        .where(
            Item.id == item_id,
            Item.status == "available",
        )
        .values(status="reserved")
    )

    if result.rowcount != 1:
        db.session.rollback()
        return failure("ITEM_UNAVAILABLE", "현재 예약할 수 없는 물품입니다.", 409)

    reservation = Reservation(
        item_id=item_id,
        student_id=current_user.student_id,
        reserved_at=now,
        pickup_deadline=now + timedelta(
            hours=current_app.config["PICKUP_DEADLINE_HOURS"]
        ),
        desired_loan_days=desired_loan_days,
        status="pending",
    )

    db.session.add(reservation)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return failure("RESERVATION_CONFLICT", "이미 예약된 물품입니다.", 409)

    return success(reservation.to_dict(), 201)


@bp.get("/reservations/me")
@login_required
def my_reservations():
    """내 예약 및 대여 내역 조회."""
    now = datetime.utcnow()

    # 스케줄러 실행 전이라도 조회 시점에 만료된 예약을 처리
    expire_reservations(now, current_user.student_id)
    expire_pending_confirmations(now, current_user.student_id)

    reservations = (
        Reservation.query
        .filter_by(student_id=current_user.student_id)
        .order_by(Reservation.reserved_at.desc())
        .all()
    )

    rentals = (
        Rental.query
        .filter_by(student_id=current_user.student_id)
        .order_by(Rental.rent_date.desc())
        .all()
    )

    return success({
        "reservations": [reservation.to_dict() for reservation in reservations],
        "rentals": [rental.to_dict() for rental in rentals],
    })


@bp.post("/reservations/<int:reservation_id>/cancel")
@login_required
def cancel_reservation(reservation_id):
    """예약 취소."""
    now = datetime.utcnow()

    expire_reservations(now, current_user.student_id)

    reservation = db.session.get(Reservation, reservation_id)

    if reservation is None:
        return failure("RESERVATION_NOT_FOUND", "예약을 찾을 수 없습니다.", 404)

    if reservation.student_id != current_user.student_id:
        return failure("FORBIDDEN", "본인의 예약만 취소할 수 있습니다.", 403)

    if reservation.status == "expired":
        return failure("RESERVATION_EXPIRED", "이미 만료된 예약입니다.", 409)

    if reservation.status != "pending":
        return failure("INVALID_RESERVATION_STATUS", "취소할 수 없는 예약입니다.", 409)

    reservation.status = "cancelled"

    item = db.session.get(Item, reservation.item_id)
    if item is not None and item.status == "reserved":
        item.status = "available"

    PendingConfirmation.query.filter_by(
        reservation_id=reservation.id,
        status="waiting",
    ).update(
        {"status": "expired"},
        synchronize_session=False,
    )

    reservation.pickup_requested_at = None
    db.session.commit()

    return success({
        "message": "예약이 취소되었습니다.",
        "reservation": reservation.to_dict(),
    })


@bp.post("/reservations/<int:reservation_id>/pickup-request")
@login_required
def pickup_request(reservation_id):
    """사용자가 수령하기 버튼을 눌러 RFID 태깅을 요청한다."""
    now = datetime.utcnow()

    expire_reservations(now, current_user.student_id)
    expire_pending_confirmations(now, current_user.student_id)

    reservation = db.session.get(Reservation, reservation_id)

    if reservation is None:
        return failure("RESERVATION_NOT_FOUND", "예약을 찾을 수 없습니다.", 404)

    if reservation.student_id != current_user.student_id:
        return failure("FORBIDDEN", "본인의 예약만 수령할 수 있습니다.", 403)

    if reservation.status != "pending":
        return failure("INVALID_RESERVATION_STATUS", "수령할 수 없는 예약입니다.", 409)

    # 이미 유효한 본인 확인 요청이 있다면 중복 요청 방지
    waiting_confirmation = PendingConfirmation.query.filter(
        PendingConfirmation.reservation_id == reservation.id,
        PendingConfirmation.status == "waiting",
        PendingConfirmation.expires_at > now,
    ).first()

    if waiting_confirmation is not None:
        return failure("CONFIRMATION_IN_PROGRESS", "이미 본인 확인이 진행 중입니다.", 409)

    reservation.pickup_requested_at = now
    db.session.commit()

    return success({
        "message": "RFID 태깅을 기다리는 중입니다.",
        "reservation_id": reservation.id,
        "pickup_requested_at": now.isoformat(),
    })


@bp.get("/me/pending-confirm")
@login_required
def pending_confirm():
    """RFID 태깅 후 본인 확인이 필요한 요청 조회."""
    now = datetime.utcnow()

    expire_reservations(now, current_user.student_id)
    expire_pending_confirmations(now, current_user.student_id)

    confirmation = (
        PendingConfirmation.query
        .filter_by(
            student_id=current_user.student_id,
            status="waiting",
        )
        .order_by(PendingConfirmation.scanned_at.desc())
        .first()
    )

    return success({
        "pending_confirmation": (
            confirmation.to_dict() if confirmation else None
        )
    })


@bp.post("/reservations/<int:reservation_id>/confirm")
@login_required
def confirm_reservation(reservation_id):
    """본인 확인 결과 처리. confirmed=True이면 대여를 시작한다."""
    body = get_json_body()

    if body is None or not isinstance(body.get("confirmed"), bool):
        return failure(
            "INVALID_CONFIRMATION",
            "confirmed 값은 true 또는 false여야 합니다.",
            400,
        )

    now = datetime.utcnow()

    expire_reservations(now, current_user.student_id)
    expire_pending_confirmations(now, current_user.student_id)

    reservation = db.session.get(Reservation, reservation_id)

    if reservation is None:
        return failure("RESERVATION_NOT_FOUND", "예약을 찾을 수 없습니다.", 404)

    if reservation.student_id != current_user.student_id:
        return failure("FORBIDDEN", "본인의 예약만 확인할 수 있습니다.", 403)

    if reservation.status != "pending":
        return failure("INVALID_RESERVATION_STATUS", "처리할 수 없는 예약입니다.", 409)

    confirmation = (
        PendingConfirmation.query
        .filter_by(
            reservation_id=reservation.id,
            student_id=current_user.student_id,
            status="waiting",
        )
        .order_by(PendingConfirmation.scanned_at.desc())
        .first()
    )

    if confirmation is None:
        return failure(
            "CONFIRMATION_NOT_FOUND",
            "유효한 본인 확인 요청이 없습니다.",
            404,
        )

    if not body["confirmed"]:
        confirmation.status = "rejected"
        reservation.pickup_requested_at = None
        db.session.commit()

        return success({
            "message": "본인 확인이 거부되었습니다.",
            "reservation_status": reservation.status,
        })

    # 물품이 여전히 예약 상태인지 확인하고 대여 상태로 변경
    result = db.session.execute(
        update(Item)
        .where(
            Item.id == reservation.item_id,
            Item.status == "reserved",
        )
        .values(status="rented")
    )

    if result.rowcount != 1:
        db.session.rollback()
        return failure("ITEM_STATUS_CONFLICT", "물품 상태가 변경되었습니다.", 409)

    reservation.status = "fulfilled"
    confirmation.status = "confirmed"
    reservation.pickup_requested_at = None

    rental = Rental(
        reservation_id=reservation.id,
        item_id=reservation.item_id,
        student_id=current_user.student_id,
        rent_date=now,
        due_date=now + timedelta(days=reservation.desired_loan_days),
        status="renting",
    )

    db.session.add(rental)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return failure("RENTAL_CONFLICT", "대여 처리 중 충돌이 발생했습니다.", 409)

    return success({
        "message": "대여가 완료되었습니다.",
        "reservation": reservation.to_dict(),
        "rental": rental.to_dict(),
    }, 201)

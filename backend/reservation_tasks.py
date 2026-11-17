"""예약 및 본인 확인 만료 처리."""
from datetime import datetime

from extensions import db
from models import (
    Item,
    Reservation,
    PendingConfirmation,
    Notification,
)


def expire_reservations(now=None, student_id=None):
    """픽업 기한이 지난 pending 예약을 만료 처리한다."""
    now = now or datetime.utcnow()

    query = Reservation.query.filter(
        Reservation.status == "pending",
        Reservation.pickup_deadline <= now,
    )

    if student_id is not None:
        query = query.filter(Reservation.student_id == student_id)

    reservations = query.all()

    for reservation in reservations:
        reservation.status = "expired"

        item = db.session.get(Item, reservation.item_id)

        # 다른 작업으로 이미 상태가 변경된 경우 덮어쓰지 않는다.
        if item is not None and item.status == "reserved":
            item.status = "available"

        # 해당 예약의 본인 확인 대기도 함께 만료한다.
        confirmations = PendingConfirmation.query.filter_by(
            reservation_id=reservation.id,
            status="waiting",
        ).all()

        for confirmation in confirmations:
            confirmation.status = "expired"

        db.session.add(
            Notification(
                student_id=reservation.student_id,
                type="reservation_expired",
                message=f"예약한 물품({item.name if item else reservation.item_id})의 픽업 기한이 지나 예약이 자동 취소되었습니다.",
            )
        )

    db.session.commit()
    return len(reservations)


def expire_pending_confirmations(now=None, student_id=None):
    """응답 제한시간이 지난 본인 확인 요청을 만료 처리한다."""
    now = now or datetime.utcnow()

    query = PendingConfirmation.query.filter(
        PendingConfirmation.status == "waiting",
        PendingConfirmation.expires_at <= now,
    )

    if student_id is not None:
        query = query.filter(
            PendingConfirmation.student_id == student_id
        )

    confirmations = query.all()

    for confirmation in confirmations:
        confirmation.status = "expired"

        reservation = db.session.get(
            Reservation,
            confirmation.reservation_id,
        )

        if reservation is not None:
            # 같은 예약에 아직 유효한 확인 요청이 남아 있지 않을 때만 초기화
            another_waiting = PendingConfirmation.query.filter(
                PendingConfirmation.reservation_id == reservation.id,
                PendingConfirmation.status == "waiting",
                PendingConfirmation.expires_at > now,
            ).first()

            if another_waiting is None:
                reservation.pickup_requested_at = None

    db.session.commit()
    return len(confirmations)

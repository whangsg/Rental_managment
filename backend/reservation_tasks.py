"""예약 및 본인 확인 만료 처리."""
from datetime import datetime
from email.message import EmailMessage
import smtplib
import ssl

from flask import current_app

from extensions import db
from models import (
    Item,
    Reservation,
    PendingConfirmation,
    Notification,
    Rental,
    User,
    OverdueNotification,
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


def update_overdue_status(now=None):
    """연체 상태 갱신 및 신규 연체 알림을 생성한다."""
    now = now or datetime.utcnow()

    # 아직 연체 상태가 아닌 대여 중 기한이 지난 건 조회
    overdue_rentals = Rental.query.filter(
        Rental.status == "renting",
        Rental.due_date < now,
    ).all()

    for rental in overdue_rentals:
        rental.status = "overdue"

        item = db.session.get(Item, rental.item_id)

        db.session.add(
            Notification(
                student_id=rental.student_id,
                rental_id=rental.id,
                item_id=rental.item_id,
                message=(
                    f"대여한 물품({item.name if item else rental.item_id})의 "
                    "반납 기한이 지났습니다. "
                    "빠른 시일 내에 반납해주세요."
                ),
            )
        )

    # 사용자별 실제 연체 상태 갱신
    users = User.query.all()

    for user in users:
        has_overdue = Rental.query.filter(
            Rental.student_id == user.student_id,
            Rental.status == "overdue",
        ).first() is not None

        user.is_overdue = has_overdue

    db.session.commit()

    return len(overdue_rentals)


def send_overdue_emails():
    """이메일이 아직 발송되지 않은 연체 대여 건을 발송한다."""

    smtp_username = current_app.config.get("MAIL_USERNAME")
    smtp_password = current_app.config.get("MAIL_PASSWORD")
    sender = current_app.config.get("MAIL_DEFAULT_SENDER")

    # SMTP 설정이 없으면 이메일 발송을 건너뛴다.
    if not smtp_username or not smtp_password or not sender:
        current_app.logger.warning(
            "SMTP 설정이 없어 연체 이메일 발송을 건너뜁니다."
        )
        return 0

    # 연체 상태이면서 이메일 발송 기록이 없는 대여
    rentals = (
        Rental.query
        .outerjoin(
            OverdueNotification,
            OverdueNotification.rental_id == Rental.id,
        )
        .filter(
            Rental.status == "overdue",
            OverdueNotification.id.is_(None),
        )
        .all()
    )

    sent_count = 0

    for rental in rentals:
        user = db.session.get(User, rental.student_id)
        item = db.session.get(Item, rental.item_id)

        if user is None or not user.email:
            continue

        message = EmailMessage()
        message["Subject"] = "[물품 대여 서비스] 반납 기한 초과 안내"
        message["From"] = sender
        message["To"] = user.email

        message.set_content(
            f"안녕하세요, {user.name}님.\n\n"
            "대여하신 물품의 반납 기한이 지났습니다.\n\n"
            f"물품명: {item.name if item else rental.item_id}\n"
            f"대여일: {rental.rent_date.strftime('%Y-%m-%d')}\n"
            f"반납 기한: {rental.due_date.strftime('%Y-%m-%d')}\n\n"
            "빠른 시일 내에 물품을 반납해주시기 바랍니다.\n\n"
            "감사합니다.\n"
            "물품 대여 서비스\n"
        )

        try:
            smtp_server = current_app.config["MAIL_SERVER"]
            smtp_port = current_app.config["MAIL_PORT"]
            use_tls = current_app.config["MAIL_USE_TLS"]

            context = ssl.create_default_context()

            with smtplib.SMTP(
                smtp_server,
                smtp_port,
                timeout=15,
            ) as server:

                server.ehlo()

                if use_tls:
                    server.starttls(context=context)
                    server.ehlo()

                server.login(smtp_username, smtp_password)
                server.send_message(message)

            # 발송 성공한 경우에만 기록
            db.session.add(
                OverdueNotification(
                    rental_id=rental.id,
                    channel="email",
                )
            )

            db.session.commit()
            sent_count += 1

            current_app.logger.info(
                "연체 이메일 발송 완료: rental_id=%s",
                rental.id,
            )

        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                "연체 이메일 발송 실패: rental_id=%s",
                rental.id,
            )

    return sent_count

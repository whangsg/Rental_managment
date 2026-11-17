"""APScheduler 작업 등록."""
from extensions import db, scheduler
from reservation_tasks import (
    expire_reservations,
    expire_pending_confirmations,
)


def start_scheduler(app):
    """Flask 애플리케이션에 예약 관련 주기 작업을 등록한다."""

    def run_expire_reservations():
        with app.app_context():
            try:
                count = expire_reservations()
                if count:
                    app.logger.info(
                        "%s개의 예약이 만료 처리되었습니다.", count
                    )
            except Exception:
                db.session.rollback()
                app.logger.exception("예약 만료 작업 실패")

    def run_expire_confirmations():
        with app.app_context():
            try:
                count = expire_pending_confirmations()
                if count:
                    app.logger.info(
                        "%s개의 본인 확인 요청이 만료 처리되었습니다.",
                        count,
                    )
            except Exception:
                db.session.rollback()
                app.logger.exception("본인 확인 만료 작업 실패")

    scheduler.add_job(
        func=run_expire_reservations,
        trigger="interval",
        seconds=app.config["RESERVATION_EXPIRY_INTERVAL_SECONDS"],
        id="expire_reservations",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.add_job(
        func=run_expire_confirmations,
        trigger="interval",
        seconds=app.config["CONFIRMATION_EXPIRY_INTERVAL_SECONDS"],
        id="expire_confirmations",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    if not scheduler.running:
        scheduler.start()

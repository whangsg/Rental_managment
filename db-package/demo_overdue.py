"""
발표용: 라이브 연체 시연을 다시 '장전'한다. (DB 를 새로 만들지 않고 한 건만 되돌림)

    python demo_overdue.py        # 지금부터 3분 뒤 연체
    python demo_overdue.py 1      # 지금부터 1분 뒤 연체

하는 일 (황상건의 '농구공' 대여 한 건만 건드림)
  - 대여 상태를 renting 으로 되돌리고 반납 기한을 지금부터 N분 뒤로 맞춤
  - 그 대여의 연체 메일 발송 기록과 연체 알림을 지움 -> 다시 연체되는 순간 메일이 새로 발송됨
서버가 켜져 있어도 됩니다. 기한이 지난 뒤 스케줄러가 돌면(최대 OVERDUE_CHECK_INTERVAL_SECONDS 초) 연체로 바뀝니다.

⚠ seed.py 처럼 backend/ 폴더로 복사해서 실행하세요. (db-package/ 의 파일이 원본)
"""
import sys
from datetime import datetime, timedelta

from app import create_app
from extensions import db
from models import Item, Notification, OverdueNotification, Rental, User

STUDENT_ID = "22011716"   # 황상건
ITEM_NAME = "농구공"


def arm(minutes):
    app = create_app(start_scheduler=False)
    with app.app_context():
        item = Item.query.filter_by(name=ITEM_NAME).first()
        rental = (Rental.query.filter_by(item_id=item.id, student_id=STUDENT_ID)
                  .filter(Rental.status.in_(["renting", "overdue"])).first()) if item else None
        if rental is None:
            raise SystemExit(f"'{ITEM_NAME}' 대여중/연체 건을 찾을 수 없습니다. seed.py 로 만든 DB 인지 확인하세요.")

        now = datetime.utcnow()
        rental.status = "renting"
        rental.due_date = now + timedelta(minutes=minutes)
        rental.rent_date = rental.due_date - timedelta(days=item.default_loan_days)
        rental.return_date = None
        item.status = "rented"

        OverdueNotification.query.filter_by(rental_id=rental.id).delete()
        Notification.query.filter(Notification.type == "overdue",
                                  Notification.message.contains(f"({ITEM_NAME})")).delete(synchronize_session=False)

        # 황상건의 연체 여부는 남은 연체 대여가 있는지로 다시 계산
        user = db.session.get(User, STUDENT_ID)
        user.is_overdue = Rental.query.filter_by(student_id=STUDENT_ID, status="overdue").first() is not None
        db.session.commit()
        print(f"장전 완료: '{ITEM_NAME}' 대여가 약 {minutes}분 뒤 연체됩니다. (반납 기한 {rental.due_date:%Y-%m-%d %H:%M:%S} UTC)")


if __name__ == "__main__":
    arm(float(sys.argv[1]) if len(sys.argv) > 1 else 3)

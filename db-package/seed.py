"""
초기 데이터 시드 스크립트.

    python seed.py

- 관리자 계정 1개, 일반 사용자 2개
- 샘플 물품 9개 (RFID 실물 태그 9개가 모두 매핑됨, 상태: available/reserved/rented 가 섞여 있음) (일부는 RFID UID 미리 매핑되어 있음 -> 하드웨어 없이도 흐름 테스트 가능)
- 샘플 알림 2개 (황상건: 연체 1건 안읽음, 예약 자동취소 1건 읽음)

⚠ RFID UID는 실제 태그의 값으로 바꾸거나, 관리자 화면의 "태그 등록" 기능으로 다시 매핑하세요.
"""
from app import create_app
from extensions import db
from datetime import datetime, timedelta

from models import User, Item, Notification, Reservation, Rental, OverdueNotification


def seed():
    app = create_app(start_scheduler=False)
    with app.app_context():
        if User.query.first():
            print("이미 데이터가 있습니다. 시드를 건너뜁니다.")
            return

        admin = User(student_id="00000000", name="관리자", email="admin@example.com", role="admin")
        admin.set_password("admin1234")

        u1 = User(student_id="22011716", name="황상건", email="sgwhang@example.com", role="user")
        u1.set_password("test1234")
        u2 = User(student_id="24010213", name="남희성", email="namhs@example.com", role="user")
        u2.set_password("test1234")

        db.session.add_all([admin, u1, u2])

        items = [
            Item(name="드라이버 세트", category="공구", rfid_uid="AB3127CA", default_loan_days=14,
                 description="십자/일자 드라이버 8종"),
            Item(name="전동 드릴", category="공구", rfid_uid="75FD892A", default_loan_days=7,
                 description="Bosch 18V, 배터리 2개 포함"),
            Item(name="DSLR 카메라", category="전자기기", rfid_uid="D5AB892A", default_loan_days=3,
                 description="Canon EOS, 렌즈 킷"),
            Item(name="농구공", category="스포츠", rfid_uid="551A892A", default_loan_days=1),
            Item(name="보드게임 카탄", category="보드게임", rfid_uid="D5C9882A", default_loan_days=14),
            Item(name="멀티미터", category="실습장비", rfid_uid="0536882A", default_loan_days=14),
            # 태그 7~9: 남는 실물 태그용 테스트 물품 (이름은 나중에 바꿔도 됨)
            Item(name="테스트 물품 7", category="테스트", rfid_uid="C9742A20", default_loan_days=14,
                 description="RFID 테스트용"),
            Item(name="테스트 물품 8", category="테스트", rfid_uid="C9A80A20", default_loan_days=14,
                 description="RFID 테스트용"),
            Item(name="테스트 물품 9", category="테스트", rfid_uid="3B32FACB", default_loan_days=14,
                 description="RFID 테스트용"),
        ]
        db.session.add_all(items)
        db.session.flush()   # items 의 id 확정 (아래 예약/대여가 참조)

        # ---- 물품 상태별 샘플 데이터 (RFID 태깅 테스트용) -----------------------------------
        #  available : 드라이버 세트, 멀티미터(반납 이력), 테스트 물품 8·9
        #  reserved  : 전동 드릴(수령하기 누름), DSLR 카메라(수령하기 전)
        #  rented    : 농구공(대여중), 보드게임 카탄(연체), 테스트 물품 7(대여중)
        # 예약/대여 레코드도 함께 만들어 items.status 와 앞뒤가 맞게 한다.
        now = datetime.utcnow()
        by_name = {i.name: i for i in items}
        HWANG, NAM = "22011716", "24010213"

        def reservation(item, student, status, reserved_ago, desired=14, pickup_requested=None):
            reserved_at = now - reserved_ago
            return Reservation(item_id=item.id, student_id=student, reserved_at=reserved_at,
                               pickup_deadline=reserved_at + timedelta(hours=24),
                               desired_loan_days=desired, status=status,
                               pickup_requested_at=pickup_requested)

        # 예약됨 (pending 은 물품당 1건만 허용 - 부분 UNIQUE 인덱스)
        by_name["전동 드릴"].status = "reserved"
        by_name["DSLR 카메라"].status = "reserved"
        res_pending = [
            reservation(by_name["전동 드릴"], HWANG, "pending", timedelta(hours=2), 7,
                        pickup_requested=now - timedelta(minutes=10)),
            reservation(by_name["DSLR 카메라"], NAM, "pending", timedelta(hours=1), 3),
        ]
        # 과거 이력 (자동취소된 예약: 아래 알림 '예약 자동 취소' 와 대응)
        res_history = [reservation(by_name["DSLR 카메라"], HWANG, "expired", timedelta(days=5), 3)]

        # 대여 / 연체 / 반납 이력: (물품, 사용자, 대여 시작 전 경과, 대여일수, 대여 상태, 물품 상태)
        rental_specs = [
            ("농구공",        HWANG, timedelta(days=2),  7,  "renting",  "rented"),
            ("보드게임 카탄", NAM,   timedelta(days=20), 14, "overdue",  "rented"),
            ("테스트 물품 7", HWANG, timedelta(days=1),  14, "renting",  "rented"),
            ("멀티미터",      NAM,   timedelta(days=30), 14, "returned", "available"),
        ]
        res_fulfilled = []
        for name, student, ago, days, rstatus, istatus in rental_specs:
            res_fulfilled.append(reservation(by_name[name], student, "fulfilled", ago + timedelta(hours=1), days))
            by_name[name].status = istatus

        db.session.add_all(res_pending + res_history + res_fulfilled)
        db.session.flush()   # reservation id 확정

        rentals = []
        for (name, student, ago, days, rstatus, istatus), res in zip(rental_specs, res_fulfilled):
            rent_date = now - ago
            rentals.append(Rental(reservation_id=res.id, item_id=by_name[name].id, student_id=student,
                                  rent_date=rent_date, due_date=rent_date + timedelta(days=days),
                                  return_date=(rent_date + timedelta(days=days - 2)) if rstatus == "returned" else None,
                                  status=rstatus))
        db.session.add_all(rentals)
        db.session.flush()
        overdue = next(r for r in rentals if r.status == "overdue")
        db.session.add(OverdueNotification(rental_id=overdue.id, sent_at=now - timedelta(days=1), channel="email"))

        db.session.add_all([
            Notification(student_id="22011716", type="overdue",
                         message="'전동 드릴' 반납 기한이 지났습니다. 빠른 반납 부탁드립니다."),
            Notification(student_id="22011716", type="reservation_expired",
                         message="'DSLR 카메라' 예약이 픽업 기한 초과로 자동 취소되었습니다.", is_read=True),
        ])
        db.session.commit()

        print("시드 완료.")
        print("  관리자: admin@example.com / admin1234")
        print("  사용자: sgwhang@example.com / test1234")
        print("  사용자: namhs@example.com / test1234")


if __name__ == "__main__":
    seed()

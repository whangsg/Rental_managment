"""
초기 데이터 시드 스크립트.

    python seed.py

- 관리자 계정 1개, 일반 사용자 2개
- 샘플 물품 9개 (RFID 실물 태그 9개가 모두 매핑됨, 상태: available/reserved/rented 가 섞여 있음) (일부는 RFID UID 미리 매핑되어 있음 -> 하드웨어 없이도 흐름 테스트 가능)
- 샘플 알림 (남희성: 연체 알림, 관리자: 연체 알림, 황상건: 예약 자동취소 1건 읽음)

발표 시연용 시나리오 (DB 파일 하나로 두 가지를 모두 보여줌)
  A. 이미 연체: 남희성의 '보드게임 카탄' (overdue) -> 남희성은 새 예약이 막힘 (403 USER_OVERDUE)
  B. 라이브 연체: 황상건의 '농구공' (renting, 반납 기한이 시드 후 LIVE_DEMO_DUE_MINUTES 분 뒤)
     -> 기한이 지나면 스케줄러가 overdue 로 바꾸고 연체 메일을 새로 발송함 (최대 1분 안에)
     시연을 반복하거나 시드 후 시간이 지났으면 demo_overdue.py 로 다시 장전

⚠ RFID UID는 실제 태그의 값으로 바꾸거나, 관리자 화면의 "태그 등록" 기능으로 다시 매핑하세요.
"""
from app import create_app
from extensions import db
from datetime import datetime, timedelta

from models import User, Item, Notification, Reservation, Rental, OverdueNotification

# ===== 발표/시연 설정 =========================================================
# 연체 메일은 아래 이메일로 실제 발송됨. 발표 때 받은 메일을 보여줄 수 있는 주소로 바꿔서 사용
ADMIN_SEED_EMAIL = "admin@example.com"   # 관리자 로그인 이메일 (관리자 수신 메일은 .env 의 ADMIN_EMAIL)
HWANG_EMAIL = "sgwhang@gmail.com"        # 황상건: 라이브 연체 메일을 받을 주소
NAM_EMAIL = "namhs@example.com"          # 남희성: 이미 연체 상태인 계정 (예약 차단 시연용)
LIVE_DEMO_DUE_MINUTES = 3                # 라이브 연체: 시드 후 이 시간(분)이 지나면 '농구공' 대여가 연체로 바뀜


def seed():
    app = create_app(start_scheduler=False)
    with app.app_context():
        if User.query.first():
            print("이미 데이터가 있습니다. 시드를 건너뜁니다.")
            return

        admin = User(student_id="00000000", name="관리자", email=ADMIN_SEED_EMAIL, role="admin")
        admin.set_password("admin1234")

        u1 = User(student_id="22011716", name="황상건", email=HWANG_EMAIL, role="user")
        u1.set_password("test1234")
        u2 = User(student_id="24010213", name="남희성", email=NAM_EMAIL, role="user")
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

        # 시나리오 B (라이브 연체): 황상건의 '농구공'은 대여중이고 반납 기한이 곧 지남
        live = next(r for r in rentals if r.item_id == by_name["농구공"].id)
        live.due_date = now + timedelta(minutes=LIVE_DEMO_DUE_MINUTES)
        live.rent_date = live.due_date - timedelta(days=by_name["농구공"].default_loan_days)

        # 시나리오 A (이미 연체): 남희성은 연체 중. 메일은 이미 보냈다고 기록해서 다시 보내지 않음
        # (발송 코드가 중복 확인에 쓰는 채널명은 email_user / email_admin)
        overdue = next(r for r in rentals if r.status == "overdue")
        u2.is_overdue = True
        for channel in ("email_user", "email_admin"):
            db.session.add(OverdueNotification(rental_id=overdue.id, sent_at=now - timedelta(days=1), channel=channel))

        db.session.add_all([
            # 연체 알림 문구는 reservation_tasks.update_overdue_status 가 만드는 문구와 같게 맞춤
            # rental_id/item_id 는 어떤 대여/물품에 대한 알림인지 구조적으로 연결하기 위함
            Notification(student_id=NAM, rental_id=overdue.id, item_id=overdue.item_id, type="overdue",
                         message="대여한 물품(보드게임 카탄)의 반납 기한이 지났습니다. 빠른 시일 내에 반납해주세요."),
            Notification(student_id=admin.student_id, rental_id=overdue.id, item_id=overdue.item_id, type="overdue",
                         message="남희성님이 대여한 물품(보드게임 카탄)이 연체되었습니다."),
            Notification(student_id=HWANG, item_id=by_name["DSLR 카메라"].id, type="reservation_expired",
                         message="'DSLR 카메라' 예약이 픽업 기한 초과로 자동 취소되었습니다.", is_read=True),
        ])
        db.session.commit()

        print("시드 완료.")
        print(f"  관리자: {ADMIN_SEED_EMAIL} / admin1234")
        print(f"  사용자: {HWANG_EMAIL} / test1234   (농구공 대여중, 약 {LIVE_DEMO_DUE_MINUTES}분 뒤 연체 -> 연체 메일 시연)")
        print(f"  사용자: {NAM_EMAIL} / test1234   (이미 연체 -> 새 예약 차단 시연)")


if __name__ == "__main__":
    seed()

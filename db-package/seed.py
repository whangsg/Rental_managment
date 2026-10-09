"""
초기 데이터 시드 스크립트.

    python seed.py

- 관리자 계정 1개, 일반 사용자 2개
- 샘플 물품 6개 (일부는 RFID UID 미리 매핑되어 있음 -> 하드웨어 없이도 흐름 테스트 가능)

⚠ RFID UID는 실제 태그의 값으로 바꾸거나, 관리자 화면의 "태그 등록" 기능으로 다시 매핑하세요.
"""
from app import create_app
from extensions import db
from models import User, Item


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
            Item(name="드라이버 세트", category="공구", rfid_uid="B4C2E1F0", default_loan_days=14,
                 description="십자/일자 드라이버 8종"),
            Item(name="전동 드릴", category="공구", rfid_uid="A1B2C3D4", default_loan_days=7,
                 description="Bosch 18V, 배터리 2개 포함"),
            Item(name="DSLR 카메라", category="전자기기", rfid_uid="04AA11BB22CC33", default_loan_days=3,
                 description="Canon EOS, 렌즈 킷"),
            Item(name="농구공", category="스포츠", rfid_uid=None, default_loan_days=1),
            Item(name="보드게임 카탄", category="보드게임", rfid_uid=None, default_loan_days=14),
            Item(name="멀티미터", category="실습장비", rfid_uid=None, default_loan_days=14),
        ]
        db.session.add_all(items)
        db.session.commit()

        print("시드 완료.")
        print("  관리자: admin@example.com / admin1234")
        print("  사용자: sgwhang@example.com / test1234")
        print("  사용자: namhs@example.com / test1234")


if __name__ == "__main__":
    seed()

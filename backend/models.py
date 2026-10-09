"""
SQLAlchemy 모델 정의 (SQLite 기준, 3NF로 정규화된 관계형 스키마).

상태값 정의
-----------
Item.status:
    available   보관중 / 대여 가능
    reserved    예약됨 (누군가 픽업 대기 중)
    rented      대여중

Reservation.status:
    pending     예약 신청됨, 아직 픽업(태깅) 전
    fulfilled   픽업 완료 -> Rental로 전환됨
    cancelled   사용자가 직접 취소
    expired     픽업 기한을 넘겨 시스템이 자동 취소

PendingConfirmation.status  (RFID 태깅 직후 "본인이 맞습니까?" 대기 상태)
    waiting     확인 대기 중 (React가 polling)
    confirmed   사용자가 "예" 선택 -> Rental 생성됨
    rejected    사용자가 "아니오" 선택
    expired     제한시간 안에 응답 없음 (Config.CONFIRMATION_TIMEOUT_SECONDS)

Rental.status:
    renting     대여중
    returned    반납완료
    overdue     반납기한 초과 (연체)

Notification.type:
    overdue              연체 알림
    reservation_expired  픽업 기한 초과로 예약 자동취소
"""
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db


class User(UserMixin, db.Model):
    """학번(student_id)을 기본키로 사용. 재학생 대상 서비스라 학번은 변하지 않는 식별자다.
    다른 테이블은 모두 student_id 로 이 테이블을 참조한다."""

    __tablename__ = "users"

    student_id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(10), nullable=False, default="user")  # "user" | "admin"
    is_overdue = db.Column(db.Boolean, nullable=False, default=False)  # 연체 여부 캐시 플래그
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship("Reservation", backref="user", lazy="dynamic")
    rentals = db.relationship("Rental", backref="user", lazy="dynamic")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic")

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    def get_id(self):
        # Flask-Login 이 세션에 저장할 식별자. 기본 구현은 self.id 를 찾으므로 학번으로 덮어씀.
        return self.student_id

    def to_dict(self):
        return {
            "student_id": self.student_id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_overdue": self.is_overdue,
        }


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, default="")
    rfid_uid = db.Column(db.String(32), unique=True, nullable=True, index=True)  # 태그 등록 전엔 NULL 가능
    status = db.Column(db.String(20), nullable=False, default="available")
    default_loan_days = db.Column(db.Integer, nullable=False, default=14)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship("Reservation", backref="item", lazy="dynamic")
    rentals = db.relationship("Rental", backref="item", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "rfid_uid": self.rfid_uid,
            "status": self.status,
            "default_loan_days": self.default_loan_days,
        }


class Reservation(db.Model):
    __tablename__ = "reservations"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    student_id = db.Column(db.String(20), db.ForeignKey("users.student_id"), nullable=False)
    reserved_at = db.Column(db.DateTime, default=datetime.utcnow)
    pickup_deadline = db.Column(db.DateTime, nullable=False)  # 이 시각까지 태깅 안 하면 자동 취소
    desired_loan_days = db.Column(db.Integer, nullable=False, default=14)
    status = db.Column(db.String(20), nullable=False, default="pending")
    # '수령하기' 버튼(POST /reservations/{id}/pickup-request)을 누른 시각. NULL = 아직 태깅 대기 시작 전
    pickup_requested_at = db.Column(db.DateTime, nullable=True)

    pending_confirmations = db.relationship("PendingConfirmation", backref="reservation", lazy="dynamic")
    rental = db.relationship("Rental", backref="reservation", uselist=False)

    __table_args__ = (
        # 부분 UNIQUE 인덱스: 한 물품에 'pending' 상태의 예약은 동시에 1건만 존재할 수 있다.
        # (취소/만료/완료된 과거 예약은 여러 건이어도 됨 -> status='pending' 행에만 적용)
        # 애플리케이션 로직이 뚫리더라도 DB 가 중복 예약을 물리적으로 거부하는 2중 안전장치.
        db.Index(
            "uq_one_pending_reservation_per_item",
            "item_id",
            unique=True,
            sqlite_where=db.text("status = 'pending'"),
            postgresql_where=db.text("status = 'pending'"),
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item.name if self.item else None,
            "student_id": self.student_id,
            "reserved_at": self.reserved_at.isoformat(),
            "pickup_deadline": self.pickup_deadline.isoformat(),
            "desired_loan_days": self.desired_loan_days,
            "pickup_requested_at": self.pickup_requested_at.isoformat() if self.pickup_requested_at else None,
            "status": self.status,
        }


class PendingConfirmation(db.Model):
    """RFID 태깅 직후 생성되는, 예약자 본인 확인 대기 레코드."""

    __tablename__ = "pending_confirmations"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    reservation_id = db.Column(db.Integer, db.ForeignKey("reservations.id"), nullable=False)
    student_id = db.Column(db.String(20), db.ForeignKey("users.student_id"), nullable=False)
    scanned_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="waiting")

    item = db.relationship("Item")

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item.name if self.item else None,
            "reservation_id": self.reservation_id,
            "scanned_at": self.scanned_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "status": self.status,
        }


class Rental(db.Model):
    __tablename__ = "rentals"

    id = db.Column(db.Integer, primary_key=True)
    # 모든 대여는 반드시 예약을 거친다 (NOT NULL). 예약 하나는 최대 하나의 대여로만 이어진다 (UNIQUE).
    reservation_id = db.Column(db.Integer, db.ForeignKey("reservations.id"), nullable=False, unique=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    student_id = db.Column(db.String(20), db.ForeignKey("users.student_id"), nullable=False)
    rent_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=False)
    return_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="renting")

    notifications = db.relationship("OverdueNotification", backref="rental", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item.name if self.item else None,
            "student_id": self.student_id,
            "rent_date": self.rent_date.isoformat(),
            "due_date": self.due_date.isoformat(),
            "return_date": self.return_date.isoformat() if self.return_date else None,
            "status": self.status,
        }


class OverdueNotification(db.Model):
    """연체 알림 발송 기록 (감사/로그용). 같은 연체 건에 중복 메일을 보내지 않기 위해서도 사용."""

    __tablename__ = "overdue_notifications"

    id = db.Column(db.Integer, primary_key=True)
    rental_id = db.Column(db.Integer, db.ForeignKey("rentals.id"), nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    channel = db.Column(db.String(20), default="email")


class Notification(db.Model):
    """사용자에게 보여주는 앱 내 알림 (GET /api/notifications/me, PATCH /api/notifications/{id}/read).
    OverdueNotification(메일 발송 기록)과는 별개."""

    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), db.ForeignKey("users.student_id"), nullable=False)
    type = db.Column(db.String(30), nullable=False)  # "overdue" | "reservation_expired"
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        # "내 알림 목록 / 안 읽은 알림" 조회용
        db.Index("ix_notifications_student_read", "student_id", "is_read"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "type": self.type,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }

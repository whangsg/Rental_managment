from flask import Blueprint
from flask_login import login_required

from auth_utils import not_implemented

bp = Blueprint("reservations", __name__, url_prefix="/api")


@bp.post("/reservations")
@login_required
def create_reservation():
    """예약 신청. 권한: 로그인"""
    return not_implemented()


@bp.get("/reservations/me")
@login_required
def my_reservations():
    """내 예약·대여 내역, 반납 기한. 권한: 로그인"""
    return not_implemented()


@bp.post("/reservations/<int:reservation_id>/cancel")
@login_required
def cancel_reservation(reservation_id):
    """예약 취소. 권한: 본인 (reservation.student_id == current_user.student_id)"""
    return not_implemented()


@bp.post("/reservations/<int:reservation_id>/pickup-request")
@login_required
def pickup_request(reservation_id):
    """'수령하기' 버튼 (태깅 대기 시작): reservation.pickup_requested_at 기록. 권한: 본인"""
    return not_implemented()


@bp.get("/me/pending-confirm")
@login_required
def pending_confirm():
    """폴링용. 확인 대기(PendingConfirmation waiting) 건이 있는지 조회. 권한: 로그인"""
    return not_implemented()


@bp.post("/reservations/<int:reservation_id>/confirm")
@login_required
def confirm_reservation(reservation_id):
    """본인 확인 '예/아니오' (예 -> Rental 생성, 아니오 -> rejected). 권한: 본인"""
    return not_implemented()

from flask import Blueprint
from flask_login import login_required

from auth_utils import not_implemented

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.get("/me")
@login_required
def my_notifications():
    """내 알림 (연체, 예약 자동취소). 권한: 로그인"""
    return not_implemented()


@bp.patch("/<int:notification_id>/read")
@login_required
def mark_read(notification_id):
    """읽음 처리: notification.is_read = True. 권한: 본인 (notification.student_id == current_user.student_id)"""
    return not_implemented()

"""사용자 알림 API."""
from flask import Blueprint
from flask_login import current_user, login_required

from auth_utils import success, failure
from extensions import db
from models import Notification

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.get("/me")
@login_required
def get_my_notifications():
    """로그인한 사용자의 알림 목록을 최신순으로 조회한다."""
    notifications = (
        Notification.query
        .filter_by(student_id=current_user.student_id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return success([n.to_dict() for n in notifications])


@bp.patch("/<int:notification_id>/read")
@login_required
def mark_notification_read(notification_id):
    """본인의 알림을 읽음 처리한다."""
    notification = db.session.get(Notification, notification_id)

    if notification is None:
        return failure(
            "NOTIFICATION_NOT_FOUND",
            "알림을 찾을 수 없습니다.",
            404,
        )

    if notification.student_id != current_user.student_id:
        return failure(
            "FORBIDDEN",
            "본인의 알림만 읽음 처리할 수 있습니다.",
            403,
        )

    notification.is_read = True
    db.session.commit()

    return success(notification.to_dict())

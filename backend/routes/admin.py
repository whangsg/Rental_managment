from flask import Blueprint

from auth_utils import admin_required, not_implemented

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.get("/dashboard")
@admin_required
def dashboard():
    """재고, 대여 중, 연체 통계. 권한: 관리자"""
    return not_implemented()


@bp.get("/reservations")
@admin_required
def list_reservations():
    """전체 예약·대여 현황. 쿼리: status. 권한: 관리자"""
    return not_implemented()


@bp.get("/overdue")
@admin_required
def list_overdue():
    """연체자 목록. 권한: 관리자"""
    return not_implemented()

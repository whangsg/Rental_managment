from flask import Blueprint
from flask_login import login_required

from auth_utils import admin_required, not_implemented

bp = Blueprint("items", __name__, url_prefix="/api/items")


@bp.get("")
@login_required
def list_items():
    """목록, 검색, 대여 가능 필터. 쿼리: category, q, available. 권한: 로그인"""
    return not_implemented()


@bp.get("/<int:item_id>")
@login_required
def get_item(item_id):
    """상세. 권한: 로그인"""
    return not_implemented()


@bp.post("")
@admin_required
def create_item():
    """물품 등록 (RFID 태그 ID 포함). 권한: 관리자"""
    return not_implemented()


@bp.put("/<int:item_id>")
@admin_required
def update_item(item_id):
    """물품 수정, 태그 재지정. 권한: 관리자"""
    return not_implemented()


@bp.delete("/<int:item_id>")
@admin_required
def delete_item(item_id):
    """물품 삭제. 권한: 관리자"""
    return not_implemented()

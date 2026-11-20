"""물품 관련 API."""
import re

from flask import Blueprint, request
from flask_login import login_required
from sqlalchemy.exc import IntegrityError

from auth_utils import admin_required, success, failure
from extensions import db
from models import Item

bp = Blueprint("items", __name__, url_prefix="/api/items")


def get_json_body():
    """요청 본문에서 JSON 데이터 가져오기."""
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


def validate_item_data(data, is_update=False):
    """물품 데이터 검증."""
    if data is None:
        return "올바른 JSON 데이터가 필요합니다."

    allowed_fields = {
        "name",
        "category",
        "description",
        "rfid_uid",
        "default_loan_days",
    }

    if set(data) - allowed_fields:
        return "허용되지 않는 필드가 포함되어 있습니다."

    if not is_update and not {"name", "category"}.issubset(data):
        return "물품명과 카테고리는 필수입니다."

    if is_update and not data:
        return "수정할 데이터가 없습니다."

    if "name" in data:
        if not isinstance(data["name"], str) or not data["name"].strip():
            return "물품명은 필수입니다."
        if len(data["name"].strip()) > 100:
            return "물품명은 100자 이하여야 합니다."

    if "category" in data:
        if not isinstance(data["category"], str) or not data["category"].strip():
            return "카테고리는 필수입니다."
        if len(data["category"].strip()) > 50:
            return "카테고리는 50자 이하여야 합니다."

    if "description" in data:
        if data["description"] is not None and not isinstance(data["description"], str):
            return "설명은 문자열이어야 합니다."

    if "rfid_uid" in data:
        uid = data["rfid_uid"]
        if uid is not None and not isinstance(uid, str):
            return "RFID UID는 문자열이어야 합니다."
        if isinstance(uid, str):
            uid = uid.strip().upper()
            if uid and not re.fullmatch(r"[0-9A-F]+", uid):
                return "RFID UID는 16진수 문자(A~F, 0~9)만 사용할 수 있으며, 공백이나 특수문자는 입력할 수 없습니다."
            if len(uid) > 32:
                return "RFID UID는 32자 이하여야 합니다."

    if "default_loan_days" in data:
        days = data["default_loan_days"]
        if isinstance(days, bool) or not isinstance(days, int) or days < 1:
            return "기본 대여 일수는 1 이상의 정수여야 합니다."

    return None


@bp.get("")
@login_required
def list_items():
    """목록, 검색, 대여 가능 필터. 쿼리: category, q, available."""
    query = Item.query

    category = request.args.get("category", "").strip()
    keyword = request.args.get("q", "").strip()
    available = request.args.get("available")

    if category:
        query = query.filter(Item.category == category)

    if keyword:
        query = query.filter(Item.name.ilike(f"%{keyword}%"))

    if available is not None:
        if available.lower() not in ("true", "false"):
            return failure(
                "INVALID_PARAMETER",
                "available은 true 또는 false여야 합니다.",
                400
            )

        if available.lower() == "true":
            query = query.filter(Item.status == "available")
        else:
            query = query.filter(Item.status != "available")

    items = query.order_by(Item.id.asc()).all()

    return success([item.to_dict() for item in items])


@bp.get("/<int:item_id>")
@login_required
def get_item(item_id):
    """물품 상세 조회."""
    item = db.session.get(Item, item_id)

    if item is None:
        return failure("ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.", 404)

    return success(item.to_dict())


@bp.post("")
@admin_required
def create_item():
    """물품 등록 (RFID 태그 ID 포함)."""
    data = get_json_body()

    error = validate_item_data(data)
    if error:
        return failure("INVALID_ITEM_DATA", error, 400)

    rfid_uid = data.get("rfid_uid")
    if rfid_uid is not None:
        rfid_uid = rfid_uid.strip().upper() or None

    item = Item(
        name=data["name"].strip(),
        category=data["category"].strip(),
        description=data.get("description") or "",
        rfid_uid=rfid_uid,
        default_loan_days=data.get("default_loan_days", 14),
        status="available",
    )

    db.session.add(item)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return failure(
            "DUPLICATE_RFID_UID",
            "이미 등록된 RFID UID입니다.",
            409
        )

    return success(item.to_dict(), 201)


@bp.put("/<int:item_id>")
@admin_required
def update_item(item_id):
    """물품 수정 및 RFID 태그 재지정."""
    item = db.session.get(Item, item_id)

    if item is None:
        return failure("ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.", 404)

    data = get_json_body()

    error = validate_item_data(data, is_update=True)
    if error:
        return failure("INVALID_ITEM_DATA", error, 400)

    if "name" in data:
        item.name = data["name"].strip()

    if "category" in data:
        item.category = data["category"].strip()

    if "description" in data:
        item.description = data["description"] or ""

    if "rfid_uid" in data:
        uid = data["rfid_uid"]
        item.rfid_uid = uid.strip().upper() or None if uid is not None else None

    if "default_loan_days" in data:
        item.default_loan_days = data["default_loan_days"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return failure(
            "DUPLICATE_RFID_UID",
            "이미 등록된 RFID UID입니다.",
            409
        )

    return success(item.to_dict())


@bp.delete("/<int:item_id>")
@admin_required
def delete_item(item_id):
    """물품 삭제."""
    item = db.session.get(Item, item_id)

    if item is None:
        return failure("ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.", 404)

    # 예약 또는 대여 이력이 있는 물품은 삭제하지 않는다.
    if item.reservations.first() or item.rentals.first():
        return failure(
            "ITEM_HAS_HISTORY",
            "예약 또는 대여 이력이 있는 물품은 삭제할 수 없습니다.",
            409
        )

    db.session.delete(item)
    db.session.commit()

    return success({"message": "물품이 삭제되었습니다."})

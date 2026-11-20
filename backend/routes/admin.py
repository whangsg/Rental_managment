"""관리자 전용 API."""
from flask import Blueprint
from sqlalchemy import func

from auth_utils import admin_required, success
from extensions import db
from models import Item, Reservation, Rental, User

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.get("/dashboard")
@admin_required
def dashboard():
    """전체 물품 및 연체 현황 통계."""

    total_items = Item.query.count()

    available_items = Item.query.filter_by(
        status="available"
    ).count()

    reserved_items = Item.query.filter_by(
        status="reserved"
    ).count()

    rented_items = Item.query.filter_by(
        status="rented"
    ).count()

    overdue_rentals = Rental.query.filter_by(
        status="overdue"
    ).count()

    return success({
        "total_items": total_items,
        "available_items": available_items,
        "reserved_items": reserved_items,
        "rented_items": rented_items,
        "overdue_rentals": overdue_rentals,
    })


@bp.get("/reservations")
@admin_required
def get_all_reservations():
    """전체 사용자의 예약 및 대여 내역."""

    reservations = (
        Reservation.query
        .order_by(Reservation.reserved_at.desc())
        .all()
    )

    rentals = (
        Rental.query
        .order_by(Rental.rent_date.desc())
        .all()
    )

    return success({
        "reservations": [r.to_dict() for r in reservations],
        "rentals": [r.to_dict() for r in rentals],
    })


@bp.get("/overdue")
@admin_required
def get_overdue_rentals():
    """연체 중인 대여와 사용자 정보."""

    results = (
        db.session.query(Rental, User)
        .join(User, Rental.student_id == User.student_id)
        .filter(Rental.status == "overdue")
        .order_by(Rental.due_date.asc())
        .all()
    )

    overdue_list = []

    for rental, user in results:
        data = rental.to_dict()

        data.update({
            "name": user.name,
            "email": user.email,
        })

        overdue_list.append(data)

    return success(overdue_list)

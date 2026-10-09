from flask import Blueprint
from flask_login import login_required

from auth_utils import not_implemented

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/register")
def register():
    """회원가입. 권한: 누구나"""
    return not_implemented()


@bp.post("/login")
def login():
    """로그인 (세션 쿠키 발급). 권한: 누구나"""
    return not_implemented()


@bp.post("/logout")
@login_required
def logout():
    """로그아웃. 권한: 로그인"""
    return not_implemented()


@bp.get("/me")
@login_required
def me():
    """내 정보, 로그인 상태 확인. 권한: 로그인"""
    return not_implemented()

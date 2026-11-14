"""회원가입 및 세션 기반 인증 API."""
from flask import Blueprint, request, session
from flask_login import current_user, login_user, logout_user, login_required
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from auth_utils import failure, success
from extensions import db
from models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def get_json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


@bp.post("/register")
def register():
    """회원가입. 요청: student_id, name, email, password."""
    body = get_json_body()
    if body is None:
        return failure("INVALID_JSON", "JSON 형식의 요청 본문이 필요합니다.", 400)

    student_id = str(body.get("student_id", "")).strip()
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password", "")

    if not all((student_id, name, email, password)) or not isinstance(password, str):
        return failure("MISSING_FIELDS", "student_id, name, email, password는 필수입니다.", 400)
    if len(student_id) > 20 or len(name) > 50 or len(email) > 120:
        return failure("INVALID_FIELD", "입력한 값의 길이가 허용 범위를 초과했습니다.", 400)
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        return failure("INVALID_EMAIL", "올바른 이메일 주소를 입력해주세요.", 400)
    if len(password) < 8:
        return failure("WEAK_PASSWORD", "비밀번호는 8자 이상이어야 합니다.", 400)

    if User.query.filter(or_(User.student_id == student_id, User.email == email)).first():
        return failure("USER_ALREADY_EXISTS", "이미 사용 중인 학번 또는 이메일입니다.", 409)

    user = User(student_id=student_id, name=name, email=email, role="user")
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return failure("USER_ALREADY_EXISTS", "이미 사용 중인 학번 또는 이메일입니다.", 409)

    return success(user.to_dict(), 201)


@bp.post("/login")
def login():
    """로그인. 이메일 또는 학번과 비밀번호를 받으며 Flask 세션 쿠키를 발급한다."""
    body = get_json_body()
    if body is None:
        return failure("INVALID_JSON", "JSON 형식의 요청 본문이 필요합니다.", 400)

    identifier = str(body.get("email", body.get("student_id", ""))).strip().lower()
    password = body.get("password", "")
    if not identifier or not isinstance(password, str) or not password:
        return failure("MISSING_FIELDS", "email(또는 student_id)과 password는 필수입니다.", 400)

    user = User.query.filter(
        or_(User.email == identifier, User.student_id == identifier)
    ).first()
    if user is None or not user.check_password(password):
        return failure("INVALID_CREDENTIALS", "이메일/학번 또는 비밀번호가 올바르지 않습니다.", 401)

    login_user(user, remember=False, fresh=True)
    session.permanent = True
    return success({"user": user.to_dict()})


@bp.post("/logout")
@login_required
def logout():
    logout_user()
    session.clear()
    return success({"message": "로그아웃되었습니다."})


@bp.get("/me")
@login_required
def me():
    return success({"user": current_user.to_dict()})

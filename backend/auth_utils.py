"""공통 API 응답과 접근 권한 데코레이터."""
import hmac
from functools import wraps

from flask import current_app, jsonify, request
from flask_login import current_user, login_required


def success(data=None, status=200):
    """성공 응답 형식: {success: true, data: ...}"""
    return jsonify(success=True, data=data), status


def failure(code, message, status):
    """실패 응답 형식: {success: false, error: {code, message}}"""
    return jsonify(
        success=False,
        error={"code": code, "message": message},
    ), status


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if current_user.role != "admin":
            return failure("FORBIDDEN", "관리자 권한이 필요합니다.", 403)
        return fn(*args, **kwargs)

    return wrapper


def device_key_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config.get("DEVICE_API_KEY", "")
        given = request.headers.get("X-Device-Key", "")
        if not expected or not hmac.compare_digest(given, expected):
            return failure("INVALID_DEVICE_KEY", "유효하지 않은 기기 인증 키입니다.", 401)
        return fn(*args, **kwargs)

    return wrapper

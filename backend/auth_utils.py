import hmac
from functools import wraps

from flask import current_app, jsonify, request
from flask_login import current_user, login_required


def not_implemented():
    return jsonify(error="not implemented"), 501


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_user.role != "admin":
            return jsonify(error="forbidden"), 403
        return fn(*args, **kwargs)

    return login_required(wrapper)


def device_key_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config.get("DEVICE_API_KEY", "")
        given = request.headers.get("X-Device-Key", "")
        if not expected or not hmac.compare_digest(given, expected):
            return jsonify(error="invalid device key"), 401
        return fn(*args, **kwargs)

    return wrapper

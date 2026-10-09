from flask import Blueprint

from auth_utils import device_key_required, not_implemented

bp = Blueprint("device", __name__, url_prefix="/api/device")


@bp.post("/tag")
@device_key_required
def scan_tag():
    """태그 스캔값 전송. 인증: 헤더 X-Device-Key.

    ESP32는 대여/반납을 구분하지 않고 이 API 하나로 보내며, 서버가 물품 상태를 보고 판단한다.
      - item.status == 'rented'                                  -> 반납 처리
      - item.status == 'reserved' 이고 pickup_requested_at 이 있음 -> PendingConfirmation 생성 (본인 확인 대기)
      - 둘 다 아니면 에러
    """
    return not_implemented()

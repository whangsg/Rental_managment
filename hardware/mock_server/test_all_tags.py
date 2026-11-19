"""
물품 상태별로 태그 응답이 맞는지 검증 (서버를 켜지 않아도 됨).

    python test_all_tags.py
"""
import sys
from mock_scan_server import DEFAULT_DB, DEVICE_KEY, create_app

# (UID, 물품, 예상 status, 예상 result)
CASES = [
    ("AB3127CA", "드라이버 세트",  "available", "ERROR"),
    ("75FD892A", "전동 드릴",      "reserved",  "WAIT_CONFIRM"),
    ("D5AB892A", "DSLR 카메라",    "reserved",  "WAIT_CONFIRM"),
    ("551A892A", "농구공",         "rented",    "RETURN_OK"),
    ("D5C9882A", "보드게임 카탄",  "rented",    "RETURN_OK"),
    ("0536882A", "멀티미터",       "available", "ERROR"),
    ("C9742A20", "테스트 물품 7",  "rented",    "RETURN_OK"),
    ("C9A80A20", "테스트 물품 8",  "available", "ERROR"),
    ("3B32FACB", "테스트 물품 9",  "available", "ERROR"),
]

client = create_app(DEFAULT_DB, "/api/scan").test_client()
H = {"X-Device-Key": DEVICE_KEY}
fail = 0


def check(label, uid, expect, headers=H):
    global fail
    r = client.post("/api/scan", json={"uid": uid}, headers=headers)
    got = r.get_json()["result"]
    ok = got == expect
    fail += not ok
    print(("PASS" if ok else "FAIL"), f"{label:<14} {uid:<9} -> {got:<12} (HTTP {r.status_code}) {r.get_json().get('message')}")


for uid, name, status, expect in CASES:
    check(f"{name}[{status}]", uid, expect)
check("소문자 입력", CASES[1][0].lower(), "WAIT_CONFIRM")
check("미등록 카드", "FFFFFFFF", "UNKNOWN_TAG")
check("잘못된 키", CASES[1][0], "ERROR", headers={"X-Device-Key": "wrong"})
print("\n전부 통과" if not fail else f"\n실패 {fail}건")
sys.exit(1 if fail else 0)

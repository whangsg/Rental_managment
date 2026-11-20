# 하드웨어 모의테스트 서버

backend 와 **완전히 분리**된 테스트용 서버입니다. (backend/ 는 수정하지 않음)

## 실행
```
pip install flask
python hardware/mock_server/mock_scan_server.py      # Git Bash 에서는 경로에 / 를 쓰세요
python hardware/mock_server/test_all_tags.py          # 서버 없이 응답 검증
```
`db-package/rental.db` 를 **읽기 전용**으로 열어 `items.rfid_uid` 와 `items.status` 를 조회합니다.
(DB 를 바꾸지 않으므로 같은 태그를 몇 번 찍어도 같은 결과가 나옵니다.)

## 물품 상태 -> 응답 -> 부저 소리
| 상태 | result | 의미 | 소리 |
|---|---|---|---|
| (DB 에 없는 태그) | UNKNOWN_TAG | 등록 안 된 태그 | 낮은 소리 3번 |
| available (보관중) | ERROR | 예약 없이 태깅 -> 거부 | 아주 낮은 긴 소리 |
| reserved (예약됨) | WAIT_CONFIRM | 예약자 본인확인 대기 | 올라가는 3음 |
| rented (대여중/연체) | RETURN_OK | 반납 처리 | 중간 높이 긴 소리 |
| (ESP32 자체) | NETWORK_FAIL | Wi-Fi/서버 연결 실패 | 짧고 빠른 5번 |

## 현재 DB 의 태그 (seed.py 로 만든 샘플)
| # | UID | 물품 | 상태 | 비고 |
|---|---|---|---|---|
| 1 | AB3127CA | 드라이버 세트 | available | |
| 2 | 75FD892A | 전동 드릴 | reserved | OOO 예약, 수령하기 누름 |
| 3 | D5AB892A | DSLR 카메라 | reserved | OOO(사용자2) 예약, 수령하기 전 |
| 4 | 551A892A | 농구공 | rented | OOO 대여중 |
| 5 | D5C9882A | 보드게임 카탄 | rented | OOO **연체** |
| 6 | 0536882A | 멀티미터 | available | 반납 이력 있음 |
| 7 | C9742A20 | 테스트 물품 7 | rented | OOO 대여중 |
| 8 | C9A80A20 | 테스트 물품 8 | available | |
| 9 | 3B32FACB | 테스트 물품 9 | available | |

- 되돌리기: `db-package/rental.db.bak_before_status` (상태 추가 전, 실물 태그만 들어간 DB),
  `rental.db.bak_before_rfid` (태그 입력 전 원본) 를 `rental.db` 로 복사.
- 상태 데이터는 `db-package/seed.py` 에서 만듭니다. DB 를 새로 만들려면 `db-package/DB_README.md` 의 실행 방법을 따르세요.

## 실제 backend 로 교체할 때
1. 벡엔드와 `POST /api/device/scan` 의 요청/응답(result 코드) 규약을 맞춘다.
2. 펌웨어의 `SERVER_URL`, `DEVICE_KEY` 만 바꾼다. (펌웨어 로직은 그대로)
3. 이 폴더는 회귀 테스트/데모용으로 남겨 둔다.

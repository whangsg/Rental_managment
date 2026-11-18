# device_api: ESP32 태그 스캔 API 참고 구현

`POST /api/device/tag` 를 구현한 참고 파일입니다. backend 가 이 API 를 갖추기 전에,
**backend/ 를 수정하지 않고** 먼저 만들어 검증하고, 완성되면 한 파일만 복사해서 옮기기 위한 폴더입니다.

## 파일
| 파일 | 역할 | backend 로 옮길 때 |
|---|---|---|
| `device.py` | `/api/device/tag` 본체 (Blueprint) | **이 파일만** `backend/routes/device.py` 로 복사 |
| `run_with_device.py` | `device.py` 를 끼워 넣어 서버를 띄우는 임시 실행 스크립트 | 필요 없음 |
| `test_device_flow.py` | 예약 -> 수령하기 -> 태그 -> 본인확인 -> 대여 -> 반납 전체 흐름 자동 테스트 (24개 항목) | 필요 없음 |

## API 규칙
인증: 헤더 `X-Device-Key` (서버의 `DEVICE_API_KEY` 와 펌웨어의 `DEVICE_KEY` 가 같아야 함)

요청: `{"uid": "75FD892A"}`  /  응답: `result` 가 최상위에 있음 (ESP32 가 읽기 쉽도록)
```json
{"success": true, "result": "WAIT_CONFIRM", "message": "'전동 드릴' 예약자 본인 확인 대기 중"}
```

| 물품 상태 | 서버 동작 | result | HTTP | 부저 |
|---|---|---|---|---|
| 등록되지 않은 UID | - | UNKNOWN_TAG | 404 | 낮은 소리 3번 |
| reserved + 예약자가 수령하기를 누름 | 본인 확인 대기 레코드 생성 (60초) | WAIT_CONFIRM | 200 | 올라가는 3음 |
| reserved + 수령하기를 누르지 않음 | 변경 없음 | ERROR | 409 | 아주 낮은 긴 소리 |
| rented (대여중/연체) | 대여 returned, 물품 available (반납 처리) | RETURN_OK | 200 | 중간 높이 긴 소리 |
| available 등 그 외 | 변경 없음 | ERROR | 409 | 아주 낮은 긴 소리 |
| uid 누락 / 키 불일치 | - | ERROR | 400 / 401 | 아주 낮은 긴 소리 |

- 같은 태그를 연달아 읽어도 유효한 대기 레코드가 있으면 새로 만들지 않습니다.
- 본인 확인 시간(60초)이 지나면 만료되고, 예약자가 **수령하기를 다시 눌러야** 합니다.
- 반납 시 더 이상 연체 중인 대여가 없으면 사용자의 연체 표시(`is_overdue`)를 해제합니다.

## 실행 방법
**반드시 최신 main (예약 API 포함, `backend/reservation_tasks.py` 가 있는 상태) 에서 실행하세요.**
오래된 브랜치에서는 `No module named 'reservation_tasks'` 오류가 납니다.

### 1. 자동 테스트 (서버를 켜지 않아도 됨)
```bash
python hardware/device_api/test_device_flow.py
```
`시드 완료` 뒤 `전부 통과` 가 나오면 성공입니다.

### 2. 임시 실행 스크립트 (backend 수정 없음, 권장)
```bash
python hardware/device_api/run_with_device.py            # 옵션: --port 5000 --key 키 --db 경로
```
- 실행할 때마다 **임시 폴더에 새 DB 를 만들고 시드**합니다. 서버를 껐다 켜면 처음 상태로 돌아갑니다.
  (시드의 예약은 만든 시각 기준 24시간 뒤 픽업 기한이 지나므로, 매번 새로 만드는 방식입니다.)
- `backend/rental.db`, `db-package/rental.db` 는 건드리지 않습니다.
- 켜질 때 출력되는 `DB:` 경로를 `--db` 로 지정하면 재시작해도 기록이 유지됩니다.

### 3. 실제 backend 에 복사해서 실행
```bash
cp hardware/device_api/device.py backend/routes/device.py
cp db-package/seed.py backend/seed.py
cd backend
python seed.py                                           # DB 가 비어 있을 때만 데이터가 들어감
DEVICE_API_KEY=esp32-dev-key-change-me python app.py     # 또는 .env 에 DEVICE_API_KEY 를 적어 둠
```
이 방식은 서버를 껐다 켜도 DB 가 유지됩니다. 처음 상태로 되돌리려면 서버를 끈 뒤
`rm -f rental.db rental.db-shm rental.db-wal` -> `python seed.py` 를 다시 실행하세요.

## 동작 확인
```bash
curl -s -X POST http://127.0.0.1:5000/api/device/tag \
  -H "Content-Type: application/json" -H "X-Device-Key: esp32-dev-key-change-me" \
  -d '{"uid":"75FD892A"}'
```
시드 직후에는 `75FD892A`(전동 드릴) 가 `WAIT_CONFIRM`, `551A892A`(농구공) 가 `RETURN_OK` 입니다.
확인한 뒤에는 상태가 바뀌므로, 같은 결과를 다시 보려면 시드를 새로 하세요.

## ESP32 로 테스트할 때
펌웨어(`hardware/firmware/esp32_rfid_kiosk/esp32_rfid_kiosk.ino`)에서 두 값을 맞춥니다.
- `SERVER_URL` = `http://노트북IP:5000/api/device/tag`  (`ipconfig` 로 노트북 IP 확인, 포트 :5000 필수)
- `DEVICE_KEY` = 서버의 기기 키와 같은 값 (기본 `esp32-dev-key-change-me`)

## backend 로 옮기기
1. `device.py` 를 `backend/routes/device.py` 에 복사합니다. 내용 수정은 필요 없습니다.
   (`reservations.py` 와 같은 방식으로 import 하고, `app.py` 의 `BLUEPRINT_MODULES` 에 `device` 가 이미 있어 등록도 자동입니다.)
2. `.env` 에 `DEVICE_API_KEY` 를 설정합니다. 값이 비어 있으면 모든 요청이 401 입니다.
3. 서버를 켜고 위 `test_device_flow.py` 와 curl 로 확인합니다.
4. 이 폴더의 `run_with_device.py`, `test_device_flow.py` 는 옮기지 않아도 됩니다.

## 알아둘 점
- 엔드포인트 이름 `/tag` 는 팀원이 만든 스켈레톤(`feature/api-device`)을 따른 것이며 확정 전입니다.
  바꾸려면 `device.py` 의 `@bp.post("/tag")` 와 펌웨어 `SERVER_URL` 만 수정합니다.
- `device.py` 는 `backend/routes/device.py` (팀원 담당) 를 대체하는 파일이므로, 반영할 사람과 시점을 먼저 정하세요.
- 연체 자동 전환과 관리자 태그 등록(REGISTERED) 은 이 API 의 범위가 아닙니다.
- 태그 스캔 이력은 DB 에 따로 남기지 않습니다 (상태가 바뀌는 WAIT_CONFIRM, RETURN_OK 만 기록으로 남음).

## 문제 해결
| 증상 | 원인 / 해결 |
|---|---|
| `No module named 'reservation_tasks'` | 최신 main 이 아닌 브랜치에서 실행함 -> 최신 main 에서 실행 |
| 모든 요청이 401 | 서버의 `DEVICE_API_KEY` 가 비었거나 펌웨어 `DEVICE_KEY` 와 다름 |
| 모든 태그가 UNKNOWN_TAG | DB 에 시드가 안 들어감 (`python seed.py` 실행) |
| 전동 드릴이 ERROR | 시드 후 24시간이 지나 예약이 만료됨 -> 시드를 새로 함 |
| `connection refused` | `SERVER_URL` 에 `:5000` 이 없거나 노트북 IP 가 틀림, 서버가 꺼져 있음 |

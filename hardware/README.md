# 하드웨어 테스트 가이드 (ESP32 + RC522 + 부저)

RFID 태그를 ESP32로 읽어 Wi-Fi로 서버에 보내고, 서버의 응답을 **부저 소리**로 알려 주는 키오스크입니다.
이 문서는 장비를 빌려 직접 시험해 보려는 사람을 위한 순서입니다.

```
태그 --> RC522 --> ESP32 --(Wi-Fi, HTTP POST /api/device/tag)--> 서버 --> DB 조회
                      ^                                        |
                      +------------- 응답(result) 코드 <-------+
                  부저가 result 에 따라 다른 소리를 냄
```

ESP32 는 UID 가 무슨 뜻인지 모릅니다. "읽어서 보내고, 응답을 보고 소리 내기"만 합니다.
대여/반납 판단은 전부 서버가 합니다.

## 1. 준비물
- ESP32 개발보드 (CP2102 USB-UART), RC522 리더, 수동 부저(극성 없음), 브레드보드, 점퍼선
- RFID 태그 (DB 의 UID 와 같은 태그여야 인식됩니다)
- 2.4GHz Wi-Fi (**5GHz 는 ESP32 가 못 잡습니다**). 학교/회사처럼 아이디를 따로 입력하는 Wi-Fi 도 안 됩니다.
  휴대폰 핫스팟(호환성 극대화 / 2.4GHz) 이 가장 편합니다.

## 2. 배선
| RC522 | ESP32 |
|---|---|
| SDA (SS) | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| GND | GND |
| 3.3V | **3V3** (절대 5V 에 연결 금지) |
| IRQ | 연결 안 함 |

| 부저 | ESP32 |
|---|---|
| 한쪽 다리 | GPIO 27 |
| 다른 쪽 다리 | GND |

RST 는 인터넷 예제에서 GPIO 21 을 쓰는 경우가 많지만, **이 프로젝트는 22** 입니다.

## 3. 컴퓨터 설정 (처음 한 번)
1. **USB 드라이버**: CP210x VCP (Silicon Labs). 설치 후 장치 관리자에 COM 포트가 보여야 합니다.
2. **Arduino IDE**: 보드 매니저에서 `esp32 (Espressif)` **3.x** 설치 (2.x 는 `tone` 함수 오류).
3. **라이브러리**: `MFRC522` (GithubCommunity), `ArduinoJson` (Benoit Blanchon)
4. 보드 `ESP32 Dev Module`, 포트는 본인 COM 번호.

## 4. 서버 준비
Git Bash 에서는 경로에 `/` 를 쓰세요 (`\` 는 사라집니다). 아래 명령은 모두 **저장소 루트**에서 시작합니다.
서버는 두 가지 중 하나만 켭니다. **둘 다 5000번 포트를 쓰므로 동시에 켜지 마세요.**

### 4-A. 실제 backend (권장: 예약 -> 수령하기 -> 태그 -> 본인 확인 -> 대여 -> 반납까지 확인)
최신 main 에서 실행해야 합니다. (`POST /api/device/tag` 가 들어 있는 backend)
```
pip install -r requirements.txt

cp db-package/seed.py backend/                   # seed.py 는 backend/ 안에서 실행해야 함
cd backend
python seed.py                                   # backend/rental.db 생성 (이미 사용자가 있으면 건너뜀)

DEVICE_API_KEY=esp32-dev-key-change-me python -c "from app import create_app; create_app().run(host='0.0.0.0', port=5000, use_reloader=False)"
```
- **`python app.py` 가 아니라 위 명령으로 켜야 합니다.** `app.py` 는 `127.0.0.1`(내 컴퓨터 안)에서만 접속되게 켜서, 같은 Wi-Fi 의 ESP32 가 접속하지 못합니다. (`app.py` 는 수정하지 않고 실행 명령만 바꿉니다)
- `DEVICE_API_KEY` 는 펌웨어의 `DEVICE_KEY` 와 같은 값이어야 합니다. 값이 없으면 모든 요청이 401 입니다.
- 윈도우 방화벽 창이 뜨면 **허용** (개인 네트워크).
- 서버 창은 **끄지 말고** 둡니다. 태그를 찍을 때마다 `POST /api/device/tag ... 200` 이 찍힙니다.
- 확인: `http://127.0.0.1:5000/api/items` 가 열리면(로그인 필요 JSON) 서버가 켜진 것입니다.
- 태그를 찍어 바뀐 내용은 `backend/rental.db` 에 저장되고, 서버를 껐다 켜도 유지됩니다. 처음 상태로 되돌리려면 서버를 끄고:
  `cd backend && rm -f rental.db rental.db-shm rental.db-wal && python seed.py`
- 시드 샘플의 예약은 시드를 만든 시각 기준 **24시간 뒤 픽업 기한이 지나 자동 만료**됩니다. 만료되면 시드를 다시 하세요.
- 컴퓨터를 재부팅하면 서버가 꺼지고 **노트북 IP 가 바뀔 수 있습니다.** 다시 켜고 `ipconfig` 로 IP 를 확인해 펌웨어 `SERVER_URL` 과 맞추세요.

웹 화면에서 본인 확인까지 보려면 프론트도 실제 모드로 켭니다.
```
cd frontend
cp .env.example .env                             # 처음 한 번 (.env 는 폴더마다 따로 있는 로컬 파일)
# .env 의 VITE_USE_MOCK 을 false 로 바꾼 뒤 (바꾸면 서버를 껐다 켜야 반영됨)
npm install
npm run dev                                      # http://localhost:5173
```
- 시드 계정: `sgwhang@example.com` / `test1234`, `namhs@example.com` / `test1234`, `admin@example.com` / `admin1234`
- 황상건 계정으로 로그인해 **예약·대여 화면에 머무른 채** 전동 드릴 태그(`75FD892A`)를 찍으면 본인 확인 창이 뜹니다. (이 화면이 2초마다 대기 여부를 조회합니다)
- 승인하면 대여가 시작되고, 같은 태그를 다시 찍으면 반납(RETURN_OK)됩니다.
- DB 를 눈으로 보려면 DB Browser for SQLite 로 `backend/rental.db` 를 **읽기 전용**으로 열고 F5 로 새로고침합니다.

### 4-B. 모의 서버 (backend 없이 소리만 확인)
```
pip install flask
pip install -r requirements.txt                  # seed.py 가 필요로 함

cp db-package/seed.py backend/
cd backend && python seed.py && cd ..            # backend/rental.db 생성 (샘플 데이터)

python hardware/mock_server/mock_scan_server.py --db backend/rental.db
```
- 서버 창은 **끄지 말고** 둡니다. 태그를 찍을 때마다 로그가 찍힙니다.
- 윈도우 방화벽 창이 뜨면 **허용** (개인 네트워크).
- 확인: 브라우저에서 `http://<내 컴퓨터 IP>:5000/api/health` 가 열리면 정상.
- 모의 서버는 DB 를 읽기만 합니다. 상태는 바뀌지 않고, **본인 확인 대기도 만들지 않으므로 웹 화면에 확인 창이 뜨지 않습니다.**
- 샘플 태그 UID 와 물품 상태: `hardware/mock_server/mock_scan_server.py` 주석과 `hardware/mock_server/README.md`

## UID 규칙 (펌웨어)

RFID UID 는 아래 규칙으로 통일합니다. (backend/frontend 도 같은 규칙으로 검증)

- 대문자 16진수(`0-9`, `A-F`), 구분자(공백, `:`, `-`) 없음, 짝수 길이, **8~20자** (4~10바이트)
- 정규식: `^(?:[0-9A-F]{2}){4,10}$`   예) `AB3127CA`
- 펌웨어는 읽은 UID 가 4~10바이트가 아니거나 규칙에 맞지 않으면 서버로 **보내지 않고** 아주 낮은 긴 소리를 냅니다. (UID 를 자르지 않음)
- 시리얼 모니터에는 `지원하지 않는 UID 형식(N바이트)입니다. 서버로 보내지 않습니다.` 가 찍힙니다.
- 일반 카드(MIFARE Classic)는 8자, NTAG/Ultralight 는 14자, 일부 카드는 20자가 나옵니다.

## 5. 펌웨어 설정과 업로드
`hardware/firmware/esp32_rfid_kiosk/esp32_rfid_kiosk.ino` 위쪽의 4줄을 **본인 환경에 맞게** 고칩니다.
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";       // 2.4GHz Wi-Fi 이름
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.0.15:5000/api/device/tag";   // 내 컴퓨터 IP 로 (포트 :5000 필수)
const char* DEVICE_KEY    = "esp32-dev-key-change-me";             // 서버와 같아야 함 (기본값 그대로)
```
- 내 컴퓨터 IP: 명령 프롬프트 `ipconfig` → Wi-Fi 어댑터의 IPv4 주소. ESP32 와 **같은 Wi-Fi** 여야 합니다.
- `localhost` / `127.0.0.1` 은 ESP32 자신을 가리키므로 쓰면 안 됩니다.
- ⚠ 실제 Wi-Fi 이름/비밀번호를 적은 채로 **Git 에 커밋하지 마세요.**
- 업로드가 "Connecting...." 에서 멈추면 ESP32 의 **BOOT 버튼**을 누르고 있으세요.

## 6. 동작 확인
시리얼 모니터(115200)를 엽니다. (Arduino IDE 또는 VS Code 의 Serial Monitor 확장. 둘이 동시에 포트를 쓸 수 없고, 업로드 전에는 모니터를 꺼야 합니다.)
```
✅ 연결됨. ESP32 IP: ...        <- Wi-Fi 성공, 부저 "삑삑"
=== 준비 완료. 태그를 대주세요 ===
태그 인식: XXXXXXXX -> 서버 전송
HTTP 200, result=WAIT_CONFIRM, message=...
```
Wi-Fi 가 안 붙으면 `대기 모드` 로 들어가 10초마다 재연결을 시도합니다.

### 소리
| 상황 | 서버 result | 부저 |
|---|---|---|
| 예약된 물품 (reserved). 실제 backend 는 웹에서 '수령하기'를 누른 예약만 | WAIT_CONFIRM | 올라가는 3음 "띠-리-링" |
| 대여중 물품 (rented) | RETURN_OK | 중간 높이의 긴 "삐-" |
| 보관중 물품 (available), 예약 없음 / 수령하기를 누르지 않은 예약 | ERROR | 아주 낮은 긴 "부-" |
| DB 에 없는 태그 | UNKNOWN_TAG | 낮은 "붕붕붕" 3번 |
| Wi-Fi/서버 연결 실패 (ESP32 가 판단) | NETWORK_FAIL | 짧고 빠른 "삐삐삐삐삐" 5번 |
| 시작할 때 Wi-Fi 성공 | - | 작은 "삑삑" 2번 |

부저는 말을 못 하고 음의 높이/길이/횟수로만 구분합니다.

## 7. 안 될 때
| 증상 | 확인할 것 |
|---|---|
| COM 포트가 안 보임 | 충전 전용 케이블 / CP210x 드라이버 미설치 |
| 시리얼 모니터가 비어 있음 | 속도 115200, ESP32 의 EN 버튼 |
| `RC522 를 찾을 수 없습니다` | 배선(특히 3V3, SDA=5, RST=22), 점퍼선 접촉 |
| Wi-Fi 연결 실패 | 5GHz 인지, 이름/비밀번호 오타(대소문자 포함) |
| 빠른 삐 5번 + `connection refused` | 서버가 꺼짐 / IP 가 다름 / **`SERVER_URL` 에 `:5000` 누락** / 방화벽 |
| `HTTP 401` | `DEVICE_KEY` 가 서버의 `DEVICE_API_KEY` 와 다름 (서버 쪽 값이 비어 있어도 401) |
| `curl` 은 되는데 ESP32 는 `connection refused` | backend 를 `python app.py` 로 켬 (127.0.0.1 전용). 4-A 의 `host='0.0.0.0'` 명령으로 켜기 |
| 태그 소리는 나는데 본인 확인 창이 안 뜸 | 모의 서버가 켜져 있음(DB 에 기록 안 함) / 황상건 계정의 예약·대여 화면이 아님 / 서버 로그에 `POST /api/device/tag` 가 안 찍힘 |
| 재부팅 후 갑자기 안 됨 | 서버가 꺼졌고 노트북 IP 가 바뀜 -> 서버 재실행 + `SERVER_URL` 의 IP 확인 |
| 웹에서 시드 계정 로그인이 안 되고 `mockLogin` 오류 | 프론트가 가짜 모드: `frontend/.env` 의 `VITE_USE_MOCK=false` 로 바꾸고 `npm run dev` 재시작 (`.env` 는 폴더마다 따로 있음) |
| 태그를 대면 아주 낮은 긴 소리 + `지원하지 않는 UID 형식` | UID 가 4~10바이트가 아님. 서버로 보내지 않는 게 정상 (UID 규칙 참고) |
| 모든 태그가 "붕붕붕"(미등록) | 서버가 읽는 DB 의 UID 가 이 태그들과 다름 (`--db` 경로 확인) |
| 서버를 켰는데 옛 데이터가 나옴 | `--db backend/rental.db` 를 빼먹음 (기본값은 `db-package/rental.db`) |

## 8. 폴더 구성
```
hardware/
├─ README.md                         이 문서
├─ firmware/esp32_rfid_kiosk/        ESP32 펌웨어 (.ino)
└─ mock_server/                      모의 서버 + 검증 스크립트 (backend 와 분리)
   ├─ mock_scan_server.py
   ├─ test_all_tags.py               서버 없이 응답 검증:  python hardware/mock_server/test_all_tags.py
   └─ README.md                      샘플 태그/상태 표
```

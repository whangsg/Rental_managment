# Backend

## 1. 개요

RentIt Backend는 Flask 기반 REST API 서버로, 사용자 인증, 물품 관리, 예약, 대여 및 반납, 알림, 관리자 기능을 처리합니다.

SQLite 데이터베이스를 사용하여 서비스 데이터를 관리하며, ESP32 장치와의 HTTP 통신을 통해 RFID 기반 대여 및 반납 요청을 처리합니다.

### 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Python |
| Framework | Flask |
| API | Flask-RESTful |
| Authentication | Flask-Login |
| ORM | Flask-SQLAlchemy |
| Database | SQLite |
| Scheduler | APScheduler |
| Email | smtplib (SMTP) |
| API Testing | Postman |

## 2. 실행 방법

프로젝트 루트에서 가상환경을 활성화한 뒤 의존성을 설치합니다.

```bash
pip install -r requirements.txt
python backend/app.py
```

개발 서버 기본 주소는 `http://127.0.0.1:5000`입니다.

설정은 프로젝트 루트의 `.env` 파일에서 읽습니다.

## 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 필요한 환경 변수를 설정합니다.

### SMTP 이메일 설정

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=rentit.notice@gmail.com
MAIL_PASSWORD=change-me-app-password
MAIL_DEFAULT_SENDER=rentit.notice@gmail.com
MAIL_USE_TLS=true

ADMIN_EMAIL=admin@example.com
```

| 변수 | 설명 |
|---|---|
| `MAIL_SERVER` | SMTP 서버 주소 |
| `MAIL_PORT` | SMTP 서버 포트 |
| `MAIL_USERNAME` | 이메일 발송 계정 |
| `MAIL_PASSWORD` | 이메일 계정의 앱 비밀번호 |
| `MAIL_DEFAULT_SENDER` | 발신자 이메일 주소 |
| `MAIL_USE_TLS` | TLS 사용 여부 |
| `ADMIN_EMAIL` | 관리자 연체 알림 수신 이메일 |

실제 이메일 계정 정보가 포함된 `.env` 파일은 Git에 커밋하지 않습니다. 저장소에는 `.env.example`을 포함합니다.

## 4. 주요 API 모듈

| 모듈 | 주요 기능 |
|---|---|
| `auth.py` | 회원가입, 로그인, 로그아웃 및 사용자 인증 |
| `items.py` | 물품 목록 조회 및 물품 관리 |
| `reservations.py` | 물품 예약 및 본인 확인 요청 관리 |
| `device.py` | RFID UID 검증, 대여 및 반납 처리 |
| `notifications.py` | 알림 목록 조회 및 읽음 처리 |
| `admin.py` | 관리자 대시보드, 예약 및 연체 내역 조회 |

## 5. 주요 기능

### 5.1 사용자 인증

- 회원가입 및 로그인
- Flask-Login 기반 세션 인증
- 로그인 상태 확인
- 로그아웃
- 관리자 권한 확인

인증이 필요한 API는 Flask 세션 쿠키를 사용합니다.

프론트엔드에서 API 요청 시 다음 설정이 필요합니다.

```javascript
credentials: "include"
```

### 5.2 물품 관리

- 전체 물품 목록 조회
- 물품 정보 조회
- 물품 등록, 수정 및 삭제
- 물품 대여 가능 여부 및 상태 관리
- RFID UID를 통한 물품 식별

물품 관리 기능 중 관리자 권한이 필요한 작업은 관리자만 수행할 수 있습니다.

RFID UID는 대문자 영문 A~F와 숫자로 구성된 4~10바이트 형식인지 검증합니다.

### 5.3 예약 관리

- 물품 예약
- 예약 목록 및 상세 정보 조회
- 예약 상태 관리
- 픽업 요청 및 본인 확인 처리
- 픽업 기한이 지난 예약 자동 만료
- 예약 만료 시 물품 상태 복구
- 예약 만료 알림 생성

### 5.4 RFID 대여 및 반납

ESP32 장치에서 전달받은 RFID UID를 검증하고 대여 및 반납 요청을 처리합니다.

- RFID UID 수신 및 검증
- 물품 정보 확인
- 대여 요청 처리
- 반납 요청 처리
- 대여 및 물품 상태 갱신
- 대여 및 반납 정보 데이터베이스 저장

### 5.5 알림 관리

- 로그인한 사용자의 알림 목록 조회
- 알림 읽음 처리
- 예약 만료 알림
- 연체 발생 알림
- 관리자 대상 신규 연체 알림

각 사용자는 본인의 알림만 조회하고 읽음 처리할 수 있습니다.

### 5.6 연체 관리 및 이메일 발송

대여 기한이 지난 물품을 연체 상태로 변경하고 대여자와 관리자에게 알림을 전달합니다.

- 대여 기한 초과 여부 확인
- 대여 상태를 `overdue`로 변경
- 사용자별 연체 여부 갱신
- 대여자 대상 앱 알림 생성
- 관리자 대상 앱 알림 생성
- 대여자에게 연체 안내 이메일 발송
- 관리자에게 신규 연체 이메일 발송

이메일 발송 기록은 `OverdueNotification` 모델을 통해 대여 건별, 발송 대상별로 관리합니다.

| Channel | 대상 |
|---|---|
| `email_user` | 물품 대여자 |
| `email_admin` | 관리자 |

이미 발송 기록이 존재하는 대상에게는 동일한 연체 이메일을 다시 발송하지 않습니다.

## 6. 관리자 기능

관리자 계정은 일반 사용자 기능에 더해 다음 기능을 사용할 수 있습니다.

- 관리자 대시보드 정보 조회
- 전체 예약 내역 조회
- 연체 내역 조회
- 물품 관리
- 사용자 및 대여 현황 확인
- 관리자 알림 확인

관리자 전용 API는 로그인 여부와 사용자 역할을 확인합니다.

## 7. 자동화 작업 (APScheduler)

APScheduler를 이용하여 다음 작업을 주기적으로 실행합니다.

| 작업 | 설명 |
|---|---|
| 예약 만료 처리 | 픽업 기한이 지난 예약을 `expired` 상태로 변경 |
| 본인 확인 요청 만료 | 응답 제한시간이 지난 요청을 만료 처리 |
| 연체 상태 갱신 | 반납 기한이 지난 대여를 `overdue` 상태로 변경 |
| 연체 이메일 발송 | 연체된 대여 건에 대해 대여자 및 관리자에게 이메일 발송 |

자동화 작업은 Backend 서버에서 실행되며, 실행 주기는 환경 변수 설정을 따릅니다.

## 8. 데이터베이스 모델

SQLite와 SQLAlchemy를 사용하여 서비스 데이터를 관리합니다.

| 모델 | 설명 |
|---|---|
| `User` | 사용자 및 관리자 계정 정보 |
| `Item` | 물품 정보 및 RFID UID |
| `Reservation` | 예약 정보 및 예약 상태 |
| `PendingConfirmation` | 본인 확인 요청 정보 |
| `Rental` | 대여 정보 및 대여 상태 |
| `Notification` | 사용자 및 관리자 알림 |
| `OverdueNotification` | 연체 이메일 발송 기록 |

## 9. 공통 API 응답

모든 API는 JSON 형식으로 응답합니다.

### 성공

```json
{
  "success": true,
  "data": {}
}
```

### 실패

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "설명"
  }
}
```

## 10. 인증 및 권한

- 인증 방식: Flask-Login 기반 세션 인증
- 로그인 성공 시 세션 쿠키 발급
- 인증이 필요한 API는 `login_required`를 통해 접근 제한
- 관리자 전용 API는 사용자 역할을 확인
- 다른 사용자의 알림에 접근하거나 읽음 처리할 수 없도록 소유권 검증

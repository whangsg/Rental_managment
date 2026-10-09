# 데이터베이스 설계 및 정규화 과정

담당: 황상건 (Database Architect)
DBMS: SQLite 3 (SQLAlchemy ORM 사용, `backend/models.py`)

> 제안서 원안은 MongoDB였으나, 이 프로젝트의 데이터(회원·물품·예약·대여기록)는 **엔터티 간 관계가 명확하고 구조가 고정적**이며, 예약/대여 처리에서 **동시성 제어(같은 물품을 두 명이 동시에 예약하는 경쟁 상태 방지)와 트랜잭션 무결성**이 핵심이라 관계형 DB가 더 적합하다고 판단해 SQLite로 변경했습니다. 별도 DB 서버 없이 파일 하나로 동작하므로 시연/배포도 단순해집니다.

---

## 1. 요구사항에서 도출한 데이터

제안서의 기능 요구사항에서 저장해야 할 정보를 뽑으면 다음과 같습니다.

| 기능 | 필요한 데이터 |
|---|---|
| 회원가입/로그인 | 학번, 이름, 이메일, 비밀번호(해시), 권한(일반/관리자) |
| 물품 등록/조회 | 물품명, 카테고리, 설명, RFID UID, 현재 상태, 기본 대여기간 |
| 예약 신청 | 누가, 어떤 물품을, 언제 예약했고, 픽업 기한이 언제이며, 희망 대여기간이 며칠인지, 예약 상태 |
| 태깅 후 본인확인 | 어떤 태깅이 어떤 예약자의 확인을 기다리는지, 만료 시각, 응답 결과 |
| 대여/반납 | 누가 무엇을 언제 빌려서 언제까지 반납해야 하고 실제로 언제 반납했는지, 상태 |
| 연체 알림 | 어떤 대여 건에 언제 알림을 보냈는지 (중복 발송 방지) |
| 앱 내 알림 (연체, 예약 자동취소) | 누구에게, 어떤 종류의, 어떤 내용의 알림이며, 읽었는지, 언제 생성됐는지 |
| 수령하기 버튼 | 사용자가 '수령하기'를 눌러 태깅 대기를 시작한 시각 |

---

## 2. 정규화 이전: 비정규 형태 (UNF)

만약 "대여 기록" 하나에 모든 정보를 한 줄로 넣는다면 이런 테이블이 됩니다.

```
RENTAL_LOG (
  rental_id, student_id, user_name, user_email, user_role,
  item_name, item_category, item_rfid_uid, item_status,
  reserved_at, pickup_deadline, desired_loan_days, reservation_status,
  rent_date, due_date, return_date, rental_status,
  notification_sent_at_list   ← "2026-10-01, 2026-10-02" 처럼 여러 값이 한 칸에
)
```

문제점:
- **반복 그룹**: 연체 알림이 여러 번 갈 수 있어서 `notification_sent_at_list`에 값이 여러 개 들어감 → 1NF 위반
- **갱신 이상(Update anomaly)**: 사용자 이메일이 바뀌면 그 사람의 모든 대여 기록 행을 다 고쳐야 함
- **삽입 이상(Insert anomaly)**: 아직 한 번도 빌려간 적 없는 새 물품은 "대여 기록"이 없어서 등록할 곳이 없음
- **삭제 이상(Delete anomaly)**: 어떤 사용자의 유일한 대여 기록을 지우면 그 사용자 정보 자체가 사라짐

---

## 3. 제1정규형 (1NF) — 원자값 + 반복 그룹 제거

규칙: 모든 컬럼은 **더 이상 쪼갤 수 없는 단일 값**만 가져야 하고, 반복되는 그룹은 별도 행/테이블로 분리한다.

- `notification_sent_at_list`를 분리 → 알림 1건 = 1행이 되도록 `OVERDUE_NOTIFICATION` 테이블로 뺌
- 나머지 컬럼은 이미 원자값

```
RENTAL_LOG (rental_id, student_id, user_name, user_email, user_role,
            item_name, item_category, item_rfid_uid, item_status,
            reserved_at, pickup_deadline, desired_loan_days, reservation_status,
            rent_date, due_date, return_date, rental_status)

OVERDUE_NOTIFICATION (notification_id, rental_id, sent_at, channel)
```

---

## 4. 제2정규형 (2NF) — 부분 함수 종속 제거

규칙: 1NF를 만족하고, **기본키의 일부에만 종속되는 컬럼이 없어야** 한다. (복합키가 있을 때 의미가 있음)

`RENTAL_LOG`의 기본키를 `rental_id` 단일 컬럼으로 두면 형식적으로는 2NF를 만족하지만, 실질적으로 이 테이블은 **"누가(사용자)" + "무엇을(물품)" + "언제(대여 건)"** 세 가지 의미가 섞여 있습니다. 개념적으로 `(student_id, item_rfid_uid, rent_date)`가 대여 건을 식별한다고 보면:

- `user_name, user_email, user_role` → `student_id`에만 종속 (부분 종속)
- `item_name, item_category, item_status` → `item_rfid_uid`에만 종속 (부분 종속)

이들을 분리합니다.

```
USER (student_id PK, user_name, user_email, user_role)
ITEM (item_rfid_uid PK, item_name, item_category, item_status)
RENTAL_LOG (rental_id PK, student_id FK, item_rfid_uid FK,
            reserved_at, pickup_deadline, desired_loan_days, reservation_status,
            rent_date, due_date, return_date, rental_status)
OVERDUE_NOTIFICATION (notification_id PK, rental_id FK, sent_at, channel)
```

이제 사용자 이메일을 바꿔도 `USER` 한 행만 고치면 되고, 대여 기록 없는 물품도 `ITEM`에 등록할 수 있습니다.

---

## 5. 제3정규형 (3NF) — 이행 함수 종속 제거

규칙: 2NF를 만족하고, **기본키가 아닌 컬럼이 다른 비키 컬럼을 통해 기본키에 종속되는 관계(이행 종속)**가 없어야 한다.

### 5-1. "예약"과 "대여"는 서로 다른 생명주기를 가진 별개 사건

`RENTAL_LOG`에 아직 `reserved_at, pickup_deadline, desired_loan_days, reservation_status`(예약 정보)와 `rent_date, due_date, return_date, rental_status`(대여 정보)가 함께 있습니다. 그런데:

- 예약은 했지만 **픽업하지 않아 취소된 건**은 대여 정보가 전부 NULL
- 반대로 관리자가 예외적으로 예약 없이 대여를 기록할 수도 있음

즉 예약 정보는 "예약 건"에 종속되고, 대여 정보는 "대여 건"에 종속됩니다. `rental_status`가 `reservation_status`에 이행적으로 영향을 받는 구조(예약이 fulfilled여야 대여가 존재)라 두 엔터티를 분리합니다.

```
RESERVATION (id PK, item_id FK, student_id FK, reserved_at, pickup_deadline,
             desired_loan_days, status)
RENTAL      (id PK, reservation_id FK(nullable), item_id FK, student_id FK,
             rent_date, due_date, return_date, status)
```

`RENTAL.reservation_id`는 **어떤 예약이 이 대여로 이어졌는지** 추적하는 링크이며, 예약 1건 → 대여 최대 1건 (1:0..1) 관계입니다.

### 5-2. "태깅 후 본인확인 대기"는 독립된 상태 엔터티

태깅 직후 "본인이 맞습니까?" 대기 상태는 예약과 대여 사이의 **중간 단계**입니다. 이걸 `RESERVATION.status`에 `confirm_pending` 값으로만 두면:
- 한 예약에 대해 태깅이 여러 번 일어날 수 있는데(사용자가 '아니오' 누르고 재태깅), 각 시도의 시각·만료·결과를 기록할 수 없음
- 확인 만료 시각(`expires_at`)은 예약이 아니라 "이번 태깅 시도"에 종속됨

따라서 별도 테이블로 분리합니다.

```
PENDING_CONFIRMATION (id PK, item_id FK, reservation_id FK, student_id FK,
                      scanned_at, expires_at, status)
```

### 5-2-1. "앱 내 알림"은 메일 발송 기록과 다른 엔터티

`OVERDUE_NOTIFICATION`은 "어떤 대여 건에 메일을 언제 보냈나"를 남기는 **발송 로그**(중복 발송 방지용)이고, 사용자에게 보여주는 알림은 수신자·내용·읽음 여부가 필요한 별개의 엔터티입니다. 연체뿐 아니라 예약 자동취소 알림도 있어서 `rental_id`에 묶을 수 없으므로 분리합니다.

```
NOTIFICATION (id PK, student_id FK, type, message, is_read, created_at)
```

`is_read`는 알림 한 건에만 종속되고(PATCH `/api/notifications/{id}/read`), 사용자 정보는 `student_id`로 참조하므로 3NF를 만족합니다.

### 5-2-2. 수령하기 시각은 예약에 종속

'수령하기' 버튼을 누른 시각(`pickup_requested_at`)은 "이 예약"에 대한 사실이므로 `reservations`의 nullable 컬럼으로 둡니다. NULL이면 태깅 대기 시작 전입니다. 태깅 시도마다 생기는 값이 아니므로 `pending_confirmations`가 아니라 예약에 둡니다.

### 5-3. 기본키 선택: 자연키(학번) vs 대리키(정수 id)

**users — 학번을 기본키로 (자연키).**
재학생 대상 서비스에서 학번은 발급 후 바뀌지 않는 식별자이고, 학번 자체가 이미 유일하며 의미가 있습니다. 별도의 정수 `id`를 두면 "학번"과 "id" 두 식별자가 공존해 스키마와 API 응답이 불필요하게 복잡해지므로, `student_id`를 그대로 기본키로 사용하고 다른 테이블은 모두 `student_id`로 참조합니다.
감수하는 트레이드오프: 회원가입 시 학번을 잘못 입력한 경우 정정하려면 참조하는 모든 행을 함께 갱신해야 합니다. 이 상황은 드물고, 가입 화면에서 학번 형식 검증으로 예방할 수 있다고 판단했습니다.

**items — 정수 id를 기본키로 (대리키).**
물품의 자연 식별자 후보인 `rfid_uid`는 (1) 등록 시점에는 아직 없고(NULL), (2) 태그가 훼손되면 교체되어 값이 바뀌므로 기본키로 부적합합니다. 그래서 자동 증가 정수 `id`를 기본키로 두고 `rfid_uid`는 **UNIQUE + NULL 허용**으로 둡니다. SQLite에서 UNIQUE는 NULL끼리 충돌로 보지 않으므로 미등록 물품이 여러 개여도 문제없습니다.

**나머지 테이블(reservations, pending_confirmations, rentals, overdue_notifications) — 정수 id.**
"사건" 테이블은 현실에 대응하는 식별자가 없으므로 자동 증가 정수를 씁니다.

### 5-4. 비즈니스 규칙을 제약조건으로

"모든 대여는 반드시 예약을 거친다"와 "예약 하나는 최대 하나의 대여로만 이어진다"는 규칙은 코드에만 두지 않고 **DB 제약**으로 고정했습니다.

```
rentals.reservation_id   INTEGER NOT NULL UNIQUE   FK → reservations.id
```

- `NOT NULL`: 예약 없는 대여 행은 INSERT 자체가 거부됨
- `UNIQUE`: 같은 예약으로 대여를 두 번 만드는 것(중복 확정 버그)을 DB가 막음

또한 SQLite는 기본적으로 FOREIGN KEY를 검사하지 않으므로, 연결마다 `PRAGMA foreign_keys=ON`을 켜서(`backend/extensions.py`) 존재하지 않는 학번/물품을 참조하는 행 삽입과, 이력이 남아 있는 물품/회원 삭제를 DB 차원에서 거부하게 했습니다.

---

## 6. 최종 스키마 (3NF)

```
┌──────────────────────┐        ┌──────────────────────────┐
│ users                │        │ items                    │
├──────────────────────┤        ├──────────────────────────┤
│ student_id    PK     │        │ id               PK      │
│ name                 │        │ name                     │
│ email         UNIQUE │        │ category                 │
│ password_hash        │        │ description              │
│ role                 │        │ rfid_uid   UNIQUE, NULL  │
│ is_overdue           │        │ status                   │
│ created_at           │        │ default_loan_days (14)   │
│                      │        │ created_at               │
└──────────┬───────────┘        └────────────┬─────────────┘
           │ 1                               │ 1
           │                                 │
           │ N                               │ N
┌──────────┴─────────────────────────────────┴─────────────┐
│ reservations                                             │
├──────────────────────────────────────────────────────────┤
│ id                 PK                                    │
│ item_id            FK → items.id                         │
│ student_id         FK → users.student_id                 │
│ reserved_at                                              │
│ pickup_deadline    (예약 + 24시간)                        │
│ desired_loan_days                                        │
│ status   pending | fulfilled | cancelled | expired       │
│ pickup_requested_at  (NULL = 수령하기 전)                 │
└──────┬──────────────────────────────┬────────────────────┘
       │ 1                            │ 1
       │                              │
       │ N                            │ 0..1
┌──────┴───────────────────────┐  ┌───┴──────────────────────────────┐
│ pending_confirmations        │  │ rentals                          │
├──────────────────────────────┤  ├──────────────────────────────────┤
│ id              PK           │  │ id               PK              │
│ item_id         FK → items   │  │ reservation_id   FK NOT NULL UNIQUE │
│ reservation_id  FK           │  │ item_id          FK → items      │
│ student_id      FK → users   │  │ student_id       FK → users      │
│ scanned_at                   │  │ rent_date                        │
│ expires_at                   │  │ due_date                         │
│ status  waiting | confirmed  │  │ return_date      (NULL = 미반납)  │
│         | rejected | expired │  │ status  renting | returned | overdue │
└──────────────────────────────┘  └───────────────┬──────────────────┘
                                                  │ 1
                                                  │
                                                  │ N
                                  ┌───────────────┴──────────────────┐
                                  │ overdue_notifications            │
                                  ├──────────────────────────────────┤
                                  │ id         PK                    │
                                  │ rental_id  FK → rentals.id       │
                                  │ sent_at                          │
                                  │ channel                          │
                                  └──────────────────────────────────┘

users 1 ──── N ┌──────────────────────────────────┐
               │ notifications  (앱 내 알림)       │
               ├──────────────────────────────────┤
               │ id         PK                    │
               │ student_id FK → users            │
               │ type    overdue                  │
               │         | reservation_expired    │
               │ message                          │
               │ is_read                          │
               │ created_at                       │
               └──────────────────────────────────┘
```

### 관계 요약

| 관계 | 카디널리티 | 설명 |
|---|---|---|
| users → reservations | 1 : N | 한 사용자가 여러 번 예약 |
| items → reservations | 1 : N | 한 물품이 시간에 따라 여러 번 예약됨 (동시에는 1건만 `pending`) |
| reservations → pending_confirmations | 1 : N | 한 예약에 대해 태깅 시도가 여러 번 있을 수 있음 |
| reservations → rentals | 1 : 0..1 | 예약이 픽업되면 대여 1건으로 이어짐. `rentals.reservation_id NOT NULL UNIQUE`로 DB가 보장 |
| users → rentals, items → rentals | 1 : N | |
| rentals → overdue_notifications | 1 : N | 연체 1건에 알림 여러 번 (24시간 간격) |
| users → notifications | 1 : N | 한 사용자에게 앱 내 알림 여러 건 |

---

## 7. 의도적으로 남긴 비정규화 (Denormalization)

정규화만 밀어붙이면 조회 비용이 커지는 지점이 있어 두 곳은 의도적으로 중복을 허용했습니다.

| 컬럼 | 이유 |
|---|---|
| `items.status` | 원칙적으로는 `reservations`/`rentals`를 조회해서 유도할 수 있는 값이지만, 물품 목록 화면에서 매번 두 테이블을 JOIN하면 느리고 코드도 복잡해집니다. 대신 예약/대여/반납 트랜잭션 안에서 **항상 함께 갱신**해 정합성을 유지합니다. |
| `users.is_overdue` | "이 사용자가 연체 중인가"는 `rentals WHERE status='overdue'`로 계산 가능하지만, 예약 API마다 매번 세는 대신 연체 배치와 반납 처리에서 플래그를 갱신합니다. |

두 컬럼 모두 **파생 값(derived attribute)** 이며, 갱신 책임이 코드의 한 곳(`routes/scan.py`, `services/scheduler_jobs.py`)에 모여 있어 불일치 위험을 통제합니다.

---

## 8. 동시성 제어 (RDB를 선택한 결정적 이유)

### 8-1. SQLite 의 동시 접속 특성

SQLite 는 쓰기 시 **테이블이 아니라 DB 파일 전체**에 잠금을 걸어 한 번에 한 연결만 쓸 수 있습니다. 읽기는 여러 연결이 동시에 할 수 있습니다. 여러 사용자가 동시에 접속하는 웹 서비스에서는 다음 두 설정이 표준이며, `backend/extensions.py` 에서 연결마다 적용합니다.

| PRAGMA | 효과 |
|---|---|
| `journal_mode=WAL` | 쓰는 중에도 읽을 수 있고, 읽는 중에도 쓸 수 있다 (기본 모드는 서로 막음) |
| `busy_timeout=5000` | 다른 연결이 쓰는 중이면 "database is locked" 로 즉시 실패하지 않고 최대 5초 대기 |

쓰기 한 번(예약/태깅/반납)은 행 한두 개 갱신으로 수 ms 이내이므로, 동아리·실습실 규모(분당 몇 건의 쓰기)에서는 대기가 사실상 발생하지 않습니다. `tests/test_concurrency.py` 에서 스레드 20개가 같은 순간 예약 요청을 보내는 상황을 실제 파일 DB 로 재현해 잠금 오류가 없음을 확인했습니다.

### 8-2. 진짜 위험은 잠금이 아니라 "확인 후 변경" 경쟁 상태

같은 물품에 두 사용자가 거의 동시에 "예약" 을 누르는 경우, 문제는 DB 잠금이 아니라 애플리케이션 로직에 있습니다.

```python
# 잘못된 패턴 (초기 구현)
item = Item.query.get(item_id)
if item.status != "available":   # ① 두 요청 모두 여기서 "available" 을 읽음 (읽기는 동시 가능)
    return 409
item.status = "reserved"         # ② 쓰기는 직렬화되지만 둘 다 "reserved 로 바꿔라" 라 둘 다 성공
db.session.commit()              #    -> 한 물품에 예약 2건
```

동시성 테스트에서 실제로 20명 중 2명이 성공하는 것이 재현되었습니다. 해결은 **확인과 변경을 하나의 원자적 명령으로 합치는 것**입니다.

```python
# 올바른 패턴 (현재 구현)
updated = Item.query.filter_by(id=item_id, status="available") \
                    .update({"status": "reserved"})   # UPDATE ... WHERE status='available'
if updated == 0:                                      # 영향 행 0 -> 누군가 먼저 바꿈
    return 409
```

`UPDATE ... WHERE status='available'` 은 DB 가 쓰기를 직렬화하므로 정확히 한 요청만 1행을 갱신하고, 나머지는 0행(이미 reserved)을 받습니다. 이 패턴(compare-and-set)은 SQLite 와 PostgreSQL 모두에서 행 잠금 없이 동작합니다.

### 8-3. 2중 안전장치: 부분 UNIQUE 인덱스

애플리케이션 코드가 뚫리는 경우(새 API 추가, 관리자 수기 입력 등)에 대비해 DB 제약으로도 막습니다.

```sql
CREATE UNIQUE INDEX uq_one_pending_reservation_per_item
    ON reservations (item_id) WHERE status = 'pending';
```

"한 물품에 `pending` 예약은 1건만" 을 DB 가 보장합니다. 취소·만료·완료된 과거 예약은 `pending` 이 아니므로 여러 건 쌓여도 됩니다. 이런 **부분 인덱스(partial index)** 는 SQLite 와 PostgreSQL 이 모두 지원합니다.

### 8-4. PostgreSQL 로 옮겨야 하는 시점

SQLAlchemy 를 쓰므로 연결 문자열만 바꾸면 PostgreSQL 로 전환됩니다. 다음 상황이 되면 전환을 검토합니다.

- 서버를 **여러 대/여러 프로세스**로 운영 (SQLite 는 한 파일을 여러 서버가 공유할 수 없음)
- 쓰기가 **초당 수백 건** 이상 지속 (전교 단위 서비스 등)
- 수십 GB 이상의 데이터, 복잡한 분석 쿼리

현재 범위(동아리·실습실, 단일 서버)에서는 SQLite 가 더 단순하고 — 네트워크/프로세스 간 통신이 없어 — 단건 조회·쓰기 지연은 오히려 PostgreSQL 보다 짧습니다.

## 9. 인덱스

| 테이블.컬럼 | 종류 | 용도 |
|---|---|---|
| users.student_id | PRIMARY KEY | 세션 식별자 → 사용자 조회 (매 요청) |
| users.email | UNIQUE | 로그인 조회, 중복 가입 방지 |
| items.rfid_uid | UNIQUE (NULL 허용) | **ESP32 태깅 시 UID → 물품 조회** (가장 빈번한 조회) |
| reservations(item_id, status) | 복합 (SQLAlchemy 기본 FK 인덱스 + 조회 시 필터) | 태깅 시 "이 물품의 pending 예약" 조회 |
| pending_confirmations(student_id, status) | 조회 필터 | React가 2초마다 폴링하는 "내 확인 대기" 조회 |
| rentals(status, due_date) | 조회 필터 | 연체 배치가 `status='renting' AND due_date < now` 스캔 |
| notifications(student_id, is_read) | 복합 인덱스 | "내 알림 목록 / 안 읽은 알림 수" 조회 |

---

## 10. MongoDB 원안과의 대응표

| MongoDB 원안 (제안서) | SQLite 구현 |
|---|---|
| `users` 컬렉션 | `users` 테이블 |
| `items` 컬렉션 (`rental_history` 배열 중첩) | `items` + `rentals` 테이블 (중첩 배열 → 1:N 관계로 펼침) |
| `items.active_reservation` 중첩 문서 | `reservations` 테이블 (`status='pending'` 행) |
| (없음, 인메모리로 처리 예정이었음) | `pending_confirmations` 테이블 — 서버 재시작에도 유지됨 |
| (없음) | `overdue_notifications` — 중복 발송 방지 |
| (없음) | `notifications` — 앱 내 알림(연체, 예약 자동취소)과 읽음 처리 |

MongoDB에서 `rental_history`를 물품 문서 안에 배열로 넣었던 것은 "물품 하나 조회하면 이력이 딸려온다"는 편의를 위한 것이었는데, 관계형에서는 `SELECT * FROM rentals WHERE item_id = ?` 한 줄로 같은 결과를 얻으면서 사용자 기준 조회(`WHERE student_id = ?`)도 똑같이 쉬워지는 장점이 있습니다.

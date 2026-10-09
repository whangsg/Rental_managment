# DB 기술 선택 근거 및 Q&A

담당: 황상건 (Database Architect)
함께 보기: [`DB_NORMALIZATION.md`](DB_NORMALIZATION.md) (스키마 설계 과정), [`schema.sql`](schema.sql)

이 문서는 "왜 이 기술을 썼는가"에 대한 질문과 답을 모아둔 것입니다. 발표 질의응답과 설계 리뷰 대비용.

---

## Q1. ORM이 뭐고 왜 쓰는지?

**ORM(Object-Relational Mapping)** 은 DB 테이블을 프로그래밍 언어의 클래스처럼 다루게 해주는 번역 계층. 이 프로젝트는 **SQLAlchemy**(Flask-SQLAlchemy)를 씀.

```python
# ORM 없이 (SQL 직접)
cursor.execute("SELECT * FROM items WHERE rfid_uid = ?", (uid,))
row = cursor.fetchone()
cursor.execute("UPDATE items SET status='reserved' WHERE id = ?", (row[0],))

# ORM (SQLAlchemy)
item = Item.query.filter_by(rfid_uid=uid).first()
item.status = "reserved"
db.session.commit()
```

`backend/models.py`의 `class Item(db.Model)`이 "items 테이블 ↔ Item 클래스" 대응표이며, 그래서 이 파일이 스키마의 원본입니다.

| 장점 | 이 프로젝트에서 |
|---|---|
| DBMS 독립 | SQL 방언 차이를 ORM이 흡수 → SQLite ↔ PostgreSQL 전환이 설정 1줄 |
| SQL 인젝션 방어 | 입력값을 SQL 문자열에 끼워 넣지 않고 파라미터로 전달. 제안서 Week 10 "인젝션 방지" 요건 기본 충족 <br>(SQL 문장과 값을 따로 DB에 보내기 때문에) |
| 관계를 속성으로 | `rental.item.name`, `reservation.user.email` — JOIN 없이 접근 |
| 스키마 = 코드 | `db.create_all()`이 모델에서 테이블 자동 생성. `gen_schema.py`로 `schema.sql` 추출 |

| 단점 | 대응 |
|---|---|
| 복잡한 집계는 ORM이 더 장황함 | 통계 쿼리는 필요 시 `db.session.execute(text(...))`로 SQL 직접 사용 |
| 뒤에서 나가는 SQL을 모르면 느린 쿼리 작성 가능 (N+1 문제) | `SQLALCHEMY_ECHO=True`로 실제 SQL 확인하며 개발 |

> ORM은 SQL을 안 배워도 되게 해주는 도구가 아니라, SQL을 **덜 반복해서** 쓰게 해주는 도구다. 뒤에서 어떤 SQL이 나가는지 알고 써야 한다.

---

## Q2. 왜 MongoDB가 아니라 관계형 DB(SQLite)인지?


| 판단 기준 | 이 프로젝트 | 유리한 쪽 |
|---|---|---|
| 데이터 구조 | 회원·물품·예약·대여 — 필드가 고정적이고 관계가 명확 | 관계형 |
| 핵심 연산 | "같은 물품을 두 명이 동시에 예약" 방지, 예약→대여 전환의 원자성 | 관계형 (트랜잭션·제약조건) |
| 비즈니스 규칙을 DB가 보장 | `NOT NULL`, `UNIQUE`, 부분 UNIQUE 인덱스, FK | 관계형 |
| 스키마 유연성 필요 | 없음 (물품마다 다른 필드가 필요하지 않음) | — |
| 운영 부담 | 단일 파일, 별도 서버 없음 | SQLite |

MongoDB가 유리한 "가변 데이터"(레코드마다 필드 종류가 다른 데이터)가 이 프로젝트에는 없습니다. 자세한 비교는 `DB_NORMALIZATION.md` 10절.

---

## Q3. SQLite는 여러 명이 동시에 쓰면 잠기지 않는지?

 SQLite는 쓰기 시 테이블이 아니라 **DB 파일 전체**에 잠금을 걸어 한 번에 한 연결만 씁니다. 읽기는 동시에 가능합니다.

**규모가 작아서 문제없음**

| | 수치 |
|---|---|
| 쓰기가 발생하는 순간 | 예약 클릭, 태깅, 확인 클릭, 반납 태깅 |
| 쓰기 1회 소요 | 1~2 ms (행 한두 개 갱신) |
| 현실적 쓰기 빈도 | 동아리방 기준 분당 몇 건 |
| SQLite 쓰기 처리 능력 | 초당 수천 건 |

100명이 동시에 접속해 있어도 같은 밀리초에 쓰기를 하는 사람은 거의 없고, 겹치더라도 몇 ms 대기 후 처리됩니다. SQLite 공식 문서도 "하루 10만 히트 이하 사이트"에 적합하다고 안내합니다.

**적용한 설정** (`backend/extensions.py`, 연결마다 PRAGMA):

| 설정 | 효과 |
|---|---|
| `journal_mode=WAL` | 쓰는 중에도 읽기 가능, 읽는 중에도 쓰기 가능 |
| `busy_timeout=5000` | 잠금 중이면 "database is locked" 즉시 실패 대신 최대 5초 대기 |
| `foreign_keys=ON` | FK 검사 활성화 (SQLite 기본값은 미검사) |


---

## Q4. SQLite가 PostgreSQL보다 성능이 떨어지나?

**상황에 따라 반대.** 체급 차이가 아니라 구조 차이.

| | SQLite | PostgreSQL |
|---|---|---|
| 구조 | 앱에 라이브러리로 내장, 파일 직접 접근 | 별도 서버 프로세스, 네트워크(소켓) 통신 |
| 단건 조회/쓰기 지연 | **더 빠름** (프로세스 간 통신 없음) | 쿼리마다 왕복 비용 |
| 동시 쓰기 많을 때 | 한 번에 한 명 → 초당 수백 건 넘으면 대기 | 행 단위 잠금, **더 빠름** |
| 서버 여러 대 | 불가 (파일 공유 불가) | 가능 |
| 데이터 크기 | 수 GB까지 무난 | 수백 GB ~ TB |

이 프로젝트는 "단일 서버 + 작은 데이터 + 가끔 쓰기 + 자주 읽기"라 SQLite가 더 빠르거나 같음. 태깅 응답 1초 이내 요건은 수 ms에 처리됩니다.

**PostgreSQL로 전환해야 하는 시점**: 서버 여러 대/다중 프로세스 운영, 쓰기 초당 수백 건 지속, 수십 GB 이상 데이터. 전환 비용은 Q6 참고.

---

## Q5. "동시에 같은 물품 예약" 문제는 어떻게 막을지?

**"확인 후 변경" 경쟁 상태**가 위험함.

```python
# 잘못된 패턴 — 테스트에서 20명 중 2명 성공이 실제로 재현
item = Item.query.get(item_id)
if item.status != "available": return 409   # 둘 다 "available" 읽음 (읽기는 동시 가능)
item.status = "reserved"                     # 둘 다 성공 → 예약 2건
```

**해결 1 — 원자적 UPDATE (compare-and-set)**
```python
updated = Item.query.filter_by(id=item_id, status="available").update({"status": "reserved"})
if updated == 0: return 409   # 영향 행 0 = 누군가 먼저 바꿈
```
DB가 쓰기를 직렬화하므로 정확히 한 요청만 1행을 갱신합니다. SQLite·PostgreSQL 모두 동작.

**해결 2 — 부분 UNIQUE 인덱스 (DB 제약)**
```sql
CREATE UNIQUE INDEX uq_one_pending_reservation_per_item
    ON reservations (item_id) WHERE status = 'pending';
```
코드가 뚫려도 DB가 "물품당 pending 예약 1건"을 물리적으로 거부.

**검증**: 같은 물품에 20명 동시 예약 → 정확히 1명 201, 19명 409 (3회 반복 통과).

---

## Q6. 나중에 DB를 바꾸는 비용은?

교체 비용은 **"그 부품에 의존하는 코드가 얼마나 넓게 퍼져 있나"** 로 결정됩니다. DB는 ORM 뒤 `models.py` 한 파일에 가둬져 있고, 프레임워크는 모든 라우트에 스며들어 있습니다.

| 교체 | 손대는 파일 (이 프로젝트) |
|---|---|
| SQLite → PostgreSQL/MySQL (같은 관계형) | `extensions.py` SQLite PRAGMA 블록 제거. **나머지 전부 그대로** |
| Flask → FastAPI/Django (프레임워크) | `app.py`, `extensions.py`, `routes/` 6개, `tests/`. `models.py`·프론트·ESP32는 그대로 |
| 관계형 → MongoDB (패러다임) | `models.py` 전면 재작성, 모든 쿼리, 제약조건 대체, 설계 문서 폐기. **가장 비쌈** |

관계형 안에서 DBMS만 바꾸는 것이 가장 쌈. 단, 전제는 **ORM을 썼을 때**. SQL을 직접 썼다면 DBMS마다 문법 차이(자동증가 키, 날짜 함수, `RETURNING` 등)를 파일마다 수정해야됨.

실무에서 "DB 교체는 큰일"인 이유는 코드 수정보다 **운영 데이터 이전·검증** 비용임. 이 프로젝트는 아직 운영 데이터가 없어 해당 없음.

이미 준비해둔 것: 부분 인덱스에 `sqlite_where`와 `postgresql_where` 모두 지정, 원자적 UPDATE 패턴은 양쪽 공통.

---

## Q7. 왜 학번을 PK로 썼나? (자연키 vs 대리키)

| 테이블 | PK | 이유 |
|---|---|---|
| users | **학번** (자연키) | 재학생 대상이라 학번은 불변·유일. 정수 id와 학번 두 식별자가 공존할 필요 없음 |
| items | **정수 id** (대리키) | 자연 식별자 후보인 `rfid_uid`는 등록 전엔 NULL이고 태그 교체 시 값이 바뀜 → PK 부적합 |
| 나머지 | **정수 id** | "사건" 테이블은 현실 대응 식별자가 없음 |

학번 PK의 트레이드오프: 가입 시 학번 오타를 정정하려면 참조하는 모든 행을 함께 갱신해야 함 → 가입 화면에서 학번 형식 검증으로 예방.

---

## Q8. 정규화했다면서 왜 중복 컬럼이 있나?

`items.status`와 `users.is_overdue` 두 곳은 **의도적 비정규화**.

| 컬럼 | 유도 가능한 원본 | 중복을 둔 이유 |
|---|---|---|
| `items.status` | reservations/rentals 조회 | ESP32 태깅 처리의 분기 기준. 1초 이내 응답을 위해 조회 1번으로 끝나야 함 |
| `users.is_overdue` | `rentals WHERE status='overdue'` | 예약 버튼마다 확인하는 값. 매번 집계 대신 플래그 캐시 |

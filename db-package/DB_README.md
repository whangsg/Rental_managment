# DB 패키지 (담당: 황상건)

| 파일 | 내용 | 누가 보나 |
|---|---|---|
| `schema.sql` | 테이블 7개 CREATE TABLE + 인덱스 (SQLite) ,구조파악용으로만 쓸것| 전원 — 컬럼명·타입·제약 확인 |
| `DB_NORMALIZATION.md` | 설계 근거: UNF→1NF→2NF→3NF, ER 다이어그램, 비정규화 2곳, 동시성 처리 | 전원 — 설계 명세서(Week 5) 첨부용 |
| `DB_DESIGN_NOTES.md` | 기술 선택 Q&A: ORM, SQLite vs PostgreSQL, 동시성, DB 교체 비용 |발표 질의응답 대비 |
| `rental.db` | 실제 SQLite DB 파일,시드 데이터 들어간 실제 SQLite 파일 | 프론트/백엔드 — 바로 열어서 구조·샘플 데이터 확인 |
| `models.py` | SQLAlchemy 모델 (스키마의 원본) | 백엔드 — `backend/models.py`에 그대로 사용 |
| `seed.py` | 테스트 데이터를 넣는 스크립트,초기 데이터 생성 스크립트 | 백엔드 |
| `gen_schema.py` | models.py → schema.sql 재생성 | 백엔드 — 모델 수정 시 실행 |
| `extensions.py` | SQLite PRAGMA 설정 (FK 검사, WAL, busy_timeout) | 백엔드 — `backend/extensions.py`에 그대로 사용 |

## rental.db 열어보기
- GUI: **DB Browser for SQLite** (무료) 또는 VS Code 확장 **SQLite Viewer**
- CLI: `sqlite3 rental.db` → `.tables`, `.schema items`, `SELECT * FROM items;`

## 시드 계정
| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | admin@example.com | admin1234 |
| 사용자 | sgwhang@example.com | test1234 |
| 사용자 | namhs@example.com | test1234 |

## 상태값 (API에서 그대로 사용)
- `items.status`: available / reserved / rented
- `reservations.status`: pending / fulfilled / cancelled / expired
- `pending_confirmations.status`: waiting / confirmed / rejected / expired
- `rentals.status`: renting / returned / overdue
- `notifications.type`: overdue / reservation_expired  (`is_read`: 읽음 여부, PATCH `/api/notifications/{id}/read`가 True로 변경)
- `reservations.pickup_requested_at`: '수령하기' 버튼(`pickup-request`)을 누른 시각. NULL이면 아직 태깅 대기 시작 전

## 주의
- `rental.db`는 샘플입니다. 실제 개발 시엔 각자 `python seed.py`로 생성하세요 (Git에 커밋 X).
- 스키마 변경은 `models.py`에서만. `schema.sql`은 손으로 고치지 말고 `gen_schema.py`로 재생성.

##DB에 바뀐 설계 반영하는 순서
① `models.py` 수정            (설계도 수정)
② `rental.db` 삭제             (기존 건물 철거)
③ `python seed.py` 실행        (설계도대로 새로 짓고 샘플 데이터 입력)
④ `gen_schema.py` 실행         (`schema.sql` 문서도 갱신)
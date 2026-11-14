# 프론트엔드

React 19 + Vite + Tailwind CSS v4 + react-router-dom (TypeScript)

## 실행
```bash
cd frontend
cp .env.example .env   # 처음 한 번
npm install
npm run dev        # http://localhost:5173
```

## 백엔드 연결
- `vite.config.ts` 의 프록시가 `/api` 요청을 `http://127.0.0.1:5000`(Flask)으로 넘긴다. (CORS 설정 불필요)
- `.env` 의 `VITE_USE_MOCK=true` 면 가짜 데이터, `false` 면 실제 백엔드를 호출한다. (`.env.example` 참고)
- API 호출은 모두 `src/api/index.ts` 를 통해서만 한다. 화면에서 `fetch` 를 직접 쓰지 않는다.

### 테스트 계정
| 모드 | 계정 | 비밀번호 |
|---|---|---|
| 가짜 데이터(`VITE_USE_MOCK=true`) | admin@example.com (관리자) | admin1234 |
| | test@example.com (일반) | test1234 |
| 실제 백엔드(`false`) | `db-package/seed.py` 로 만든 계정 (admin@example.com / admin1234 등) | 시드 참고 |

- 가짜 모드는 새로고침하면 로그인이 풀린다.
- 실제 모드는 백엔드를 먼저 실행해야 한다: 저장소 루트에서 `python backend/app.py` (5000번 포트)
- 실제 모드에서 로그인하려면 DB에 계정이 있어야 한다. 시드 방법은 `db-package/DB_README.md` 참고.
- `.env` 를 바꾸면 `npm run dev` 를 다시 시작해야 한다.

## 구조
```
src/
  api/         client(fetch 래퍼), mock(가짜 데이터), types(DB 필드명 기준), index(api 객체)
  auth/        AuthContext(로그인 상태), RequireAuth(로그인·관리자 접근 제한)
  components/  Icon, Logo, Badge, Button, TopBar, TabBar, ItemIcon, LogoutButton
  layouts/     MobileLayout(탭바), AdminLayout(PC 사이드바)
  pages/       Login, Items, ItemDetail, Rentals, Notifications, Admin
```

## 상태값
- 물품: `available / reserved / rented` (백엔드 Item.status)
- 연체: 대여(Rental) 상태 `overdue`

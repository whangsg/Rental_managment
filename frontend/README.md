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

## 구조
```
src/
  api/         client(fetch 래퍼), mock(가짜 데이터), types(DB 필드명 기준), index(api 객체)
  components/  Icon, Logo, Badge, Button, TopBar, TabBar, ItemIcon
  layouts/     MobileLayout(탭바), AdminLayout(PC 사이드바)
  pages/       Login, Items, ItemDetail, Rentals, Notifications, Admin
```

## 상태값
- 물품: `available / reserved / rented` (백엔드 Item.status)
- 연체: 대여(Rental) 상태 `overdue`

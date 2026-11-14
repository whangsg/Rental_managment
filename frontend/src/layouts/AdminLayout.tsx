import { NavLink, Outlet } from "react-router-dom";
import Logo from "../components/Logo";

// 관리자 화면 (PC 중심). 좁은 화면에서는 사이드바가 위로 쌓인다.
// TODO: 관리자 권한 확인, 사이드바 메뉴(물품 관리, 예약·대여 내역, 연체자)는 feature/ui-notifications-admin에서 추가
export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-wrap bg-[var(--app-bg)]">
      <aside className="flex w-full flex-col gap-2 border-b border-[#e5e9e7] bg-white p-5 md:w-60 md:border-b-0 md:border-r">
        <Logo compact />
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink to="/admin" end className="rounded-lg bg-[var(--brand-soft)] px-3 py-2.5 text-sm font-bold text-[var(--brand-dark)]">
            대시보드
          </NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import LogoutButton from "../components/LogoutButton";

const menu = [
  { to: "/admin", label: "대시보드", icon: "grid", end: true },
  { to: "/admin/items", label: "물품 관리", icon: "box", end: false },
  { to: "/admin/rentals", label: "예약·대여 내역", icon: "list", end: false },
  { to: "/admin/overdue", label: "연체자", icon: "warning", end: false },
];

// 관리자 화면 (PC 중심). 좁은 화면(768px 미만)에서는 사이드바가 위로 쌓이고 메뉴가 가로로 바뀐다.
// 768px 이상에서는 줄바꿈 없이 [사이드바 | 본문] 으로 나란히 둔다. (줄바꿈을 허용하면 768~800px 창에서
// 본문이 사이드바 아래로 밀려 화면 밖으로 나가는 문제가 있었다)
// 관리자 권한 확인은 App.tsx 의 <RequireAuth adminOnly /> 가 담당한다.
export default function AdminLayout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)] md:flex-row">
      <aside className="admin-aside">
        <div className="flex items-center justify-between gap-2">
          <Logo compact />
          <span className="rounded-md border border-[#dfe4e1] px-1.5 py-0.5 text-[10px] font-bold text-[#65716c]">ADMIN</span>
        </div>
        <nav className="admin-nav" aria-label="관리자 메뉴">
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon name={m.icon} size={18} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-user">
          <span className="admin-user-info px-3 text-sm font-bold">{user?.name}</span>
          <span className="admin-user-info px-3 text-xs text-[#65716c]">{user?.email}</span>
          <NavLink to="/items" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#3d4a45] hover:bg-[#f1f4f2]">
            <Icon name="user" size={18} />
            사용자 화면으로
          </NavLink>
          <LogoutButton withLabel />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

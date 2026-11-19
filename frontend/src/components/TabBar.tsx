import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Icon from "./Icon";

const tabs = [
  { to: "/items", label: "물품", icon: "box" },
  { to: "/rentals", label: "내 대여", icon: "calendar" },
  { to: "/alerts", label: "알림", icon: "bell" },
];

// 관리자 계정에는 관리자 화면으로 돌아가는 탭을 하나 더 보여준다.
const adminTab = { to: "/admin", label: "관리자", icon: "grid" };

export default function TabBar({ unreadAlerts = false }: { unreadAlerts?: boolean }) {
  const { user } = useAuth();
  const list = user?.role === "admin" ? [...tabs, adminTab] : tabs;
  return (
    <nav className="tab-bar">
      {list.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="tab-icon">
            <Icon name={tab.icon} size={21} />
            {tab.to === "/alerts" && unreadAlerts && <i />}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

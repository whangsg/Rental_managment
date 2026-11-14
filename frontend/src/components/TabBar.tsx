import { NavLink } from "react-router-dom";
import Icon from "./Icon";

const tabs = [
  { to: "/items", label: "물품", icon: "box" },
  { to: "/rentals", label: "내 대여", icon: "calendar" },
  { to: "/alerts", label: "알림", icon: "bell" },
];

export default function TabBar({ unreadAlerts = false }: { unreadAlerts?: boolean }) {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
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

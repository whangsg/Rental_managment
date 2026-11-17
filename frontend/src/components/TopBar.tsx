import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

export default function TopBar({ title, back = false, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="mobile-header">
      <div className="header-side">
        {back && (
          <button className="icon-button" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <Icon name="arrow" />
          </button>
        )}
      </div>
      <h1>{title}</h1>
      <div className="header-side header-action">{action}</div>
    </header>
  );
}

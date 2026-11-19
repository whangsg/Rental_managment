import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Icon from "./Icon";

// 로그아웃 후 로그인 화면으로 이동한다. withLabel 이면 아이콘 옆에 글자를 함께 보여준다.
export default function LogoutButton({ withLabel = false }: { withLabel?: boolean }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onClick = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#3d4a45] hover:bg-[#f1f4f2]"
      >
        <Icon name="logout" size={18} />
        로그아웃
      </button>
    );
  }
  return (
    <button type="button" className="icon-button" onClick={onClick} aria-label="로그아웃">
      <Icon name="logout" />
    </button>
  );
}

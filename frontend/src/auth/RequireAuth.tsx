import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// 로그인이 필요한 화면 묶음. adminOnly 이면 관리자만 들어갈 수 있다.
export default function RequireAuth({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-[#84908b]">불러오는 중...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/items" replace />;
  }
  return <Outlet />;
}

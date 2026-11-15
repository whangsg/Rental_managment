import { Navigate, Route, Routes } from "react-router-dom";
import MobileLayout from "./layouts/MobileLayout";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/Login";
import Items from "./pages/Items";
import ItemDetail from "./pages/ItemDetail";
import Rentals from "./pages/Rentals";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import RequireAuth from "./auth/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* 로그인이 필요한 화면 */}
      <Route element={<RequireAuth />}>
        {/* 하단 탭바가 있는 모바일 화면 */}
        <Route element={<MobileLayout />}>
          <Route path="/items" element={<Items />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/alerts" element={<Notifications />} />
        </Route>

        {/* 탭바 없는 화면 */}
        <Route path="/items/:id" element={<ItemDetail />} />
      </Route>

      {/* 관리자 (PC 중심, 관리자 권한 필요) */}
      <Route element={<RequireAuth adminOnly />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/items" replace />} />
    </Routes>
  );
}

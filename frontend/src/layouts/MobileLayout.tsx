import { Outlet } from "react-router-dom";
import TabBar from "../components/TabBar";

// 모바일 기준 화면. PC에서는 가운데 정렬된 좁은 폭으로 보인다.
export default function MobileLayout() {
  return (
    <div className="mobile-shell">
      <Outlet />
      <TabBar />
    </div>
  );
}

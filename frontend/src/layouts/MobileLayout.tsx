import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { api } from "../api";
import TabBar from "../components/TabBar";

// 하위 화면(알림)에서 읽음 처리 후 탭바의 빨간 점을 갱신할 때 쓴다: useOutletContext<MobileOutletContext>()
export type MobileOutletContext = { refreshUnread: () => void };

// 모바일 기준 화면. PC에서는 가운데 정렬된 좁은 폭으로 보인다.
export default function MobileLayout() {
  const location = useLocation();
  const [unread, setUnread] = useState(false);

  const refreshUnread = useCallback(() => {
    api.notifications
      .mine()
      .then((list) => setUnread(list.some((n) => !n.is_read)))
      .catch(() => setUnread(false)); // 알림을 못 불러와도 다른 화면은 그대로 쓸 수 있게
  }, []);

  // 탭을 옮길 때마다 읽지 않은 알림이 있는지 확인한다.
  useEffect(refreshUnread, [refreshUnread, location.pathname]);

  return (
    <div className="mobile-shell">
      <Outlet context={{ refreshUnread } satisfies MobileOutletContext} />
      <TabBar unreadAlerts={unread} />
    </div>
  );
}

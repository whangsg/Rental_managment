import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api, type AppNotification, type NotificationType } from "../api";
import Icon from "../components/Icon";
import TopBar from "../components/TopBar";
import type { MobileOutletContext } from "../layouts/MobileLayout";
import { errorMessage, relativeTime } from "../utils/format";

const kind: Record<NotificationType, { title: string; icon: string; tone: string }> = {
  overdue: { title: "반납 기한이 지났어요", icon: "warning", tone: "notif-icon-overdue" },
  reservation_expired: { title: "예약이 자동 취소되었어요", icon: "clock", tone: "notif-icon-expired" },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { refreshUnread } = useOutletContext<MobileOutletContext>();
  const [list, setList] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError("");
    api.notifications
      .mine()
      .then(setList)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const unread = list?.filter((n) => !n.is_read) ?? [];

  const markRead = async (ids: number[]) => {
    if (ids.length === 0) return;
    // 화면에 먼저 반영하고, 서버 요청은 하나씩 보낸다 (모두 읽음 API가 따로 없음)
    setList((prev) => prev?.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)) ?? prev);
    try {
      await Promise.all(ids.map((id) => api.notifications.markRead(id)));
    } catch (e) {
      setError(errorMessage(e));
      load();
    } finally {
      refreshUnread();
    }
  };

  const open = async (n: AppNotification) => {
    await markRead(n.is_read ? [] : [n.id]);
    navigate("/rentals"); // 연체·예약 취소 알림은 모두 내 대여에서 확인
  };

  const readAll = async () => {
    setBusy(true);
    await markRead(unread.map((n) => n.id));
    setBusy(false);
  };

  return (
    <>
      <TopBar
        title="알림"
        action={
          unread.length > 0 ? (
            <button type="button" className="text-button" disabled={busy} onClick={readAll}>
              모두 읽음
            </button>
          ) : undefined
        }
      />
      <main className="mobile-main mobile-main-flush flex flex-col">
        {error && (
          <p role="alert" className="form-error mx-[18px] mt-4">
            {error}
          </p>
        )}
        {!list && !error ? (
          <div className="flex flex-col gap-3 p-[18px]" aria-busy="true" aria-label="불러오는 중">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-[76px] animate-pulse rounded-2xl bg-[#eef1f0]" />
            ))}
          </div>
        ) : list && list.length === 0 ? (
          <div className="state-box">
            <Icon name="bell" size={28} />
            <p>새 알림이 없어요.</p>
          </div>
        ) : (
          <ul>
            {list?.map((n) => {
              const k = kind[n.type] ?? { title: "알림", icon: "info", tone: "" };
              return (
                <li key={n.id}>
                  <button type="button" className={`notif-row ${n.is_read ? "" : "unread"}`} onClick={() => open(n)}>
                    <span className={`notif-icon ${k.tone}`}>
                      <Icon name={k.icon} size={19} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <span className="text-sm font-bold">{k.title}</span>
                      <span className="text-[13px] leading-5 text-[#4d5a55]">{n.message}</span>
                      <span className="text-[11px] text-[#84908b]">{relativeTime(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="notif-dot" aria-label="읽지 않음" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

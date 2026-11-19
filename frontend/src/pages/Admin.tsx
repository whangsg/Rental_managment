import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DashboardStats, type OverdueRental } from "../api";
import Icon from "../components/Icon";
import StatusPill from "../components/StatusPill";
import { errorMessage, formatDate, formatDateTime, daysUntil } from "../utils/format";
import { LoadState, PageHeader, toActivity, type ActivityRow } from "./admin/common";

// 관리자 대시보드: 물품 현황 카드, 연체자, 최근 예약·대여
export default function Admin() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overdue, setOverdue] = useState<OverdueRental[]>([]);
  const [recent, setRecent] = useState<ActivityRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    setStats(null);
    Promise.all([api.admin.dashboard(), api.admin.overdue(), api.admin.reservations()])
      .then(([s, o, r]) => {
        setStats(s);
        setOverdue(o);
        setRecent(toActivity(r).slice(0, 8));
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const cards = stats
    ? [
        { label: "전체 물품", value: stats.total_items, icon: "box", tone: "" },
        { label: "대여 가능", value: stats.available_items, icon: "check", tone: "stat-green" },
        { label: "예약 중", value: stats.reserved_items, icon: "clock", tone: "stat-yellow" },
        { label: "대여 중", value: stats.rented_items, icon: "calendar", tone: "" },
        { label: "연체", value: stats.overdue_rentals, icon: "warning", tone: "stat-red" },
      ]
    : [];

  return (
    <>
      <PageHeader title="대시보드" desc="물품과 대여 현황을 한눈에 확인하세요." />
      {!stats ? (
        <LoadState error={error} onRetry={load} />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="stat-grid" aria-label="물품 현황">
            {cards.map((c) => (
              <div key={c.label} className={`stat-card ${c.tone}`}>
                <span className="stat-icon">
                  <Icon name={c.icon} size={20} />
                </span>
                <div>
                  <p className="text-xs text-[#65716c]">{c.label}</p>
                  <p className="text-2xl font-bold">
                    {c.value}
                    <span className="ml-0.5 text-sm font-normal text-[#84908b]">{c.label === "연체" ? "건" : "개"}</span>
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">
                연체자 <span className="text-[#b84343]">{overdue.length}</span>
              </h2>
              <Link to="/admin/overdue" className="text-sm font-semibold text-[var(--brand)]">
                전체 보기
              </Link>
            </div>
            {overdue.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#65716c]">연체 중인 대여가 없어요.</p>
            ) : (
              <div className="table-box">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>학번</th>
                      <th>이름</th>
                      <th>물품</th>
                      <th>반납 기한</th>
                      <th>연체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.slice(0, 5).map((o) => (
                      <tr key={o.id}>
                        <td>{o.student_id}</td>
                        <td>{o.name}</td>
                        <td>{o.item_name}</td>
                        <td>{formatDate(o.due_date)}</td>
                        <td>
                          <span className="badge badge-overdue">{-daysUntil(o.due_date)}일</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">최근 예약·대여</h2>
              <Link to="/admin/rentals" className="text-sm font-semibold text-[var(--brand)]">
                전체 보기
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#65716c]">아직 내역이 없어요.</p>
            ) : (
              <div className="table-box">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>구분</th>
                      <th>학번</th>
                      <th>물품</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.key}>
                        <td className="whitespace-nowrap">{formatDateTime(r.time)}</td>
                        <td>{r.kind}</td>
                        <td>{r.studentId}</td>
                        <td>{r.itemName}</td>
                        <td>
                          <StatusPill status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

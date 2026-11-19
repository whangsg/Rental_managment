import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import Icon from "../../components/Icon";
import StatusPill from "../../components/StatusPill";
import { errorMessage, formatDateTime } from "../../utils/format";
import { LoadState, PageHeader, toActivity, type ActivityRow } from "./common";

const filters: { label: string; match: (r: ActivityRow) => boolean }[] = [
  { label: "전체", match: () => true },
  { label: "수령 대기", match: (r) => r.status === "pending" },
  { label: "대여 중", match: (r) => r.status === "renting" },
  { label: "연체", match: (r) => r.status === "overdue" },
  { label: "반납 완료", match: (r) => r.status === "returned" },
  { label: "취소·만료", match: (r) => r.status === "cancelled" || r.status === "expired" },
];

// 전체 사용자의 예약·대여 내역
export default function AdminRentals() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setError("");
    setRows(null);
    api.admin
      .reservations()
      .then((d) => setRows(toActivity(d)))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? [])
      .filter(filters[filter].match)
      .filter((r) => !q || r.studentId.includes(q) || (r.itemName ?? "").toLowerCase().includes(q));
  }, [rows, filter, query]);

  return (
    <>
      <PageHeader title="예약·대여 내역" desc="모든 사용자의 예약과 대여를 최신순으로 보여줍니다." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="chip-row" role="group" aria-label="상태">
          {filters.map((f, i) => (
            <button key={f.label} type="button" className={`chip ${filter === i ? "active" : ""}`} aria-pressed={filter === i} onClick={() => setFilter(i)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="search-box ml-auto w-full max-w-[280px] bg-white">
          <Icon name="search" size={18} />
          <span className="sr-only">학번 또는 물품 검색</span>
          <input type="search" placeholder="학번 또는 물품 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {!rows ? (
        <LoadState error={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <div className="state-box panel">
          <p>조건에 맞는 내역이 없어요.</p>
        </div>
      ) : (
        <div className="panel table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>구분</th>
                <th>학번</th>
                <th>물품</th>
                <th>기한</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.key}>
                  <td className="whitespace-nowrap">{formatDateTime(r.time)}</td>
                  <td>{r.kind}</td>
                  <td>{r.studentId}</td>
                  <td>{r.itemName}</td>
                  <td className="whitespace-nowrap">
                    <span className="text-xs text-[#84908b]">{r.kind === "예약" ? "수령 " : "반납 "}</span>
                    {formatDateTime(r.deadline)}
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api, type OverdueRental } from "../../api";
import { daysUntil, errorMessage, formatDate } from "../../utils/format";
import { LoadState, PageHeader } from "./common";

// 연체자 목록: 반납 기한이 오래 지난 순
export default function AdminOverdue() {
  const [list, setList] = useState<OverdueRental[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    setList(null);
    api.admin
      .overdue()
      .then(setList)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="연체자" desc="반납 기한이 지난 대여 목록입니다. 오래 연체된 순서로 보여줍니다." />
      {!list ? (
        <LoadState error={error} onRetry={load} />
      ) : list.length === 0 ? (
        <div className="state-box panel">
          <p>연체 중인 대여가 없어요.</p>
        </div>
      ) : (
        <div className="panel table-box">
          <table className="admin-table">
            <thead>
              <tr>
                <th>학번</th>
                <th>이름</th>
                <th>이메일</th>
                <th>물품</th>
                <th>대여일</th>
                <th>반납 기한</th>
                <th>연체</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>{o.student_id}</td>
                  <td>{o.name}</td>
                  <td>
                    <a href={`mailto:${o.email}`}>{o.email}</a>
                  </td>
                  <td>{o.item_name}</td>
                  <td>{formatDate(o.rent_date)}</td>
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
    </>
  );
}

import type { ReactNode } from "react";
import type { AdminReservations, RentalStatus, ReservationStatus } from "../../api";
import { parseServerDate } from "../../utils/format";

// 관리자 화면 공통: 제목줄, 불러오기/에러 상태, 예약·대여를 한 줄 목록으로 합치기

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-[#65716c]">{desc}</p>}
      </div>
      {action}
    </header>
  );
}

export function LoadState({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (error) {
    return (
      <div className="state-box panel" role="alert">
        <p>{error}</p>
        <button type="button" className="button button-secondary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }
  return <div className="h-[220px] animate-pulse rounded-2xl bg-[#eef1f0]" aria-busy="true" aria-label="불러오는 중" />;
}

export type ActivityRow = {
  key: string;
  kind: "예약" | "대여";
  time: string; // 예약 시각 또는 대여 시작 시각
  deadline: string; // 수령 기한 또는 반납 기한
  studentId: string;
  itemName: string | null;
  status: ReservationStatus | RentalStatus;
};

// 수령까지 끝난 예약(fulfilled)은 대여 기록과 겹치므로 빼고, 최신순으로 합친다.
export function toActivity(data: AdminReservations): ActivityRow[] {
  const rows: ActivityRow[] = [
    ...data.reservations
      .filter((r) => r.status !== "fulfilled")
      .map((r) => ({
        key: `r${r.id}`,
        kind: "예약" as const,
        time: r.reserved_at,
        deadline: r.pickup_deadline,
        studentId: r.student_id,
        itemName: r.item_name,
        status: r.status,
      })),
    ...data.rentals.map((l) => ({
      key: `l${l.id}`,
      kind: "대여" as const,
      time: l.rent_date,
      deadline: l.due_date,
      studentId: l.student_id,
      itemName: l.item_name,
      status: l.status,
    })),
  ];
  return rows.sort((a, b) => parseServerDate(b.time).getTime() - parseServerDate(a.time).getTime());
}

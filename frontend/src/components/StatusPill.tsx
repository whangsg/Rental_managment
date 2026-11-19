import type { RentalStatus, ReservationStatus } from "../api";

// 예약·대여 상태를 글자와 색으로 보여준다. (물품 상태는 Badge 사용)
const map: Record<ReservationStatus | RentalStatus, { label: string; tone: string }> = {
  pending: { label: "수령 대기", tone: "reserved" },
  fulfilled: { label: "수령 완료", tone: "rented" },
  cancelled: { label: "예약 취소", tone: "muted" },
  expired: { label: "예약 만료", tone: "muted" },
  renting: { label: "대여 중", tone: "available" },
  returned: { label: "반납 완료", tone: "rented" },
  overdue: { label: "연체", tone: "overdue" },
};

export default function StatusPill({ status }: { status: ReservationStatus | RentalStatus }) {
  const { label, tone } = map[status] ?? { label: status, tone: "muted" };
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

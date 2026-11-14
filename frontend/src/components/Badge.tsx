// 백엔드 Item.status = available / reserved / rented, 연체는 Rental.status = overdue
export type BadgeStatus = "available" | "reserved" | "rented" | "overdue";

const label: Record<BadgeStatus, string> = {
  available: "대여 가능",
  reserved: "예약됨",
  rented: "대여 중",
  overdue: "연체",
};

export default function Badge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" />
      {label[status]}
    </span>
  );
}

// 필드명은 백엔드 db-package/models.py 기준 (snake_case 그대로 사용)
export type ItemStatus = "available" | "reserved" | "rented";

export interface Item {
  id: number;
  name: string;
  category: string;
  description: string | null;
  status: ItemStatus;
  default_loan_days: number;
  rfid_uid?: string | null;
}

// GET /api/items 쿼리 (backend/routes/items.py)
//   category: 카테고리 일치, q: 이름 부분 검색, available: true=대여 가능만 / false=대여 불가만
export interface ItemQuery {
  category?: string;
  q?: string;
  available?: boolean;
}

// 예약 상태 (models.py Reservation.status)
export type ReservationStatus = "pending" | "fulfilled" | "cancelled" | "expired";

export interface Reservation {
  id: number;
  item_id: number;
  item_name: string | null;
  student_id: string;
  reserved_at: string; // ISO 문자열
  pickup_deadline: string; // 이 시각까지 수령(태깅)하지 않으면 자동 취소
  desired_loan_days: number;
  pickup_requested_at: string | null;
  status: ReservationStatus;
}

// POST /api/reservations 요청 본문
// TODO: 백엔드와 필드명 확정 필요 (현재는 models.py 필드명 item_id, desired_loan_days 로 가정)
export interface CreateReservationInput {
  item_id: number;
  desired_loan_days: number;
}

export interface User {
  student_id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  is_overdue: boolean;
}

export interface RegisterInput {
  student_id: string;
  name: string;
  email: string;
  password: string;
}

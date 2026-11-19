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
  reserved_at: string; // ISO 문자열 (백엔드는 시간대 표시 없는 UTC 시각을 보낸다 → utils/format.ts 의 parseServerDate 로 읽기)
  pickup_deadline: string; // 이 시각까지 수령(태깅)하지 않으면 자동 취소
  desired_loan_days: number;
  pickup_requested_at: string | null;
  status: ReservationStatus;
}

// POST /api/reservations 요청 본문 (backend/routes/reservations.py)
// desired_loan_days 를 빼면 백엔드가 물품의 default_loan_days 를 쓴다.
export interface CreateReservationInput {
  item_id: number;
  desired_loan_days?: number;
}

// 대여 상태 (models.py Rental.status)
export type RentalStatus = "renting" | "returned" | "overdue";

export interface Rental {
  id: number;
  item_id: number;
  item_name: string | null;
  student_id: string;
  rent_date: string;
  due_date: string; // 반납 기한
  return_date: string | null;
  status: RentalStatus;
}

// RFID 태깅 직후 생기는 본인 확인 대기 (models.py PendingConfirmation)
export interface PendingConfirmation {
  id: number;
  item_id: number;
  item_name: string | null;
  reservation_id: number;
  scanned_at: string;
  expires_at: string; // 이 시각까지 예/아니오를 누르지 않으면 만료
  status: "waiting" | "confirmed" | "rejected" | "expired";
}

// GET /api/reservations/me
export interface MyReservations {
  reservations: Reservation[];
  rentals: Rental[];
}

// POST /api/reservations/{id}/confirm
//   예(confirmed=true)  → { message, reservation, rental }
//   아니오(false)       → { message, reservation_status }
export interface ConfirmResult {
  message: string;
  reservation?: Reservation;
  rental?: Rental;
  reservation_status?: string;
}

// ---------- 알림 (models.py Notification) ----------
export type NotificationType = "overdue" | "reservation_expired";

export interface AppNotification {
  id: number;
  student_id: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ---------- 관리자 ----------
// 물품 등록·수정 요청 본문 (backend/routes/items.py 구현 완료)
export interface ItemInput {
  name: string;
  category: string;
  description?: string;
  rfid_uid?: string | null; // 비우면 null (태그 등록 전)
  default_loan_days?: number;
}

// 아래 관리자 API 응답 형식은 백엔드 미구현이라 가정한 값이다. (backend/routes/admin.py 확정 후 맞출 것)
// GET /api/admin/dashboard
export interface DashboardStats {
  total_items: number;
  available_items: number;
  reserved_items: number;
  rented_items: number;
  overdue_rentals: number;
}

// GET /api/admin/reservations  (내 내역과 같은 형태로 전체 사용자 것)
export interface AdminReservations {
  reservations: Reservation[];
  rentals: Rental[];
}

// GET /api/admin/overdue  (연체 대여 + 사용자 이름·이메일)
export interface OverdueRental extends Rental {
  name: string;
  email: string;
}

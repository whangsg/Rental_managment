import { ApiError } from "./client";
import type {
  ConfirmResult,
  CreateReservationInput,
  Item,
  ItemQuery,
  MyReservations,
  PendingConfirmation,
  Rental,
  Reservation,
  User,
} from "./types";

// 백엔드 없이 화면을 개발하기 위한 가짜 데이터와 가짜 API.
// 규칙은 backend/routes/*.py, backend/reservation_tasks.py 와 같게 맞춘다.
// 새로고침하면 처음 상태로 돌아간다.

const PICKUP_DEADLINE_HOURS = 24; // backend config.py PICKUP_DEADLINE_HOURS
const CONFIRMATION_TIMEOUT_SECONDS = 60; // backend config.py CONFIRMATION_TIMEOUT_SECONDS
const MOCK_TAG_DELAY_MS = 3000; // 수령하기를 누르고 이 시간 뒤에 "리더기에 태그를 찍은 것"으로 처리

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// 백엔드처럼 시간대 표시 없는 UTC 문자열로 만든다 (datetime.utcnow().isoformat() 과 같은 형태)
const serverTime = (ms: number) => new Date(ms).toISOString().slice(0, -1);
const parse = (s: string) => new Date(s + "Z").getTime();
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------- 계정 ----------
const TEST = "20230001";
const OVERDUE = "20230002";

const mockAccounts: (User & { password: string })[] = [
  { student_id: "00000000", name: "관리자", email: "admin@example.com", role: "admin", is_overdue: false, password: "admin1234" },
  { student_id: TEST, name: "테스트", email: "test@example.com", role: "user", is_overdue: false, password: "test1234" },
  // 연체 화면 확인용 계정: 연체 중이라 새 예약이 막힌다
  { student_id: OVERDUE, name: "연체자", email: "overdue@example.com", role: "user", is_overdue: true, password: "test1234" },
];

// ---------- 물품 (db-package/seed.py 기준) ----------
const mockItems: Item[] = [
  { id: 1, name: "드라이버 세트", category: "공구", description: "십자/일자 드라이버 8종", status: "available", default_loan_days: 14 },
  { id: 2, name: "전동 드릴", category: "공구", description: "Bosch 18V, 배터리 2개 포함", status: "reserved", default_loan_days: 7 },
  { id: 3, name: "DSLR 카메라", category: "전자기기", description: "Canon EOS, 렌즈 킷", status: "rented", default_loan_days: 3 },
  { id: 4, name: "농구공", category: "스포츠", description: "", status: "available", default_loan_days: 1 },
  { id: 5, name: "보드게임 카탄", category: "보드게임", description: "", status: "available", default_loan_days: 14 },
  { id: 6, name: "멀티미터", category: "실습장비", description: "", status: "available", default_loan_days: 14 },
  { id: 7, name: "테스트 물품 7", category: "테스트", description: "RFID 테스트용", status: "rented", default_loan_days: 14 },
  { id: 8, name: "테스트 물품 8", category: "테스트", description: "RFID 테스트용", status: "available", default_loan_days: 14 },
  { id: 9, name: "테스트 물품 9", category: "테스트", description: "RFID 테스트용", status: "available", default_loan_days: 14 },
];
const itemName = (id: number) => mockItems.find((i) => i.id === id)?.name ?? null;

// ---------- 예약 · 대여 (test 계정: 예약 1, 대여 1, 지난 내역 2 / overdue 계정: 연체 1) ----------
const start = Date.now();
const mockReservations: Reservation[] = [
  { id: 1, item_id: 2, item_name: "전동 드릴", student_id: TEST, reserved_at: serverTime(start - 2 * HOUR), pickup_deadline: serverTime(start + 22 * HOUR), desired_loan_days: 7, pickup_requested_at: null, status: "pending" },
  { id: 2, item_id: 3, item_name: "DSLR 카메라", student_id: TEST, reserved_at: serverTime(start - 1 * DAY - HOUR), pickup_deadline: serverTime(start + 23 * HOUR - DAY), desired_loan_days: 3, pickup_requested_at: null, status: "fulfilled" },
  { id: 3, item_id: 5, item_name: "보드게임 카탄", student_id: TEST, reserved_at: serverTime(start - 5 * DAY), pickup_deadline: serverTime(start - 4 * DAY), desired_loan_days: 14, pickup_requested_at: null, status: "expired" },
  { id: 4, item_id: 6, item_name: "멀티미터", student_id: TEST, reserved_at: serverTime(start - 30 * DAY - HOUR), pickup_deadline: serverTime(start - 29 * DAY), desired_loan_days: 14, pickup_requested_at: null, status: "fulfilled" },
  { id: 5, item_id: 7, item_name: "테스트 물품 7", student_id: OVERDUE, reserved_at: serverTime(start - 20 * DAY - HOUR), pickup_deadline: serverTime(start - 19 * DAY), desired_loan_days: 14, pickup_requested_at: null, status: "fulfilled" },
];
const mockRentals: Rental[] = [
  { id: 1, item_id: 3, item_name: "DSLR 카메라", student_id: TEST, rent_date: serverTime(start - 1 * DAY), due_date: serverTime(start + 2 * DAY), return_date: null, status: "renting" },
  { id: 2, item_id: 6, item_name: "멀티미터", student_id: TEST, rent_date: serverTime(start - 30 * DAY), due_date: serverTime(start - 16 * DAY), return_date: serverTime(start - 18 * DAY), status: "returned" },
  { id: 3, item_id: 7, item_name: "테스트 물품 7", student_id: OVERDUE, rent_date: serverTime(start - 20 * DAY), due_date: serverTime(start - 6 * DAY), return_date: null, status: "overdue" },
];
const mockConfirmations: PendingConfirmation[] = [];
let nextReservationId = mockReservations.length + 1;
let nextRentalId = mockRentals.length + 1;
let nextConfirmationId = 1;

// ---------- 로그인 ----------
// 로그인 상태는 새로고침하면 사라진다 (목 모드 한정)
let mockSession: User | null = null;

const strip = ({ password: _password, ...user }: User & { password: string }): User => user;

export function mockLogin(identifier: string, password: string): User {
  const id = identifier.trim().toLowerCase();
  const found = mockAccounts.find((a) => (a.email === id || a.student_id === id) && a.password === password);
  if (!found) throw new ApiError(401, "INVALID_CREDENTIALS", "이메일/학번 또는 비밀번호가 올바르지 않습니다.");
  mockSession = strip(found);
  return mockSession;
}

export function mockRegister(input: { student_id: string; name: string; email: string; password: string }): User {
  const email = input.email.trim().toLowerCase();
  if (mockAccounts.some((a) => a.email === email || a.student_id === input.student_id.trim())) {
    throw new ApiError(409, "USER_ALREADY_EXISTS", "이미 사용 중인 학번 또는 이메일입니다.");
  }
  const account = { student_id: input.student_id.trim(), name: input.name.trim(), email, role: "user" as const, is_overdue: false, password: input.password };
  mockAccounts.push(account);
  return strip(account);
}

export function mockLogout() {
  mockSession = null;
}

export function mockMe(): User {
  if (!mockSession) throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  return mockSession;
}

// ---------- 물품 ----------
export function mockListItems(query: ItemQuery = {}): Item[] {
  mockMe(); // 백엔드와 같이 로그인한 사용자만 조회 가능
  const q = query.q?.trim().toLowerCase();
  return copy(
    mockItems.filter(
      (i) =>
        (!query.category || i.category === query.category) &&
        (!q || i.name.toLowerCase().includes(q)) && // 백엔드와 같이 이름으로만 검색
        (query.available === undefined || (i.status === "available") === query.available),
    ),
  );
}

export function mockGetItem(id: number): Item {
  mockMe();
  const item = mockItems.find((i) => i.id === id);
  if (!item) throw new ApiError(404, "ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.");
  return copy(item);
}

// ---------- 만료 처리 (backend/reservation_tasks.py 와 같은 규칙) ----------
function expireAll(now = Date.now()) {
  for (const r of mockReservations) {
    if (r.status === "pending" && parse(r.pickup_deadline) <= now) {
      r.status = "expired";
      const item = mockItems.find((i) => i.id === r.item_id);
      if (item?.status === "reserved") item.status = "available";
      mockConfirmations.filter((c) => c.reservation_id === r.id && c.status === "waiting").forEach((c) => (c.status = "expired"));
    }
  }
  for (const c of mockConfirmations) {
    if (c.status === "waiting" && parse(c.expires_at) <= now) {
      c.status = "expired";
      const r = mockReservations.find((x) => x.id === c.reservation_id);
      if (r) r.pickup_requested_at = null;
    }
  }
}

function ownPendingReservation(id: number, user: User, action: string) {
  const r = mockReservations.find((x) => x.id === id);
  if (!r) throw new ApiError(404, "RESERVATION_NOT_FOUND", "예약을 찾을 수 없습니다.");
  if (r.student_id !== user.student_id) throw new ApiError(403, "FORBIDDEN", `본인의 예약만 ${action}할 수 있습니다.`);
  return r;
}

// ---------- 예약 ----------
export function mockCreateReservation(input: CreateReservationInput): Reservation {
  const user = mockMe();
  if (user.is_overdue) throw new ApiError(403, "USER_OVERDUE", "연체 중인 사용자는 예약할 수 없습니다.");
  const item = mockItems.find((i) => i.id === input.item_id);
  if (!item) throw new ApiError(404, "ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.");
  const days = input.desired_loan_days ?? item.default_loan_days;
  if (!Number.isInteger(days) || days < 1) throw new ApiError(400, "INVALID_LOAN_DAYS", "대여 일수는 1 이상의 정수여야 합니다.");
  if (item.status !== "available") throw new ApiError(409, "ITEM_UNAVAILABLE", "현재 예약할 수 없는 물품입니다.");
  const now = Date.now();
  const reservation: Reservation = {
    id: nextReservationId++,
    item_id: item.id,
    item_name: item.name,
    student_id: user.student_id,
    reserved_at: serverTime(now),
    pickup_deadline: serverTime(now + PICKUP_DEADLINE_HOURS * HOUR),
    desired_loan_days: days,
    pickup_requested_at: null,
    status: "pending",
  };
  item.status = "reserved";
  mockReservations.push(reservation);
  return copy(reservation);
}

export function mockMyReservations(): MyReservations {
  const user = mockMe();
  expireAll();
  const mine = <T extends { student_id: string }>(list: T[]) => list.filter((x) => x.student_id === user.student_id);
  return copy({
    reservations: mine(mockReservations).sort((a, b) => parse(b.reserved_at) - parse(a.reserved_at)),
    rentals: mine(mockRentals).sort((a, b) => parse(b.rent_date) - parse(a.rent_date)),
  });
}

export function mockCancelReservation(id: number) {
  const user = mockMe();
  expireAll();
  const r = ownPendingReservation(id, user, "취소");
  if (r.status === "expired") throw new ApiError(409, "RESERVATION_EXPIRED", "이미 만료된 예약입니다.");
  if (r.status !== "pending") throw new ApiError(409, "INVALID_RESERVATION_STATUS", "취소할 수 없는 예약입니다.");
  r.status = "cancelled";
  r.pickup_requested_at = null;
  const item = mockItems.find((i) => i.id === r.item_id);
  if (item?.status === "reserved") item.status = "available";
  mockConfirmations.filter((c) => c.reservation_id === r.id && c.status === "waiting").forEach((c) => (c.status = "expired"));
  return copy({ message: "예약이 취소되었습니다.", reservation: r });
}

export function mockPickupRequest(id: number) {
  const user = mockMe();
  expireAll();
  const r = ownPendingReservation(id, user, "수령");
  if (r.status !== "pending") throw new ApiError(409, "INVALID_RESERVATION_STATUS", "수령할 수 없는 예약입니다.");
  if (mockConfirmations.some((c) => c.reservation_id === r.id && c.status === "waiting")) {
    throw new ApiError(409, "CONFIRMATION_IN_PROGRESS", "이미 본인 확인이 진행 중입니다.");
  }
  const now = Date.now();
  r.pickup_requested_at = serverTime(now);

  // 실제로는 ESP32 가 POST /api/device/tag 를 보내면 서버가 본인 확인 대기를 만든다.
  // 목 모드에서는 몇 초 뒤 태그를 찍은 것으로 처리한다.
  setTimeout(() => {
    if (r.status !== "pending" || !r.pickup_requested_at) return;
    const scanned = Date.now();
    mockConfirmations.push({
      id: nextConfirmationId++,
      item_id: r.item_id,
      item_name: r.item_name,
      reservation_id: r.id,
      scanned_at: serverTime(scanned),
      expires_at: serverTime(scanned + CONFIRMATION_TIMEOUT_SECONDS * 1000),
      status: "waiting",
    });
  }, MOCK_TAG_DELAY_MS);

  return { message: "RFID 태깅을 기다리는 중입니다.", reservation_id: r.id, pickup_requested_at: r.pickup_requested_at };
}

export function mockPendingConfirm(): { pending_confirmation: PendingConfirmation | null } {
  const user = mockMe();
  expireAll();
  const mineIds = new Set(mockReservations.filter((r) => r.student_id === user.student_id).map((r) => r.id));
  const waiting = mockConfirmations
    .filter((c) => c.status === "waiting" && mineIds.has(c.reservation_id))
    .sort((a, b) => parse(b.scanned_at) - parse(a.scanned_at))[0];
  return { pending_confirmation: waiting ? copy(waiting) : null };
}

export function mockConfirm(id: number, confirmed: boolean): ConfirmResult {
  const user = mockMe();
  expireAll();
  const r = ownPendingReservation(id, user, "확인");
  if (r.status !== "pending") throw new ApiError(409, "INVALID_RESERVATION_STATUS", "처리할 수 없는 예약입니다.");
  const c = mockConfirmations.filter((x) => x.reservation_id === r.id && x.status === "waiting").pop();
  if (!c) throw new ApiError(404, "CONFIRMATION_NOT_FOUND", "유효한 본인 확인 요청이 없습니다.");

  if (!confirmed) {
    c.status = "rejected";
    r.pickup_requested_at = null;
    return { message: "본인 확인이 거부되었습니다.", reservation_status: r.status };
  }

  const item = mockItems.find((i) => i.id === r.item_id);
  if (item?.status !== "reserved") throw new ApiError(409, "ITEM_STATUS_CONFLICT", "물품 상태가 변경되었습니다.");
  const now = Date.now();
  item.status = "rented";
  r.status = "fulfilled";
  r.pickup_requested_at = null;
  c.status = "confirmed";
  const rental: Rental = {
    id: nextRentalId++,
    item_id: r.item_id,
    item_name: itemName(r.item_id),
    student_id: user.student_id,
    rent_date: serverTime(now),
    due_date: serverTime(now + r.desired_loan_days * DAY),
    return_date: null,
    status: "renting",
  };
  mockRentals.push(rental);
  return copy({ message: "대여가 완료되었습니다.", reservation: r, rental });
}

// ---------- 공통 ----------
export const delay = <T,>(value: T, ms = 150) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// 목 함수를 실제 API처럼 비동기로 실행한다. 목 함수가 던진 에러는 rejected Promise 가 된다.
// (delay(mockMe()) 처럼 쓰면 에러가 Promise 밖에서 바로 터져 .catch 로 잡히지 않는다)
export const mockCall = <T,>(fn: () => T, ms = 150) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, ms),
  );

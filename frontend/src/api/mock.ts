import { ApiError } from "./client";
import type { CreateReservationInput, Item, ItemQuery, Reservation, User } from "./types";

// 백엔드가 준비되기 전까지 쓰는 가짜 데이터 (db-package/seed.py 기준).
// 화면 확인용으로 일부 물품은 예약됨/대여 중 상태로 둔다.
const mockItems: Item[] = [
  { id: 1, name: "드라이버 세트", category: "공구", description: "십자/일자 드라이버 8종", status: "available", default_loan_days: 14 },
  { id: 2, name: "전동 드릴", category: "공구", description: "Bosch 18V, 배터리 2개 포함", status: "reserved", default_loan_days: 7 },
  { id: 3, name: "DSLR 카메라", category: "전자기기", description: "Canon EOS, 렌즈 킷", status: "rented", default_loan_days: 3 },
  { id: 4, name: "농구공", category: "스포츠", description: "", status: "available", default_loan_days: 1 },
  { id: 5, name: "보드게임 카탄", category: "보드게임", description: "", status: "available", default_loan_days: 14 },
  { id: 6, name: "멀티미터", category: "실습장비", description: "", status: "available", default_loan_days: 14 },
  { id: 7, name: "테스트 물품 7", category: "테스트", description: "RFID 테스트용", status: "available", default_loan_days: 14 },
  { id: 8, name: "테스트 물품 8", category: "테스트", description: "RFID 테스트용", status: "available", default_loan_days: 14 },
  { id: 9, name: "테스트 물품 9", category: "테스트", description: "RFID 테스트용", status: "available", default_loan_days: 14 },
];

const mockReservations: Reservation[] = [];
let nextReservationId = 1;
const PICKUP_DEADLINE_HOURS = 24; // backend config.py 의 PICKUP_DEADLINE_HOURS 와 같은 값

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

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

export function mockCreateReservation(input: CreateReservationInput): Reservation {
  const user = mockMe();
  const item = mockItems.find((i) => i.id === input.item_id);
  if (!item) throw new ApiError(404, "ITEM_NOT_FOUND", "물품을 찾을 수 없습니다.");
  if (item.status !== "available") throw new ApiError(409, "ITEM_NOT_AVAILABLE", "이미 예약되었거나 대여 중인 물품입니다.");
  if (!Number.isInteger(input.desired_loan_days) || input.desired_loan_days < 1 || input.desired_loan_days > item.default_loan_days) {
    throw new ApiError(400, "INVALID_LOAN_DAYS", `대여 일수는 1~${item.default_loan_days}일 사이여야 합니다.`);
  }
  const now = new Date();
  const reservation: Reservation = {
    id: nextReservationId++,
    item_id: item.id,
    item_name: item.name,
    student_id: user.student_id,
    reserved_at: now.toISOString(),
    pickup_deadline: new Date(now.getTime() + PICKUP_DEADLINE_HOURS * 3600_000).toISOString(),
    desired_loan_days: input.desired_loan_days,
    pickup_requested_at: null,
    status: "pending",
  };
  item.status = "reserved";
  mockReservations.push(reservation);
  return copy(reservation);
}

// 목 모드 전용 계정 (실제 백엔드를 쓸 때는 db-package/seed.py 의 계정을 사용)
const mockAccounts: (User & { password: string })[] = [
  { student_id: "00000000", name: "관리자", email: "admin@example.com", role: "admin", is_overdue: false, password: "admin1234" },
  { student_id: "20230001", name: "테스트", email: "test@example.com", role: "user", is_overdue: false, password: "test1234" },
];

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

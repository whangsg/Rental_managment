import { ApiError } from "./client";
import type { Item, User } from "./types";

// 백엔드가 준비되기 전까지 쓰는 가짜 데이터 (db-package/seed.py 기준)
export const mockItems: Item[] = [
  { id: 1, name: "드라이버 세트", category: "공구", description: "정밀 드라이버 세트", status: "available", default_loan_days: 14 },
  { id: 2, name: "전동 드릴", category: "공구", description: "충전식 전동 드릴", status: "reserved", default_loan_days: 7 },
  { id: 3, name: "DSLR 카메라", category: "전자기기", description: "DSLR 카메라 바디", status: "rented", default_loan_days: 3 },
  { id: 4, name: "농구공", category: "스포츠", description: null, status: "available", default_loan_days: 1 },
  { id: 5, name: "보드게임 카탄", category: "보드게임", description: null, status: "available", default_loan_days: 14 },
  { id: 6, name: "멀티미터", category: "실습장비", description: null, status: "available", default_loan_days: 14 },
];

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

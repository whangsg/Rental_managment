import { request } from "./client";
import { delay, mockCall, mockItems, mockLogin, mockLogout, mockMe, mockRegister } from "./mock";
import type { Item, RegisterInput, User } from "./types";

// .env 의 VITE_USE_MOCK=false 로 바꾸면 실제 백엔드(/api)를 호출한다.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const api = {
  auth: {
    // 백엔드(backend/routes/auth.py)와 같은 응답 형태: 로그인·내 정보는 { user }, 회원가입은 user 자체
    register: (input: RegisterInput) =>
      USE_MOCK ? mockCall(() => mockRegister(input)) : request<User>("/api/auth/register", { method: "POST", body: input }),
    // 로그인 식별자는 이메일 또는 학번. 백엔드는 body.email 에 둘 중 무엇이든 받는다.
    login: (identifier: string, password: string) =>
      USE_MOCK
        ? mockCall(() => ({ user: mockLogin(identifier, password) }))
        : request<{ user: User }>("/api/auth/login", { method: "POST", body: { email: identifier, password } }),
    logout: () =>
      USE_MOCK ? mockCall(() => mockLogout()) : request<unknown>("/api/auth/logout", { method: "POST" }),
    me: () => (USE_MOCK ? mockCall(() => ({ user: mockMe() })) : request<{ user: User }>("/api/auth/me")),
  },
  items: {
    list: () => (USE_MOCK ? delay(mockItems) : request<Item[]>("/api/items")),
    get: (id: number) =>
      USE_MOCK
        ? delay(mockItems.find((i) => i.id === id) ?? null)
        : request<Item>(`/api/items/${id}`),
  },
  // TODO: reservations(예약·취소), me(내 예약·대여), notifications, admin,
  //       me.pendingConfirm(본인 확인 폴링: GET /api/me/pending-confirm 을 2초마다) 은 각 기능 브랜치에서 추가
};

export * from "./types";
export { ApiError } from "./client";

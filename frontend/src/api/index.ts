import { request } from "./client";
import { delay, mockItems, mockUser } from "./mock";
import type { Item, User } from "./types";

// .env 의 VITE_USE_MOCK=false 로 바꾸면 실제 백엔드(/api)를 호출한다.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const api = {
  auth: {
    // TODO: 백엔드 /api/auth 확정 후 경로·필드 확인 (로그인 식별자: 이메일 vs 학번)
    login: (email: string, password: string) =>
      USE_MOCK ? delay(mockUser) : request<User>("/api/auth/login", { method: "POST", body: { email, password } }),
    logout: () => (USE_MOCK ? delay(null) : request<null>("/api/auth/logout", { method: "POST" })),
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

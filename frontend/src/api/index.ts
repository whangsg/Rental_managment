import { request } from "./client";
import {
  mockAdminReservations,
  mockCall,
  mockCancelReservation,
  mockConfirm,
  mockCreateItem,
  mockCreateReservation,
  mockDashboard,
  mockDeleteItem,
  mockMyReservations,
  mockOverdue,
  mockPendingConfirm,
  mockPickupRequest,
  mockGetItem,
  mockListItems,
  mockLogin,
  mockLogout,
  mockMarkRead,
  mockMe,
  mockMyNotifications,
  mockRegister,
  mockUpdateItem,
} from "./mock";
import type {
  AdminReservations,
  AppNotification,
  ConfirmResult,
  CreateReservationInput,
  DashboardStats,
  Item,
  ItemInput,
  ItemQuery,
  MyReservations,
  OverdueRental,
  PendingConfirmation,
  RegisterInput,
  Reservation,
  User,
} from "./types";

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
    // GET /api/items?category=&q=&available=true|false  (백엔드 구현 완료: backend/routes/items.py)
    list: (query: ItemQuery = {}) => {
      if (USE_MOCK) return mockCall(() => mockListItems(query));
      const params = new URLSearchParams();
      if (query.category) params.set("category", query.category);
      if (query.q) params.set("q", query.q);
      if (query.available !== undefined) params.set("available", String(query.available));
      const qs = params.toString();
      return request<Item[]>(`/api/items${qs ? `?${qs}` : ""}`);
    },
    get: (id: number) => (USE_MOCK ? mockCall(() => mockGetItem(id)) : request<Item>(`/api/items/${id}`)),
    // 관리자: 등록·수정·삭제 (백엔드 구현 완료)
    create: (data: ItemInput) =>
      USE_MOCK ? mockCall(() => mockCreateItem(data)) : request<Item>("/api/items", { method: "POST", body: data }),
    update: (id: number, data: Partial<ItemInput>) =>
      USE_MOCK ? mockCall(() => mockUpdateItem(id, data)) : request<Item>(`/api/items/${id}`, { method: "PUT", body: data }),
    remove: (id: number) =>
      USE_MOCK
        ? mockCall(() => mockDeleteItem(id))
        : request<{ message: string }>(`/api/items/${id}`, { method: "DELETE" }),
  },
  // 예약·대여 (백엔드 구현 완료: backend/routes/reservations.py)
  reservations: {
    // 예약 신청
    create: (input: CreateReservationInput) =>
      USE_MOCK
        ? mockCall(() => mockCreateReservation(input))
        : request<Reservation>("/api/reservations", { method: "POST", body: input }),
    // 내 예약·대여 내역
    mine: () => (USE_MOCK ? mockCall(() => mockMyReservations()) : request<MyReservations>("/api/reservations/me")),
    // 예약 취소 (수령 전 pending 예약만)
    cancel: (id: number) =>
      USE_MOCK
        ? mockCall(() => mockCancelReservation(id))
        : request<{ message: string; reservation: Reservation }>(`/api/reservations/${id}/cancel`, { method: "POST" }),
    // '수령하기' 버튼: 태깅 대기 시작
    pickupRequest: (id: number) =>
      USE_MOCK
        ? mockCall(() => mockPickupRequest(id))
        : request<{ message: string; reservation_id: number; pickup_requested_at: string }>(
            `/api/reservations/${id}/pickup-request`,
            { method: "POST" },
          ),
    // 폴링용: 태깅 후 본인 확인을 기다리는 건이 있는지
    pendingConfirm: () =>
      USE_MOCK
        ? mockCall(() => mockPendingConfirm(), 80)
        : request<{ pending_confirmation: PendingConfirmation | null }>("/api/me/pending-confirm"),
    // 본인 확인 예(true) / 아니오(false)
    confirm: (id: number, confirmed: boolean) =>
      USE_MOCK
        ? mockCall(() => mockConfirm(id, confirmed))
        : request<ConfirmResult>(`/api/reservations/${id}/confirm`, { method: "POST", body: { confirmed } }),
  },
  // 알림 (백엔드 미구현: backend/routes/notifications.py. 응답은 알림 배열로 가정)
  notifications: {
    mine: () => (USE_MOCK ? mockCall(() => mockMyNotifications()) : request<AppNotification[]>("/api/notifications/me")),
    markRead: (id: number) =>
      USE_MOCK
        ? mockCall(() => mockMarkRead(id), 80)
        : request<AppNotification>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  },
  // 관리자 (백엔드 미구현: backend/routes/admin.py. 응답 형식은 types.ts 의 가정 참고)
  admin: {
    dashboard: () => (USE_MOCK ? mockCall(() => mockDashboard()) : request<DashboardStats>("/api/admin/dashboard")),
    reservations: () =>
      USE_MOCK ? mockCall(() => mockAdminReservations()) : request<AdminReservations>("/api/admin/reservations"),
    overdue: () => (USE_MOCK ? mockCall(() => mockOverdue()) : request<OverdueRental[]>("/api/admin/overdue")),
  },
};

export * from "./types";
export { ApiError } from "./client";

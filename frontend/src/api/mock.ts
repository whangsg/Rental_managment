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

export const mockUser: User = {
  student_id: "20231234",
  name: "테스트",
  email: "test@example.com",
  role: "user",
  is_overdue: false,
};

export const delay = <T,>(value: T, ms = 150) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

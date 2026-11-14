// 필드명은 백엔드 db-package/models.py 기준 (snake_case 그대로 사용)
export type ItemStatus = "available" | "reserved" | "rented";

export interface Item {
  id: number;
  name: string;
  category: string;
  description: string | null;
  status: ItemStatus;
  default_loan_days: number;
}

export interface User {
  student_id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  is_overdue: boolean;
}

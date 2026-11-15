import { ApiError } from "../api";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "11월 16일 (월) 15:30"
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]}) ${hh}:${mm}`;
}

// 화면에 보여줄 에러 문구. 백엔드가 준 메시지를 우선 사용한다.
export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 404 && e.code === "NOT_FOUND") return "아직 준비되지 않은 기능입니다. (백엔드 API 없음)";
    if (e.status === 501) return "아직 준비되지 않은 기능입니다. (백엔드 미구현)";
    return e.message;
  }
  return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

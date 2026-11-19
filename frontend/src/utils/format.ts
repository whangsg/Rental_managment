import { ApiError } from "../api";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY = 24 * 3600_000;

// 백엔드는 UTC 시각을 시간대 표시 없이 보낸다 (datetime.utcnow().isoformat() → "2026-11-19T01:02:03.123456").
// 그대로 new Date() 에 넣으면 한국 시간으로 잘못 읽혀 9시간 차이가 나므로 UTC 로 읽는다.
export function parseServerDate(value: string) {
  let s = value.replace(/(\.\d{3})\d+/, "$1"); // 소수점 아래 6자리 → 3자리
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += "Z";
  return new Date(s);
}

const pad = (n: number) => String(n).padStart(2, "0");

// "11월 16일 (월)"
export function formatDate(iso: string) {
  const d = parseServerDate(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// "11월 16일 (월) 15:30"
export function formatDateTime(iso: string) {
  const d = parseServerDate(iso);
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 남은 시간: "18시간 20분 남음" / "35분 남음" / "기한 지남"
export function remainingText(untilIso: string, now = Date.now()) {
  const ms = parseServerDate(untilIso).getTime() - now;
  if (ms <= 0) return "기한 지남";
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분 남음` : `${m}분 남음`;
}

// 반납 기한까지 남은 날짜(달력 기준). 양수: 남음, 0: 오늘, 음수: 지남
export function daysUntil(iso: string, now = Date.now()) {
  const due = parseServerDate(iso);
  const today = new Date(now);
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / DAY);
}

// "D-6" / "오늘까지" / "3일 지남"
export function dueText(iso: string, now = Date.now()) {
  const d = daysUntil(iso, now);
  if (d > 0) return `D-${d}`;
  if (d === 0) return "오늘까지";
  return `${-d}일 지남`;
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

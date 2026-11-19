import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY = 24 * 3600_000;

// 자정 기준 날짜 (시간 제거)
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);
const label = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;

// 대여 기간을 달력으로 보여주고, 날짜를 누르면 그날을 반납일로 하는 대여 일수를 고른다.
// 오늘 수령한다고 가정한 예상 기간이다. (실제 반납 기한은 수령한 시각 + 대여 일수로 백엔드가 정한다)
export default function LoanCalendar({
  days,
  maxDays,
  onChange,
}: {
  days: number;
  maxDays: number;
  onChange: (days: number) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const returnDay = addDays(today, days);
  const lastDay = addDays(today, maxDays);

  // 처음에는 반납일이 있는 달을 보여준다
  const [month, setMonth] = useState(() => new Date(returnDay.getFullYear(), returnDay.getMonth(), 1));
  // −/+ 로 일수를 바꿔 반납일이 다른 달로 넘어가면 그 달을 보여준다
  useEffect(() => {
    setMonth(new Date(returnDay.getFullYear(), returnDay.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;

  // 달력 칸: 앞쪽 빈칸 + 그 달의 날짜
  const cells = useMemo(() => {
    const lead = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const move = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="loan-calendar">
      <div className="flex items-center justify-between">
        <button type="button" className="icon-button" aria-label="이전 달" disabled={!canPrev} onClick={() => move(-1)}>
          <Icon name="arrow" size={18} />
        </button>
        <span className="text-sm font-bold">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </span>
        <button type="button" className="icon-button" aria-label="다음 달" disabled={!canNext} onClick={() => move(1)}>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label="반납일 선택">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`calendar-weekday ${i === 0 ? "text-[#c45656]" : ""}`} aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const n = diffDays(d, today); // 오늘부터 며칠 뒤인지
          const isToday = n === 0;
          const isReturn = n === days;
          const inRange = n > 0 && n < days;
          const selectable = n >= 1 && n <= maxDays;
          const cls = [
            "calendar-day",
            inRange ? "in-range" : "",
            isToday ? "is-start" : "",
            isReturn ? "is-end" : "",
            !selectable && !isToday ? "is-disabled" : "",
            i % 7 === 0 ? "row-first" : "", // 줄 바뀜에서 기간 띠 모서리를 둥글게
            i % 7 === 6 ? "row-last" : "",
          ].join(" ");
          return (
            <button
              key={n}
              type="button"
              className={cls}
              disabled={!selectable}
              aria-pressed={isReturn}
              aria-label={`${label(d)}${isToday ? " 수령 예정일" : ""}${selectable ? `, 반납일로 선택하면 ${n}일 대여` : ""}`}
              onClick={() => onChange(n)}
            >
              <span>{d.getDate()}</span>
              {isToday && <small>수령</small>}
              {isReturn && <small>반납</small>}
            </button>
          );
        })}
      </div>

      <p className="calendar-summary">
        <b>{label(today)}</b> 수령 → <b>{label(returnDay)}</b> 반납 · {days}일
      </p>
      <p className="text-center text-xs text-[#84908b]">오늘 수령 기준 예상 기간이에요. 날짜를 눌러 반납일을 고를 수 있어요.</p>
    </div>
  );
}

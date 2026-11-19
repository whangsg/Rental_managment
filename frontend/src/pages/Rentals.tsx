import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type MyReservations, type PendingConfirmation, type Rental, type Reservation } from "../api";
import { useAuth } from "../auth/AuthContext";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Icon from "../components/Icon";
import TopBar from "../components/TopBar";
import VerifyModal, { type VerifyOutcome } from "../components/VerifyModal";
import { dueText, errorMessage, formatDate, formatDateTime, parseServerDate, remainingText } from "../utils/format";

const POLL_MS = 2000; // 본인 확인 대기 조회 간격

type Tab = "current" | "past";
type Notice = { tone: "success" | "info" | "error"; text: string };

export default function Rentals() {
  const { user } = useAuth();
  const [data, setData] = useState<MyReservations | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("current");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [cancelAskId, setCancelAskId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const handled = useRef(new Set<number>()); // 이미 답한 본인 확인은 다시 띄우지 않는다
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setData(await api.reservations.mine());
      setLoadError("");
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    // 남은 시간 표시를 1분마다 갱신
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  // 수령하기를 눌러 태깅을 기다리는 예약이 있으면, 본인 확인 대기가 생겼는지 2초마다 확인한다.
  const waiting = data?.reservations.some((r) => r.status === "pending" && r.pickup_requested_at) ?? false;
  useEffect(() => {
    if (!waiting || pending) return;
    let stopped = false;
    const check = async () => {
      try {
        const { pending_confirmation: pc } = await api.reservations.pendingConfirm();
        if (!stopped && pc && !handled.current.has(pc.id)) setPending(pc);
      } catch {
        // 일시적인 오류는 다음 확인 때 다시 시도한다.
      }
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [waiting, pending]);

  const { current, past, hasOverdue } = useMemo(() => split(data), [data]);

  const run = async (id: number, action: () => Promise<void>) => {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const requestPickup = (r: Reservation) =>
    run(r.id, async () => {
      await api.reservations.pickupRequest(r.id);
      setNotice({ tone: "info", text: `리더기에 '${r.item_name}'의 RFID 태그를 찍어주세요.` });
    });

  const cancel = (r: Reservation) =>
    run(r.id, async () => {
      setCancelAskId(null);
      await api.reservations.cancel(r.id);
      setNotice({ tone: "success", text: `'${r.item_name}' 예약을 취소했어요.` });
    });

  const onVerifyDone = async (outcome: VerifyOutcome) => {
    if (pending) handled.current.add(pending.id);
    setPending(null);
    if (outcome.type === "confirmed") {
      const due = outcome.result.rental?.due_date;
      setNotice({ tone: "success", text: `대여가 시작되었어요.${due ? ` 반납 기한은 ${formatDateTime(due)}입니다.` : ""}` });
    } else if (outcome.type === "rejected") {
      setNotice({ tone: "info", text: "본인 확인을 거절했어요. 다시 받으려면 수령하기를 눌러주세요." });
    } else {
      setNotice({ tone: "error", text: "확인 시간이 지났어요. 다시 받으려면 수령하기를 눌러주세요." });
    }
    await load();
  };

  const pendingReservation = pending ? data?.reservations.find((r) => r.id === pending.reservation_id) : undefined;

  return (
    <>
      <TopBar title="내 대여" />
      <div className="tabs" role="tablist" aria-label="내 대여 보기">
        <button type="button" role="tab" aria-selected={tab === "current"} className={tab === "current" ? "active" : ""} onClick={() => setTab("current")}>
          진행 중{data ? ` ${current.length}` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "past"} className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>
          지난 내역
        </button>
      </div>

      <main className="mobile-main flex flex-col gap-3">
        {(hasOverdue || user?.is_overdue) && (
          <div className="overdue-banner" role="alert">
            <Icon name="warning" size={18} />
            <p>연체 중인 물품이 있어 반납 전까지 새 예약이 제한됩니다.</p>
          </div>
        )}

        {notice && (
          <div className={`page-notice page-notice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            <p>{notice.text}</p>
            <button type="button" className="icon-button h-7 w-7" aria-label="알림 닫기" onClick={() => setNotice(null)}>
              <Icon name="plus" size={16} className="rotate-45" />
            </button>
          </div>
        )}

        {loadError ? (
          <div className="state-box" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button button-secondary" onClick={load}>
              다시 시도
            </button>
          </div>
        ) : !data ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
            {[0, 1].map((k) => (
              <div key={k} className="h-[150px] animate-pulse rounded-2xl bg-[#eef1f0]" />
            ))}
          </div>
        ) : tab === "current" ? (
          current.length === 0 ? (
            <div className="state-box">
              <p>진행 중인 예약이나 대여가 없어요.</p>
              <Link to="/items" className="button button-secondary">
                물품 보러 가기
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {current.map((entry) =>
                entry.kind === "reservation" ? (
                  <li key={`r${entry.value.id}`}>
                    <ReservationCard
                      r={entry.value}
                      now={now}
                      busy={busyId === entry.value.id}
                      askingCancel={cancelAskId === entry.value.id}
                      onPickup={() => requestPickup(entry.value)}
                      onAskCancel={(ask) => setCancelAskId(ask ? entry.value.id : null)}
                      onCancel={() => cancel(entry.value)}
                    />
                  </li>
                ) : (
                  <li key={`l${entry.value.id}`}>
                    <RentalCard rental={entry.value} now={now} />
                  </li>
                ),
              )}
            </ul>
          )
        ) : past.length === 0 ? (
          <div className="state-box">
            <p>지난 내역이 없어요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {past.map((entry) => (
              <li key={`${entry.kind}${entry.value.id}`}>
                <HistoryRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {pending && (
        <VerifyModal confirmation={pending} user={user} loanDays={pendingReservation?.desired_loan_days} onDone={onVerifyDone} />
      )}
    </>
  );
}

// ---------- 목록 나누기 ----------
type Entry = { kind: "reservation"; value: Reservation } | { kind: "rental"; value: Rental };

function split(data: MyReservations | null) {
  if (!data) return { current: [] as Entry[], past: [] as Entry[], hasOverdue: false };
  const t = (s: string) => parseServerDate(s).getTime();

  // 진행 중: 연체 → 수령 대기 예약 → 대여 중 순서
  const overdue = data.rentals.filter((l) => l.status === "overdue");
  const renting = data.rentals.filter((l) => l.status === "renting");
  const pendingRes = data.reservations.filter((r) => r.status === "pending");
  const current: Entry[] = [
    ...overdue.map((value) => ({ kind: "rental" as const, value })),
    ...pendingRes.map((value) => ({ kind: "reservation" as const, value })),
    ...renting.map((value) => ({ kind: "rental" as const, value })),
  ];

  // 지난 내역: 취소·만료된 예약 + 반납한 대여 (수령까지 된 예약은 대여 기록으로 보여준다)
  const past: Entry[] = [
    ...data.reservations.filter((r) => r.status === "cancelled" || r.status === "expired").map((value) => ({ kind: "reservation" as const, value })),
    ...data.rentals.filter((l) => l.status === "returned").map((value) => ({ kind: "rental" as const, value })),
  ].sort((a, b) => entryTime(b, t) - entryTime(a, t));

  return { current, past, hasOverdue: overdue.length > 0 };
}

function entryTime(e: Entry, t: (s: string) => number) {
  return e.kind === "reservation" ? t(e.value.reserved_at) : t(e.value.return_date ?? e.value.rent_date);
}

// ---------- 카드 ----------
function ReservationCard({
  r,
  now,
  busy,
  askingCancel,
  onPickup,
  onAskCancel,
  onCancel,
}: {
  r: Reservation;
  now: number;
  busy: boolean;
  askingCancel: boolean;
  onPickup: () => void;
  onAskCancel: (ask: boolean) => void;
  onCancel: () => void;
}) {
  const waitingTag = !!r.pickup_requested_at;
  return (
    <article className="rental-card">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold">{r.item_name}</h3>
        <span className="badge badge-reserved">
          <span className="badge-dot" />
          수령 대기
        </span>
      </div>
      <p className="rental-meta">
        수령 기한 {formatDateTime(r.pickup_deadline)} <b>({remainingText(r.pickup_deadline, now)})</b>
        <br />
        대여 일수 {r.desired_loan_days}일
      </p>

      {waitingTag ? (
        <div className="waiting-box" role="status">
          <span className="pulse-dot" aria-hidden="true" />
          <div>
            <p className="font-bold">태그를 기다리는 중...</p>
            <p className="text-xs">리더기에 물품의 RFID 태그를 찍으면 본인 확인 창이 떠요.</p>
          </div>
        </div>
      ) : (
        <Button className="w-full" disabled={busy} onClick={onPickup}>
          {busy ? "처리 중..." : "수령하기"}
        </Button>
      )}

      {askingCancel ? (
        <div className="cancel-ask">
          <p>예약을 취소할까요?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => onAskCancel(false)}>
              아니요
            </Button>
            <Button variant="danger" disabled={busy} onClick={onCancel}>
              예약 취소
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" disabled={busy} onClick={() => onAskCancel(true)}>
          예약 취소
        </Button>
      )}

      {!waitingTag && <p className="text-xs text-[#84908b]">수령하기를 누른 뒤 리더기에 RFID 태그를 찍어주세요.</p>}
    </article>
  );
}

function RentalCard({ rental, now }: { rental: Rental; now: number }) {
  const overdue = rental.status === "overdue";
  return (
    <article className={`rental-card ${overdue ? "rental-card-overdue" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold">{rental.item_name}</h3>
        <Badge status={overdue ? "overdue" : "rented"} />
      </div>
      <p className="rental-meta">
        대여일 {formatDate(rental.rent_date)}
        <br />
        반납 기한 {formatDate(rental.due_date)}{" "}
        <b className={overdue ? "text-[#b84343]" : "text-[var(--brand)]"}>({dueText(rental.due_date, now)})</b>
      </p>
      <p className="text-xs text-[#84908b]">
        {overdue ? "빨리 반납해주세요. " : ""}반납할 때는 리더기에 물품의 RFID 태그만 찍으면 돼요.
      </p>
    </article>
  );
}

function HistoryRow({ entry }: { entry: Entry }) {
  let label: string;
  let detail: string;
  if (entry.kind === "reservation") {
    const r = entry.value;
    label = r.status === "cancelled" ? "예약 취소" : "예약 만료";
    detail = r.status === "cancelled" ? `${formatDate(r.reserved_at)} 예약` : `수령 기한 ${formatDate(r.pickup_deadline)} 지남`;
  } else {
    const l = entry.value;
    label = "반납 완료";
    detail = `${formatDate(l.rent_date)} ~ ${l.return_date ? formatDate(l.return_date) : ""}`;
  }
  return (
    <div className="history-row">
      <div className="min-w-0">
        <p className="truncate font-semibold">{entry.value.item_name}</p>
        <p className="text-xs text-[#65716c]">{detail}</p>
      </div>
      <span className={`history-label ${label === "반납 완료" ? "history-label-done" : ""}`}>{label}</span>
    </div>
  );
}

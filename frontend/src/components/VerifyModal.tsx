import { useEffect, useRef, useState } from "react";
import { api, type ConfirmResult, type PendingConfirmation, type User } from "../api";
import { ApiError } from "../api";
import { errorMessage, parseServerDate } from "../utils/format";
import Button from "./Button";
import Icon from "./Icon";

export type VerifyOutcome =
  | { type: "confirmed"; result: ConfirmResult }
  | { type: "rejected" }
  | { type: "expired" };

const pad = (n: number) => String(n).padStart(2, "0");

// RFID 태깅 직후 "본인이 맞습니까?" 를 묻는 하단 시트.
// expires_at 까지 남은 시간을 보여주고, 시간이 다 되면 만료로 닫힌다.
export default function VerifyModal({
  confirmation,
  user,
  loanDays,
  onDone,
}: {
  confirmation: PendingConfirmation;
  user: User | null;
  loanDays?: number;
  onDone: (outcome: VerifyOutcome) => void;
}) {
  const expiresAt = parseServerDate(confirmation.expires_at).getTime();
  const total = Math.max(1, expiresAt - parseServerDate(confirmation.scanned_at).getTime());
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const doneRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const finish = (outcome: VerifyOutcome) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(outcome);
  };

  useEffect(() => {
    dialogRef.current?.focus();
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, expiresAt - now);
  useEffect(() => {
    if (remaining === 0 && !submitting) finish({ type: "expired" });
  });

  const answer = async (confirmed: boolean) => {
    setSubmitting(true);
    setError("");
    try {
      const result = await api.reservations.confirm(confirmation.reservation_id, confirmed);
      finish(confirmed ? { type: "confirmed", result } : { type: "rejected" });
    } catch (e) {
      // 그 사이 만료된 경우
      if (e instanceof ApiError && e.code === "CONFIRMATION_NOT_FOUND") finish({ type: "expired" });
      else setError(errorMessage(e));
      setSubmitting(false);
    }
  };

  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="modal-backdrop">
      <div ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="verify-title" tabIndex={-1}>
        <span className="sheet-handle" aria-hidden="true" />
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon name="shield" size={24} />
        </span>
        <p className="text-xs text-[#65716c]">리더기에서 태그가 인식되었습니다</p>
        <h2 id="verify-title" className="text-xl font-bold">
          본인이 맞습니까?
        </h2>

        <dl className="verify-info">
          <div>
            <dt>물품</dt>
            <dd>{confirmation.item_name}</dd>
          </div>
          <div>
            <dt>예약자</dt>
            <dd>
              {user?.name} <span className="font-normal text-[#65716c]">{user?.student_id}</span>
            </dd>
          </div>
          {loanDays !== undefined && (
            <div>
              <dt>대여 기간</dt>
              <dd>{loanDays}일</dd>
            </div>
          )}
        </dl>

        <div className="w-full" aria-live="off">
          <p className="countdown" aria-label={`남은 시간 ${seconds}초`}>
            {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
          </p>
          <div className="progress" aria-hidden="true">
            <div style={{ width: `${(remaining / total) * 100}%` }} />
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[#65716c]">
            <Icon name="clock" size={14} />
            시간 안에 응답하지 않으면 확인 요청이 만료돼요.
          </p>
        </div>

        {error && (
          <p role="alert" className="form-error w-full">
            {error}
          </p>
        )}

        <div className="grid w-full grid-cols-[1fr_1.4fr] gap-2">
          <Button variant="secondary" disabled={submitting} onClick={() => answer(false)}>
            아니요
          </Button>
          <Button disabled={submitting} onClick={() => answer(true)}>
            {submitting ? "처리 중..." : "예, 본인입니다"}
          </Button>
        </div>
      </div>
    </div>
  );
}

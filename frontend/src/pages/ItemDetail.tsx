import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Item, type Reservation } from "../api";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Icon from "../components/Icon";
import ItemIcon from "../components/ItemIcon";
import TopBar from "../components/TopBar";
import { errorMessage, formatDateTime } from "../utils/format";

const unavailableText = {
  reserved: "다른 사람이 예약한 물품이에요",
  rented: "지금 대여 중인 물품이에요",
} as const;

export default function ItemDetail() {
  const { id } = useParams();
  const itemId = Number(id);

  const [item, setItem] = useState<Item | null>(null);
  const [loadError, setLoadError] = useState("");
  const [days, setDays] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);

  const load = useCallback(() => {
    setLoadError("");
    setItem(null);
    if (!Number.isInteger(itemId)) {
      setLoadError("잘못된 물품 주소입니다.");
      return;
    }
    api.items
      .get(itemId)
      .then((it) => {
        setItem(it);
        setDays(it.default_loan_days); // 기본값은 물품의 기본 대여 일수
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [itemId]);

  useEffect(load, [load]);

  const reserve = async () => {
    if (!item) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await api.reservations.create({ item_id: item.id, desired_loan_days: days });
      setReservation(r);
      setItem({ ...item, status: "reserved" });
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // 대여 일수는 1일 ~ 물품의 기본 대여 일수까지 고를 수 있다고 가정 (TODO: 팀에서 최대 일수 규칙 확정)
  const maxDays = item?.default_loan_days ?? 1;

  return (
    <div className="mobile-shell">
      <TopBar title="물품 상세" back />

      {loadError ? (
        <main className="mobile-main">
          <div className="state-box" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button button-secondary" onClick={load}>
              다시 시도
            </button>
          </div>
        </main>
      ) : !item ? (
        <main className="mobile-main" aria-busy="true">
          <div className="h-[180px] animate-pulse rounded-2xl bg-[#eef1f0]" />
        </main>
      ) : reservation ? (
        <ReservationDone reservation={reservation} />
      ) : (
        <>
          <main className="mobile-main flex flex-col gap-5">
            <div className="detail-hero">
              <ItemIcon category={item.category} size={44} />
            </div>

            <section className="flex flex-col gap-2">
              <span className="text-xs text-[#84908b]">{item.category}</span>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{item.name}</h2>
                <Badge status={item.status} />
              </div>
              {item.description && <p className="text-sm leading-6 text-[#3d4a45]">{item.description}</p>}
            </section>

            {item.status === "available" ? (
              <>
                <section className="panel flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">대여 일수</h3>
                    <p className="mt-1 text-xs text-[#65716c]">최대 {maxDays}일까지 선택할 수 있어요</p>
                  </div>
                  <div className="stepper">
                    <button type="button" aria-label="하루 줄이기" disabled={days <= 1} onClick={() => setDays((d) => Math.max(1, d - 1))}>
                      <Icon name="minus" size={18} />
                    </button>
                    <output aria-live="polite">{days}일</output>
                    <button type="button" aria-label="하루 늘리기" disabled={days >= maxDays} onClick={() => setDays((d) => Math.min(maxDays, d + 1))}>
                      <Icon name="plus" size={18} />
                    </button>
                  </div>
                </section>

                <div className="notice">
                  <Icon name="info" size={18} />
                  <p>예약 후 24시간 안에 수령하지 않으면 예약이 자동으로 취소돼요. 대여 기간은 수령한 날부터 계산돼요.</p>
                </div>
              </>
            ) : (
              <div className="notice notice-muted">
                <Icon name="clock" size={18} />
                <p>{unavailableText[item.status]}. 반납되면 다시 예약할 수 있어요.</p>
              </div>
            )}

            {submitError && (
              <p role="alert" className="form-error">
                {submitError}
              </p>
            )}
          </main>

          <div className="bottom-action">
            <Button className="w-full" disabled={item.status !== "available" || submitting} onClick={reserve}>
              {submitting ? "예약하는 중..." : item.status === "available" ? `${days}일 예약하기` : "예약할 수 없어요"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ReservationDone({ reservation }: { reservation: Reservation }) {
  return (
    <main className="mobile-main flex flex-col items-center gap-5 pt-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[#e9f5ed] text-[#267248]">
        <Icon name="check" size={30} />
      </span>
      <div>
        <h2 className="text-xl font-bold">예약되었어요</h2>
        <p className="mt-2 text-sm text-[#65716c]">수령 기한 안에 '내 대여'에서 수령하기를 누르고 리더기에 태그를 찍어주세요.</p>
      </div>

      <dl className="panel w-full text-left text-sm">
        <div className="flex justify-between py-1.5">
          <dt className="text-[#65716c]">물품</dt>
          <dd className="font-semibold">{reservation.item_name}</dd>
        </div>
        <div className="flex justify-between py-1.5">
          <dt className="text-[#65716c]">대여 일수</dt>
          <dd className="font-semibold">{reservation.desired_loan_days}일</dd>
        </div>
        <div className="flex justify-between py-1.5">
          <dt className="text-[#65716c]">수령 기한</dt>
          <dd className="font-semibold text-[#b84343]">{formatDateTime(reservation.pickup_deadline)}</dd>
        </div>
      </dl>

      <div className="flex w-full flex-col gap-2">
        <Link to="/rentals" className="button button-primary w-full">
          내 대여로 가기
        </Link>
        <Link to="/items" className="button button-secondary w-full">
          목록으로
        </Link>
      </div>
    </main>
  );
}

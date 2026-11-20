import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Item, type ItemStatus } from "../api";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import ItemIcon from "../components/ItemIcon";
import LogoutButton from "../components/LogoutButton";
import TopBar from "../components/TopBar";
import { errorMessage } from "../utils/format";

const ALL = "전체";
// 대여 가능 → 예약됨 → 대여 중 순서로 보여준다.
const statusOrder: Record<ItemStatus, number> = { available: 0, reserved: 1, rented: 2 };

// 물품이 많지 않아 전체 목록을 한 번 받아 화면에서 검색·필터한다. (입력할 때마다 서버 요청을 보내지 않음)
// 검색 규칙은 백엔드 GET /api/items 와 같다: 이름 부분 검색, 카테고리 일치, 대여 가능 여부.
// 물품이 많아지면 api.items.list({ q, category, available }) 로 서버 검색으로 바꾸면 된다.
export default function Items() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const load = useCallback(() => {
    setError("");
    setItems(null);
    api.items
      .list()
      .then(setItems)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const categories = useMemo(() => [ALL, ...new Set((items ?? []).map((i) => i.category))], [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter((i) => category === ALL || i.category === category)
      .filter((i) => !onlyAvailable || i.status === "available")
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [items, query, category, onlyAvailable]);

  const resetFilters = () => {
    setQuery("");
    setCategory(ALL);
    setOnlyAvailable(false);
  };

  return (
    <>
      <TopBar title="물품" action={<LogoutButton />} />
      <main className="mobile-main flex flex-col gap-4">
        <label className="search-box">
          <Icon name="search" size={18} />
          <span className="sr-only">물품 검색</span>
          <input type="search" placeholder="필요한 물품을 검색해보세요" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        <div className="chip-row" role="group" aria-label="카테고리">
          {categories.map((c) => (
            <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[#65716c]">{items ? `물품 ${visible.length}개` : ""}</span>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#3d4a45]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            대여 가능만 보기
          </label>
        </div>

        {error ? (
          <div className="state-box" role="alert">
            <p>{error}</p>
            <button type="button" className="button button-secondary" onClick={load}>
              다시 시도
            </button>
          </div>
        ) : !items ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-[110px] animate-pulse rounded-2xl bg-[#eef1f0]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="state-box">
            <p>조건에 맞는 물품이 없어요.</p>
            <button type="button" className="button button-secondary" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((item) => (
              <li key={item.id}>
                <Link to={`/items/${item.id}`} className="item-card">
                  <ItemIcon category={item.category} />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-[#84908b]">{item.category}</span>
                      <Badge status={item.status} />
                    </div>
                    <span className="truncate text-[15px] font-bold">{item.name}</span>
                    <span className="flex items-center gap-1 text-xs text-[#65716c]">
                      <Icon name="calendar" size={14} />
                      기본 대여 {item.default_loan_days}일
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

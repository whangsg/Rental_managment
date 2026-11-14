import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Item } from "../api";
import Badge from "../components/Badge";
import ItemIcon from "../components/ItemIcon";
import TopBar from "../components/TopBar";

// 목록이 API(목 데이터 포함)에서 오는지 확인하기 위한 임시 화면.
// TODO: feature/ui-items 에서 검색, 카테고리 필터 등 시안대로 구현
export default function Items() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    api.items.list().then(setItems);
  }, []);

  return (
    <>
      <TopBar title="물품" />
      <main className="mobile-main flex flex-col gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/items/${item.id}`}
            className="flex gap-3 rounded-2xl border border-[#e5e9e7] p-3 no-underline"
          >
            <ItemIcon category={item.category} />
            <div className="flex flex-1 flex-col justify-center gap-1">
              <span className="text-xs text-[#84908b]">{item.category}</span>
              <span className="font-bold">{item.name}</span>
              <span className="text-xs text-[#65716c]">기본 대여 {item.default_loan_days}일</span>
            </div>
            <Badge status={item.status} />
          </Link>
        ))}
      </main>
    </>
  );
}

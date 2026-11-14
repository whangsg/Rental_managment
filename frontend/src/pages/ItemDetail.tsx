import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";

// TODO: feature/ui-items 에서 구현 (상세, 대여 일수 선택, 예약하기)
export default function ItemDetail() {
  const { id } = useParams();
  return (
    <div className="mobile-shell">
      <TopBar title="물품 상세" back />
      <main className="mobile-main text-sm text-[#65716c]">물품 {id} 상세 (구현 예정)</main>
    </div>
  );
}

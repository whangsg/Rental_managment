import Icon from "./Icon";

// 물품 사진 대신 카테고리별 아이콘을 보여준다. (DB에 이미지 필드가 없음)
const byCategory: Record<string, string> = {
  전자기기: "bolt",
  공구: "wrench",
  스포츠: "ball",
  보드게임: "dice",
  실습장비: "chip",
};

export default function ItemIcon({ category, size = 34, className = "" }: { category: string; size?: number; className?: string }) {
  return (
    <div className={`item-icon ${className}`}>
      <Icon name={byCategory[category] ?? "box"} size={size} />
    </div>
  );
}

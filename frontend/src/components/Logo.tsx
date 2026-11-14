import Icon from "./Icon";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="box" size={compact ? 18 : 23} />
      </span>
      <span className={compact ? "text-sm" : "text-[19px]"}>물품 대여 서비스</span>
    </div>
  );
}

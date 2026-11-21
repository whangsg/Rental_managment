// 서비스 이름: RentIt (물품 대여 서비스)
// 아이콘: 박스 + 시계 (정해진 기간 동안 빌림). 색은 index.css 의 --logo.
// compact: 상단바·사이드바용(작게), 기본: 일반, large: 로그인 화면용(크게)
export default function Logo({ compact = false, large = false }: { compact?: boolean; large?: boolean }) {
  const size = compact ? 30 : large ? 46 : 38;
  const textClass = compact ? "text-base" : large ? "text-[30px]" : "text-[22px]";
  return (
    <div className="logo">
      <span className="logo-mark">
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="RentIt 로고"
        >
          <mask id="rentit-logo-cut">
            <rect width="48" height="48" fill="#fff" />
            <circle cx="36" cy="35" r="11.5" fill="#000" />
          </mask>
          <g mask="url(#rentit-logo-cut)">
            <path d="M22 6 6 14v18l16 8 16-8V14L22 6Z" />
            <path d="M6 14l16 8 16-8M22 22v18" />
          </g>
          <circle cx="36" cy="35" r="9" />
          <path d="M36 30.5V35l3 2" />
        </svg>
      </span>
      <span className={textClass}>
        Rent<span className="logo-it">It</span>
      </span>
    </div>
  );
}

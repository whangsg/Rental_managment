import type { ReactNode } from "react";

// 선 아이콘 모음. 필요한 아이콘은 여기에 추가한다.
const paths: Record<string, ReactNode> = {
  box: (<><path d="m21 8-9 5-9-5" /><path d="M3 8l9-5 9 5v8l-9 5-9-5Z" /><path d="M12 13v8" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  arrow: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  check: <path d="m5 12 4 4L19 6" />,
  warning: (<><path d="M12 3 2.5 20h19Z" /><path d="M12 9v4M12 17h.01" /></>),
  shield: (<><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>),
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  list: (<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3" cy="6" r=".5" /><circle cx="3" cy="12" r=".5" /><circle cx="3" cy="18" r=".5" /></>),
  logout: (<><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>),
  // 카테고리용
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.4-.6-.6-2.4Z" />,
  ball: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>),
  dice: (<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r=".8" /><circle cx="15" cy="15" r=".8" /><circle cx="12" cy="12" r=".8" /></>),
  chip: (<><rect x="7" y="7" width="10" height="10" rx="1" /><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" /></>),
};

export default function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}

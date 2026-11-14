interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="7"
          fill="#0F172A"
          stroke="rgba(59, 130, 246, 0.35)"
          strokeWidth="1.2"
        />
        <path
          d="M9.5 11.5L16 16M16 16L22.5 10.5M16 16L16 23M9.5 21.5L16 16M22.5 21.5L16 16"
          stroke="url(#hh_link_grad)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="9.5" cy="11.5" r="2.3" fill="#3B82F6" />
        <circle cx="22.5" cy="10.5" r="2.3" fill="#22D3EE" />
        <circle cx="16" cy="16" r="3" fill="#F8FAFC" stroke="#3B82F6" strokeWidth="1.5" />
        <circle cx="9.5" cy="21.5" r="2.1" fill="#8B5CF6" />
        <circle cx="22.5" cy="21.5" r="2.1" fill="#22D3EE" />
        <circle cx="16" cy="23.5" r="2" fill="#3B82F6" />
        <defs>
          <linearGradient id="hh_link_grad" x1="8" y1="10" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      {!compact && (
        <span className="font-display text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          Handover Hub
        </span>
      )}
    </div>
  );
}

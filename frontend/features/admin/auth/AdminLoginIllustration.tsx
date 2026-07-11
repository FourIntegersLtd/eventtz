/** Decorative vector for the admin sign-in left panel. */
export function AdminLoginIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="adminPanelGrad" x1="80" y1="40" x2="400" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3e1964" stopOpacity="0.12" />
          <stop offset="1" stopColor="#8b6bb8" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="adminShieldGrad" x1="240" y1="90" x2="240" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3e1964" />
          <stop offset="1" stopColor="#6b3fa0" />
        </linearGradient>
        <linearGradient id="adminCardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3eef9" />
        </linearGradient>
      </defs>

      {/* Soft backdrop */}
      <ellipse cx="240" cy="200" rx="190" ry="170" fill="url(#adminPanelGrad)" />

      {/* Floating dashboard card — back */}
      <g transform="translate(72 118) rotate(-6)">
        <rect width="148" height="108" rx="16" fill="url(#adminCardGrad)" stroke="#3e1964" strokeOpacity="0.12" strokeWidth="1.5" />
        <rect x="16" y="18" width="56" height="8" rx="4" fill="#3e1964" fillOpacity="0.15" />
        <rect x="16" y="38" width="116" height="6" rx="3" fill="#8b6bb8" fillOpacity="0.25" />
        <rect x="16" y="52" width="92" height="6" rx="3" fill="#8b6bb8" fillOpacity="0.18" />
        <rect x="16" y="72" width="48" height="22" rx="8" fill="#3e1964" fillOpacity="0.08" />
        <rect x="72" y="72" width="48" height="22" rx="8" fill="#c4a05a" fillOpacity="0.2" />
      </g>

      {/* Floating dashboard card — front */}
      <g transform="translate(248 136) rotate(5)">
        <rect width="160" height="120" rx="16" fill="white" stroke="#3e1964" strokeOpacity="0.14" strokeWidth="1.5" />
        <rect x="18" y="20" width="72" height="10" rx="5" fill="#3e1964" fillOpacity="0.85" />
        <path
          d="M28 88 L48 68 L68 78 L98 48 L122 88 Z"
          fill="#8b6bb8"
          fillOpacity="0.35"
          stroke="#3e1964"
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="48" cy="68" r="4" fill="#3e1964" />
        <circle cx="68" cy="78" r="4" fill="#3e1964" />
        <circle cx="98" cy="48" r="4" fill="#c4a05a" />
      </g>

      {/* Shield — centre hero */}
      <path
        d="M240 72 L300 98 V168 C300 214 274 244 240 256 C206 244 180 214 180 168 V98 L240 72Z"
        fill="url(#adminShieldGrad)"
      />
      <path
        d="M240 92 L280 110 V164 C280 198 262 220 240 228 C218 220 200 198 200 164 V110 L240 92Z"
        fill="white"
        fillOpacity="0.12"
      />
      <path
        d="M228 168 L236 176 L256 152"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Team nodes */}
      <circle cx="118" cy="286" r="22" fill="white" stroke="#3e1964" strokeOpacity="0.18" strokeWidth="2" />
      <circle cx="118" cy="278" r="8" fill="#8b6bb8" fillOpacity="0.55" />
      <path d="M102 302 C102 292 110 288 118 288 C126 288 134 292 134 302" fill="#8b6bb8" fillOpacity="0.35" />

      <circle cx="362" cy="278" r="22" fill="white" stroke="#3e1964" strokeOpacity="0.18" strokeWidth="2" />
      <circle cx="362" cy="270" r="8" fill="#c4a05a" fillOpacity="0.75" />
      <path d="M346 294 C346 284 354 280 362 280 C370 280 378 284 378 294" fill="#c4a05a" fillOpacity="0.35" />

      <circle cx="240" cy="312" r="26" fill="white" stroke="#3e1964" strokeOpacity="0.22" strokeWidth="2" />
      <circle cx="240" cy="302" r="10" fill="#3e1964" fillOpacity="0.75" />
      <path d="M220 332 C220 318 228 312 240 312 C252 312 260 318 260 332" fill="#3e1964" fillOpacity="0.2" />

      {/* Connection lines */}
      <path d="M140 286 H200" stroke="#3e1964" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="4 6" />
      <path d="M280 300 H336" stroke="#3e1964" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="4 6" />

      {/* Spark accents */}
      <circle cx="92" cy="96" r="5" fill="#c4a05a" fillOpacity="0.55" />
      <circle cx="388" cy="124" r="4" fill="#8b6bb8" fillOpacity="0.45" />
      <circle cx="404" cy="332" r="6" fill="#3e1964" fillOpacity="0.12" />
    </svg>
  );
}

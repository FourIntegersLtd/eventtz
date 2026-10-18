import { useId } from "react";

/** Art colours. These hex values are intentional and not theme tokens; the brand purple uses currentColor. */
const ART = {
  MUD: "#f3dfc4",
  CREAM: "#fbf3e6",
  GOLD: "#f0c27b",
  SAGE: "#c2dcb6",
  ROSE: "#f6cdd0",
  SKY: "#c6dcee",
  LILAC: "#ddd0f3",
  PEACH: "#eeab8c",
} as const;

/**
 * Decorative collage for the auth brand panel: mudcloth, kente, zigzag and dot
 * patterns shaped into an arch, a sun and a route. Purely visual, so it is
 * hidden from assistive technology. Pattern ids come from useId, so two copies
 * on one page cannot clash.
 */
export function AuthPanelArt() {
  const prefix = useId().replace(/:/g, "");
  return (
      <svg
        viewBox="0 0 600 440" className="text-primary h-auto w-full max-w-[560px] overflow-hidden" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${prefix}Mud`} width="26" height="26" patternUnits="userSpaceOnUse">
            <rect width="26" height="26" fill={ART.MUD}/>
            <path d="M6 3v6M3 6h6M15 6h7M4 17h5M17 14l4 4M21 14l-4 4" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="13" cy="21" r="1.4" fill="currentColor" fillOpacity=".5"/>
          </pattern>
          <pattern id={`${prefix}Kente`} width="44" height="44" patternUnits="userSpaceOnUse">
            <rect width="44" height="11" fill={ART.GOLD}/>
            <rect y="11" width="44" height="11" fill={ART.SAGE}/>
            <rect y="22" width="44" height="11" fill={ART.ROSE}/>
            <rect y="33" width="44" height="11" fill={ART.SKY}/>
            <path d="M6 2v7M10 2v7M28 2v7M32 2v7" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6"/>
            <rect x="16" y="13" width="7" height="7" fill={ART.CREAM}/>
            <rect x="38" y="13" width="7" height="7" fill={ART.CREAM}/>
            <path d="M0 27.5h44" stroke={ART.PEACH} strokeWidth="2" strokeDasharray="4 4"/>
            <circle cx="11" cy="38.5" r="2" fill="currentColor" fillOpacity=".3"/>
            <circle cx="33" cy="38.5" r="2" fill="currentColor" fillOpacity=".3"/>
          </pattern>
          <pattern id={`${prefix}Zig`} width="20" height="14" patternUnits="userSpaceOnUse">
            <rect width="20" height="14" fill={ART.LILAC}/>
            <polyline points="0,11 5,3 10,11 15,3 20,11" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.6"/>
          </pattern>
          <pattern id={`${prefix}Dots`} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill={ART.SKY}/>
            <circle cx="7" cy="7" r="1.9" fill="currentColor" fillOpacity=".45"/>
          </pattern>
          <pattern id={`${prefix}Tri`} width="18" height="16" patternUnits="userSpaceOnUse">
            <rect width="18" height="16" fill={ART.CREAM}/>
            <path d="M0 16 L9 2 L18 16 Z" fill={ART.PEACH} fillOpacity=".75"/>
          </pattern>
          <pattern id={`${prefix}Lines`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill={ART.CREAM}/>
            <path d="M0 0v10" stroke={ART.GOLD} strokeWidth="4"/>
          </pattern>
          <pattern id={`${prefix}Check`} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill={ART.ROSE}/>
            <rect width="8" height="8" fill={ART.CREAM}/>
            <rect x="8" y="8" width="8" height="8" fill={ART.CREAM}/>
          </pattern>
        </defs>
        <g transform="translate(360 178)">
          <circle r="114" fill={`url(#${prefix}Tri)`}/>
          <circle r="96" fill={ART.ROSE}/>
          <circle r="82" fill={`url(#${prefix}Kente)`}/>
          <circle r="48" fill={ART.CREAM}/>
          <circle r="36" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round"/>
          <circle r="15" fill={ART.GOLD}/>
          <circle r="5" fill="currentColor" fillOpacity=".6"/>
        </g>
        <path d="M372 440 A112 112 0 0 1 596 440 Z" fill={`url(#${prefix}Lines)`}/>
        <path d="M412 440 A72 72 0 0 1 556 440 Z" fill={ART.SAGE}/>
        <path d="M446 440 A38 38 0 0 1 522 440 Z" fill={`url(#${prefix}Check)`}/>
        <path d="M34 440 V224 A94 94 0 0 1 222 224 V440 Z" fill={`url(#${prefix}Mud)`}/>
        <path d="M58 440 V228 A70 70 0 0 1 198 228 V440" fill="none" stroke={ART.CREAM} strokeWidth="3"/>
        <path d="M84 440 V236 A44 44 0 0 1 172 236 V440 Z" fill={ART.PEACH} fillOpacity=".55"/>
        <rect x="234" y="300" width="112" height="140" rx="6" fill={`url(#${prefix}Dots)`}/>
        <rect x="234" y="300" width="112" height="16" fill={ART.GOLD}/>
        <path d="M234 316 h112" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 4"/>
        <path d="M190 40 L244 94 L190 148 L136 94 Z" fill={`url(#${prefix}Zig)`}/>
        <path d="M190 70 L214 94 L190 118 L166 94 Z" fill={ART.CREAM}/>
        <circle cx="190" cy="94" r="5" fill={ART.PEACH}/>
        <g transform="translate(536 92)">
          <circle r="36" fill={ART.SAGE}/>
          <circle r="28" fill="none" stroke={ART.CREAM} strokeWidth="2"/>
          <path d="M0 -6 L5 0 L0 6 L-5 0 Z" transform="translate(0 -13)" fill="currentColor" fillOpacity=".55"/>
          <path d="M0 -6 L5 0 L0 6 L-5 0 Z" transform="translate(13 0)" fill="currentColor" fillOpacity=".55"/>
          <path d="M0 -6 L5 0 L0 6 L-5 0 Z" transform="translate(0 13)" fill="currentColor" fillOpacity=".55"/>
          <path d="M0 -6 L5 0 L0 6 L-5 0 Z" transform="translate(-13 0)" fill="currentColor" fillOpacity=".55"/>
          <circle r="3" fill={ART.PEACH}/>
        </g>
        <path d="M40 32 L51 14 L62 32 Z" fill={ART.PEACH}/>
        <path d="M62 32 L73 14 L84 32 Z" fill={ART.GOLD}/>
        <path d="M84 32 L95 14 L106 32 Z" fill={ART.PEACH}/>
        <path d="M106 32 L117 14 L128 32 Z" fill={ART.GOLD}/>
        <path d="M64 178 C 110 120, 120 60, 160 30 M260 60 C 300 40, 330 40, 360 58 M470 120 C 490 100, 500 96, 506 94" fill="none" stroke={ART.CREAM} strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round"/>
        <path d="M520 170l10 0M520 176l10 0M520 182l10 0" stroke={ART.ROSE} strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M40 120l10 0M40 126l10 0M40 132l10 0" stroke={ART.SKY} strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M480 26l10 0M480 32l10 0M480 38l10 0" stroke={ART.CREAM} strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M356 312l10 0M356 318l10 0M356 324l10 0" stroke={ART.LILAC} strokeWidth="2.4" strokeLinecap="round"/>
        <circle cx="264" cy="196" r="4" fill={ART.CREAM}/>
        <circle cx="556" cy="236" r="5" fill={ART.GOLD}/>
        <circle cx="24" cy="300" r="4" fill={ART.ROSE}/>
        <circle cx="364" cy="404" r="3.5" fill={ART.CREAM}/>
        <circle cx="300" cy="22" r="3" fill={ART.SAGE}/>
        <circle cx="566" cy="330" r="14" fill="none" stroke={ART.CREAM} strokeWidth="2"/>
        <circle cx="566" cy="330" r="6" fill={ART.LILAC}/>
      </svg>
  );
}

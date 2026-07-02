// Creature stylisee (mockup uniquement) : sert de stand-in pour un sprite de Pokemon dans les
// maquettes d'arene "cases". hueRotate simule l'alteration colorimetrique (Le Bon Shiny).
export function MockCreature({ hueRotate = 0 }: { hueRotate?: number }) {
  return (
    <svg
      viewBox="0 0 200 210"
      className="h-full w-full select-none"
      style={{ filter: hueRotate ? `hue-rotate(${hueRotate}deg)` : undefined }}
      aria-hidden
    >
      <g fill="#F7C948">
        <path d="M62 60 L44 6 L86 46 Z" />
        <path d="M138 60 L156 6 L114 46 Z" />
        <ellipse cx="100" cy="120" rx="58" ry="62" />
        <ellipse cx="78" cy="188" rx="18" ry="14" />
        <ellipse cx="122" cy="188" rx="18" ry="14" />
        <path d="M150 96 L188 70 L168 96 L196 92 L156 140 L170 108 L146 118 Z" />
      </g>
      <path d="M50 22 L44 6 L60 22 Z" fill="#15151b" />
      <path d="M150 22 L156 6 L140 22 Z" fill="#15151b" />
      <circle cx="66" cy="132" r="11" fill="#EE1515" />
      <circle cx="134" cy="132" r="11" fill="#EE1515" />
      <circle cx="82" cy="108" r="6" fill="#15151b" />
      <circle cx="118" cy="108" r="6" fill="#15151b" />
      <path d="M92 124 Q100 132 108 124" stroke="#15151b" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

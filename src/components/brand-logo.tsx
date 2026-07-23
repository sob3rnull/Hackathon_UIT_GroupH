/**
 * The WheeYaw mark, line-art edition: outlined ambulance with speed lines in
 * deep teal, light-blue cross and siren — drawn from the team's logo. Sits on
 * a white rounded chip so the dark strokes stay visible on the dark-mode
 * header (in light mode the chip blends into the near-white background).
 * The favicon (src/app/icon.svg) is the same artwork; change one, change both.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#FFFFFF" />

      {/* siren light */}
      <g stroke="#7EB8DC" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M28.4 15.5a2.6 2.6 0 0 1 5.2 0" />
        <path d="M31 9.2v2" />
        <path d="M26.9 10.9l1.2 1.5" />
        <path d="M35.1 10.9l-1.2 1.5" />
        <path d="M25.2 15.3h1.7" />
        <path d="M35.1 15.3h1.7" />
      </g>

      {/* medical cross */}
      <path
        d="M28.25 25.7h2.7v2.75h2.75v2.7h-2.75v2.75h-2.7v-2.75H25.5v-2.7h2.75Z"
        stroke="#7EB8DC"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
      />

      {/* van body + speed lines + wheels */}
      <g stroke="#114B52" strokeWidth="1.9" strokeLinecap="round" fill="none">
        {/* roof, windshield slope and right side */}
        <path d="M16 19h27.2c1.2 0 2.3.6 3 1.6l4.8 6.8c.7 1 1 2 1 3.2v11.8c0 1.7-1.1 2.8-2.6 2.8" />
        {/* cab window */}
        <path d="M41 22.5v6.1c0 1 .8 1.8 1.8 1.8h5.8" />
        {/* lower body sill, dropping toward the front wheel */}
        <path d="M36.5 37.4H17.8c-1.2 0-2 .8-2 2v2.4" />
        {/* between the wheels */}
        <path d="M25.6 46h13.3" />
        {/* speed lines */}
        <path d="M8.5 24h2.1" />
        <path d="M12.1 24h8.3" />
        <path d="M12.4 28.6h1.6" />
        <path d="M15.6 28.6h7.8" />
        <path d="M7.8 33.2h2.1" />
        <path d="M11.4 33.2h6" />
        {/* wheels */}
        <circle cx="21" cy="46" r="3.3" />
        <circle cx="21" cy="46" r="1.3" strokeWidth="1.3" />
        <circle cx="43.5" cy="46" r="3.3" />
        <circle cx="43.5" cy="46" r="1.3" strokeWidth="1.3" />
      </g>
    </svg>
  );
}

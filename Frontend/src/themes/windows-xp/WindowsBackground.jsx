export default function WindowsBackground() {
  return (
    <svg
      className="windows-landscape"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="win-sky" x2="0" y2="1">
          <stop stopColor="#176bba" />
          <stop offset=".65" stopColor="#a2d9f5" />
          <stop offset="1" stopColor="#e3f0d9" />
        </linearGradient>
        <linearGradient id="win-hill" x2=".2" y2="1">
          <stop stopColor="#a7cf56" />
          <stop offset=".4" stopColor="#68aa35" />
          <stop offset="1" stopColor="#276944" />
        </linearGradient>
        <linearGradient id="win-foreground" x2=".5" y2="1">
          <stop stopColor="#88b541" />
          <stop offset="1" stopColor="#2d6843" />
        </linearGradient>
      </defs>
      <path d="M0 0h1600v1000H0z" fill="url(#win-sky)" />
      <g fill="#fff" opacity=".65">
        <path d="M120 185c25-45 95-35 120-12 25-40 110-32 125 2 40-20 98 0 98 28H105z" />
        <path d="M1000 260c20-25 55-38 90-24 25-55 108-48 140-10 56-22 120-9 139 34z" />
        <path d="M580 80c16-20 48-22 69-9 26-25 85-21 101 9z" />
      </g>
      <path d="M0 650Q330 470 700 635T1600 570V1000H0z" fill="#75ab73" />
      <path d="M0 795Q400 420 920 680T1600 685V1000H0z" fill="url(#win-hill)" />
      <path d="M0 920Q650 700 1600 830V1000H0z" fill="url(#win-foreground)" />
      <path
        d="M0 918Q600 715 1600 830"
        fill="none"
        stroke="#add174"
        strokeWidth="3"
        opacity=".4"
      />
    </svg>
  );
}

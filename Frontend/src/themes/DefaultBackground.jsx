import WindowsBackground from "./windows-xp/WindowsBackground.jsx";
import { useEffect } from "react";

// Decorative, deterministic SVG scenery. No image downloads, canvas loop or input capture.
export default function DefaultBackground() {
  useEffect(() => {
    const update = () => {
      let still = false;
      try {
        still = localStorage.getItem("wortify:background-motion") === "off";
      } catch {}
      document.documentElement.dataset.backgroundPaused = String(
        document.hidden || still,
      );
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("background-motion", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("background-motion", update);
    };
  }, []);
  return (
    <div className="default-background" aria-hidden="true">
      <WindowsBackground />
      <div className="retro-companions">
        <div className="retro-firefly retro-firefly-one">
          <i className="nes-icon star is-small" />
          <span>Aa</span>
        </div>
        <div className="retro-firefly retro-firefly-two">
          <i className="nes-icon heart is-small" />
          <span>+1</span>
        </div>
        <div className="retro-book-buddy">
          <span className="buddy-eyes">▪ ▪</span>
          <span className="buddy-pages">≡</span>
        </div>
      </div>
      <svg
        className="retro-world"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="retro-sky" x2="0" y2="1">
            <stop stopColor="#292649" />
            <stop offset=".58" stopColor="#716090" />
            <stop offset="1" stopColor="#edac9e" />
          </linearGradient>
          <pattern
            id="retro-grain"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="2" height="2" fill="#58465c" opacity=".045" />
          </pattern>
          <g id="retro-cloud">
            <path d="M0 24h24V12h24V0h48v12h24v12h36v24H0z" fill="#fff0d6" />
          </g>
          <g id="retro-pine">
            <path d="M24 0h12v12h12v12h12v12H48v12h12v12H36v24H24V60H0V48h12V36H0V24h12V12h12z" />
          </g>
          <g id="retro-book">
            <path d="M0 0h20v4h20v28H20v-4H0z" fill="#f2d68e" />
            <path
              d="M20 4v24M4 8h10M4 14h10M26 12h10M26 18h10"
              stroke="#716246"
              strokeWidth="3"
            />
          </g>
        </defs>
        <path fill="url(#retro-sky)" d="M0 0h1600v1000H0z" />
        <g fill="#fff6d7" className="retro-stars">
          {[
            [118, 86],
            [370, 162],
            [610, 65],
            [1070, 110],
            [1360, 78],
            [1480, 265],
          ].map(([x, y]) => (
            <path key={x} d={`M${x} ${y - 6}h4v6h6v4h-6v6h-4v-6h-6v-4h6z`} />
          ))}
        </g>
        <path
          className="retro-moon"
          d="M1280 100h48v12h12v48h-12v12h-48v-12h-12v-48h12z"
          fill="#f8e4a8"
        />
        <g className="retro-clouds">
          <use href="#retro-cloud" x="75" y="195" opacity=".7" />
          <use href="#retro-cloud" x="710" y="130" opacity=".4" />
          <use href="#retro-cloud" x="1370" y="325" opacity=".65" />
        </g>
        <path
          d="M0 670h100v-40h110v-55h130v60h130v70h140v-30h150v55h180v-85h100v-90h130v-50h110v80h130v70h160v345H0z"
          fill="#615687"
          opacity=".65"
        />
        <path
          d="M0 790h120v-60h150v50h160v45h180v-45h190v35h180v-70h140v-55h180v45h170v60h130v205H0z"
          fill="#3c797e"
          opacity=".65"
        />
        <g fill="#627e70" opacity=".6">
          <use href="#retro-pine" x="80" y="770" />
          <use href="#retro-pine" x="230" y="840" />
          <use href="#retro-pine" x="1420" y="765" />
          <use href="#retro-pine" x="1510" y="810" />
        </g>
        <g className="retro-village">
          <path d="M1120 892V770h20v-20h100v20h20v122z" fill="#967d70" />
          <path
            d="M1096 770v-12h24v-24h24v-16h92v16h24v24h24v12z"
            fill="#5e6770"
          />
          <path d="M1138 794h24v28h-24zm60 0h24v28h-24z" fill="#f4d390" />
          <path d="M1174 844h28v48h-28z" fill="#565a56" />
          <use href="#retro-book" x="1168" y="757" />
        </g>
        <path d="M0 920h1600v80H0z" fill="#383955" />
        <path d="M0 920h1600v8H0z" fill="#89c6ac" />
        <path
          d="M0 952h1600"
          stroke="#ad9a78"
          strokeWidth="4"
          strokeDasharray="24 56"
        />
        <g className="retro-traveler">
          <path d="M150 884h16v8h8v16h-8v12h-8v-12h-12v-16h4z" fill="#3e6155" />
          <path d="M150 876h16v12h-16z" fill="#ebc599" />
          <path d="M146 872h20v8h-20z" fill="#a25842" />
          <rect x="140" y="892" width="10" height="16" fill="#c49652" />
        </g>
        <g className="retro-treasure">
          <use href="#retro-book" x="430" y="880" />
          <path d="M472 878h8v8h-8zM485 865h4v4h-4z" fill="#fff2bd" />
        </g>
        <path fill="url(#retro-grain)" d="M0 0h1600v1000H0z" />
      </svg>
      <svg
        className="ambient-symbols"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M100 150h64v80h-64zM110 170h40m-40 12h30M1420 740h60v80h-60zM1430 760h35m-35 14h25" />
          <path d="m1330 140 14 28 30 4-22 22 5 30-27-14-27 14 5-30-22-22 30-4z" />
          <circle cx="270" cy="820" r="65" />
          <path d="M1160 350h120v120h-120zM1160 380h120M1200 350v120" />
        </g>
      </svg>
    </div>
  );
}

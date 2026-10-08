import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { MotionConfig } from "framer-motion";
import DefaultBackground from "./themes/DefaultBackground.jsx";
import App from "./app/App.jsx";
import "./design-system/index.css";
class Boundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="welcome">
        <h1>This page could not be opened.</h1>
        <p>Data already saved on the server is preserved.</p>
        <button onClick={() => location.reload()}>Reload page</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HeroUIProvider>
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "fixed", pointerEvents: "none" }}
      >
        <defs>
          <filter
            id="liquid-refraction"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="1"
              seed="4"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="3"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <MotionConfig reducedMotion="user">
        <Boundary>
          <DefaultBackground />
        <App />
        </Boundary>
      </MotionConfig>
    </HeroUIProvider>
  </StrictMode>,
);

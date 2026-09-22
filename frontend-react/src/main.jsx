import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./styles.css";
class Boundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="welcome">
        <h1>Trang này chưa mở được.</h1>
        <p>Dữ liệu đã lưu trên máy chủ vẫn được giữ.</p>
        <button onClick={() => location.reload()}>Tải lại trang</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HeroUIProvider>
      <svg aria-hidden="true" width="0" height="0" style={{position:"fixed",pointerEvents:"none"}}><defs><filter id="liquid-refraction" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
      <MotionConfig reducedMotion="user">
        <Boundary>
          <App />
        </Boundary>
      </MotionConfig>
    </HeroUIProvider>
  </StrictMode>,
);
import "./glass.css";

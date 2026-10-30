import { Component } from "react";
import { t } from "../../i18n/index.js";

// Keep a feature/chunk failure inside its content panel. Navigation and other
// workspaces remain mounted and usable; no feature code is imported here.
export class FeatureBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section
        className="glass"
        role="alert"
        aria-label={t(this.props.label || "Classes")}
      >
        <div className="glass-body">
          <h2>{t("This page could not be opened.")}</h2>
          <p>{t("Data already saved on the server is preserved.")}</p>
          <button className="btn" onClick={() => location.reload()}>
            {t("Reload page")}
          </button>
        </div>
      </section>
    );
  }
}

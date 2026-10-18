import { useState, useRef } from "react";
import { request } from "../lib/core.js";
import { Select, Status } from "../components/ui/ui.jsx";
import { t, useLocale, setLanguage } from "./index.js";
export default function LanguageSettings() {
  const language = useLocale();
  const flight = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(value) {
    if (flight.current || value === language) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      await request("/api/me/language/", "PATCH", { language: value });
      setLanguage(value);
      window.dispatchEvent(
        new CustomEvent("interface-language-changed", { detail: value }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 mb-5">
      <Select
        label={t("App language")}
        value={language}
        onChange={change}
        disabled={busy}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="vi" lang="vi">
          Tiếng Việt
        </option>
        <option value="de" lang="de">
          Deutsch
        </option>
      </Select>
      <p className="text-sm">
        {t(
          "Changes the interface language only. Your lessons and learning language stay the same.",
        )}
      </p>
      <Status error={error} />
    </section>
  );
}

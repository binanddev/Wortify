import React from "react";
import { createRoot } from "react-dom/client";
import Defense from "./FlashcardDefense.jsx";
import { setLanguage } from "../../../i18n/index.js";
const root = createRoot(document.getElementById("game-root"));
let initialized = false;
const receive = (event) => {
  if (
    event.source !== window.parent ||
    event.origin !== window.location.origin ||
    event.data?.type !== "wortify-game-init" ||
    initialized
  )
    return;
  const { initialDeck, lang, userId, locale } = event.data;
  if (
    !initialDeck?.deck ||
    !Array.isArray(initialDeck.cards) ||
    !["de", "en"].includes(lang)
  )
    return;
  initialized = true;
  setLanguage(locale);
  root.render(
    <Defense
      initialDeck={initialDeck}
      lang={lang}
      userId={userId}
      onClose={() =>
        window.parent.postMessage(
          { type: "wortify-game-close" },
          window.location.origin,
        )
      }
    />,
  );
};
window.addEventListener("message", receive);
if (window.parent !== window)
  window.parent.postMessage(
    { type: "wortify-game-ready" },
    window.location.origin,
  );
else window.location.replace("/");

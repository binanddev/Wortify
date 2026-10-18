import { useState } from "react";
import { Btn, Status } from "../../components/ui/ui.jsx";
import { clearContentCache } from "../../lib/core.js";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function RefreshApp() {
  useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="my-3">
      <Btn
        icon="refresh"
        isLoading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            clearContentCache();
            if ("serviceWorker" in navigator) {
              const registrations =
                await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map((r) => r.unregister()));
            }
            if ("caches" in window) {
              await Promise.all(
                (await caches.keys()).map((key) => caches.delete(key)),
              );
            }
            const url = new URL(location.href);
            url.searchParams.set("_refresh", Date.now());
            location.replace(url.href);
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        {tr("Refresh application")}
      </Btn>
      <Status error={error} />
    </div>
  );
}

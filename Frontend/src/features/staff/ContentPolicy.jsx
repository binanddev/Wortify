import { useState } from "react";
import { request, useResource } from "../../lib/core.js";
import { Loading, Select, Status } from "../../components/ui/ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function ContentPolicy() {
  useLocale();
  const resource = useResource("/api/manage/content-policy/", true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(mode) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/manage/content-policy/", "PATCH", { mode });
      resource.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loading resource={resource}>
      {(data) => (
        <>
          <Select
            label={tr("Publishing mode")}
            value={data.mode}
            onChange={change}
            disabled={busy}
          >
            <option value="public">{tr("All content public")}</option>
            <option value="new_public">{tr("Only new content public")}</option>
            <option value="choice">
              {tr("Users choose public or private")}
            </option>
          </Select>
          <Status error={error} />
        </>
      )}
    </Loading>
  );
}

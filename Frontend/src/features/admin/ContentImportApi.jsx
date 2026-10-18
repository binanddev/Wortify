import ContentImportGuide from "./ContentImportGuide.jsx";
import { useState, useRef } from "react";
import { request, useResource, readPreference, savePreference } from "../../lib/core.js";
import { Btn, Loading, Status, Confirm } from "../../components/ui/ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function ContentImportApi() {
  useLocale();
  const flight = useRef(false);
  const resource = useResource("/api/manage/import-api/", true);
  const [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(null);
  const defaultUrl = `${window.location.origin}/api/import/content/`;
  const [url, setUrl] = useState(()=>readPreference("wortify:content-import-endpoint", defaultUrl));
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [draftEndpoint, setDraftEndpoint] = useState(url);
  const [endpointError, setEndpointError] = useState("");
  const origin = url.replace(/\/api\/import\/content\/$/, "");
  function editEndpoint() { setDraftEndpoint(url); setEndpointError(""); setEditingEndpoint(true); }
  function saveEndpoint(event) {
    event.preventDefault();
    try {
      const value = draftEndpoint.trim();
      if (/[\s"'`$\\<>]/.test(value)) throw new Error();
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
      const base = parsed.href.replace(/\/+$/, "");
      const next = base.endsWith("/api/import/content") ? base + "/" : base + "/api/import/content/";
      setUrl(next); savePreference("wortify:content-import-endpoint",next); setEditingEndpoint(false); setEndpointError("");
    } catch { setEndpointError("Enter an HTTP or HTTPS site URL or import endpoint, without query parameters."); }
  }
  async function update(method) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request(
        "/api/manage/import-api/",
        method,
        method === "POST" ? {} : undefined,
      );
      setSecret(result.key || "");
      resource.reload();
      setConfirm(null);
    } catch (e) {
      setError(e.message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const preview = `curl "${url}" -H "Authorization: Bearer YOUR_IMPORT_KEY" -F "file=@content-package.txt;type=text/plain" -F "preview=true"`;
  const publish = preview.replace("preview=true", "confirm=IMPORT") + ' -F "preview_token=TOKEN_FROM_PREVIEW"';
  return (
    <section className="space-y-4">
      <h2>{tr("Content import API")}</h2>
      <p>
        {tr(
          "Enable an import-only key for scripts or your authoring assistant. Practice Hub and Reading only; flashcards remain personal.",
        )}
      </p>
      <Loading resource={resource}>
        {(data) => (
          <>
            <p>
              {data.enabled ? tr("API enabled") : tr("API disabled")}
              {data.prefix && ` · ${data.prefix}…`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn
                isDisabled={busy}
                onClick={() =>
                  data.enabled ? setConfirm("rotate") : update("POST")
                }
              >
                {data.enabled ? tr("Rotate API key") : tr("Enable API")}
              </Btn>
              {data.enabled && (
                <Btn isDisabled={busy} onClick={() => setConfirm("disable")}>
                  {tr("Disable API")}
                </Btn>
              )}
            </div>
          </>
        )}
      </Loading>
      <Status error={error} />
      {secret && (
        <div className="space-y-2">
          <p>
            {tr(
              "Copy this key now. It is shown only once and is not stored in this browser.",
            )}
          </p>
          <textarea
            aria-label={tr("New API key")}
            readOnly
            rows={2}
            className="w-full"
            value={secret}
          />
          <Btn
            onClick={() =>
              navigator.clipboard
                .writeText(secret)
                .catch(() => setError(tr("Select and copy the key manually.")))
            }
          >
            {tr("Copy key")}
          </Btn>
          <Btn onClick={() => setSecret("")}>{tr("Hide key")}</Btn>
        </div>
      )}
      <div className="space-y-2">
        <h3>{tr("Import endpoint")}</h3>
        {editingEndpoint ? <form onSubmit={saveEndpoint} className="space-y-2">
          <input autoFocus type="text" aria-label={tr("Import endpoint")} className="w-full" value={draftEndpoint} onFocus={e=>e.target.select()} onChange={e=>setDraftEndpoint(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setEditingEndpoint(false);setEndpointError('');}}}/>
          <div className="flex gap-2"><Btn type="submit">{tr("Save changes")}</Btn><Btn onClick={()=>{setEditingEndpoint(false);setEndpointError('');}}>{tr("Cancel")}</Btn></div>
        </form> : <button type="button" className="w-full text-left break-all rounded-xl border border-(--line) p-3" onDoubleClick={editEndpoint} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();editEndpoint();}}} title={tr("Double-click to edit endpoint")}>{url}</button>}
        <p className="text-sm text-(--muted)">{tr("Double-click to edit endpoint")}</p>
        {endpointError&&<p role="alert">{tr(endpointError)}</p>}
        {url!==defaultUrl&&<Btn onClick={()=>{setUrl(defaultUrl);savePreference('wortify:content-import-endpoint',defaultUrl);setEditingEndpoint(false);setEndpointError('');}}>{tr("Use current site")}</Btn>}
      </div>
      <h3>{tr("How to import")}</h3>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          {tr(
            "Create one UTF-8 text file with practice and reading sections. Use the same lesson syntax as the editors.",
          )}
        </li>
        <li>
          {tr(
            "Replace YOUR_IMPORT_KEY with your key. Preview validates the entire package without saving.",
          )}
        </li>
        <li>
          {tr(
            "After preview, send the unchanged file with confirm=IMPORT and the returned preview_token. Publication is public under Wortify.",
          )}
        </li>
        <li>
          {tr(
            "Keep the package UUID and file unchanged when retrying. A repeated import returns the existing result without duplicates.",
          )}
        </li>
      </ol>
      <ContentImportGuide bot origin={origin} />
      <p><a href={`${origin}/api/import/openapi/`} target="_blank" rel="noopener noreferrer">{tr("OpenAPI schema for bots")}</a></p>
      <p>{tr("Bots can send JSON with text and preview=true, then the same text with confirm=IMPORT and preview_token. The content itself uses the compact text format.")}</p>
      <h4>{tr("1. Preview")}</h4>
      <pre onDoubleClick={editEndpoint} title={tr("Double-click to edit endpoint")} className="overflow-x-auto whitespace-pre-wrap break-all">
        {preview}
      </pre>
      <h4>{tr("2. Publish")}</h4>
      <pre onDoubleClick={editEndpoint} title={tr("Double-click to edit endpoint")} className="overflow-x-auto whitespace-pre-wrap break-all">
        {publish}
      </pre>
      <p>
        {tr(
          "In PowerShell use curl.exe. In Postman use POST, Bearer Token, and form-data: file (File), preview=true, or confirm=IMPORT plus preview_token. Do not set Content-Type manually.",
        )}
      </p>
      <p>
        {tr(
          "Responses: 200 preview or existing package; 201 newly published; 400 invalid content; 401 invalid or disabled key. Maximum file size: 50 MB.",
        )}
      </p>
      <p>
        {tr(
          "This key cannot manage accounts, restore backups or access personal flashcards. Keep it out of shared files and chat guides.",
        )}
      </p>
      {confirm && (
        <Confirm
          title={
            confirm === "rotate" ? tr("Rotate API key?") : tr("Disable API?")
          }
          description={tr(
            "The current key will stop working. Update scripts if you create a new key.",
          )}
          confirmLabel={tr("Confirm")}
          onClose={() => setConfirm(null)}
          onConfirm={() => update(confirm === "rotate" ? "POST" : "DELETE")}
        />
      )}
    </section>
  );
}

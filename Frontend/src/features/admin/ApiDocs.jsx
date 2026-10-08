import { useState } from "react";
import { useResource } from "../../lib/core.js";
import { Btn, Field, Select, Loading, Status } from "../../components/ui/ui.jsx";

function Snippet({ value, label = "JSON" }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const [message, setMessage] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      setMessage("Select the code below to copy it manually.");
    }
  };
  return (
    <div className="my-3 min-w-0 rounded-xl border border-(--line)">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--line) px-3 py-2">
        <strong className="text-xs">{label}</strong>
        <Btn onClick={copy}>Copy</Btn>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
      {message && (
        <p role="status" className="px-4 pb-3 text-xs">
          {message}
        </p>
      )}
    </div>
  );
}

function Reference({ data }) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [method, setMethod] = useState("");
  const rows = data.endpoints.filter(
    (row) =>
      (!group || row.group === group) &&
      (!method || row.methods.includes(method)) &&
      `${row.path} ${row.description} ${row.role}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">API documentation</h2>
          <p className="mt-2 text-sm text-(--muted)">
            {data.endpoints.length} endpoints · Session & CSRF · For developers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn primary"
            href="/api/manage/api-docs/?format=postman"
            download
          >
            Download Postman collection
          </a>
          <a
            className="btn"
            href="/api/manage/api-docs/?format=markdown"
            download
          >
            Download Markdown guide
          </a>
        </div>
      </div>
      <div className="mb-6 rounded-2xl border border-(--line) bg-(--surface) p-5">
        <h3 className="text-lg font-bold">Get started in Postman</h3>
        <ol className="my-3 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Import the collection, set <code>baseUrl</code>, <code>username</code>,{" "}
            <code>password</code> in your private environment.
          </li>
          <li>
            Open folder <strong>00 · Start</strong>: get the CSRF cookie → sign in → verify the session.
          </li>
          <li>
            Choose a request to test. Replace IDs and request bodies with data from your test environment.
          </li>
          <li>
            For managed content, read the details to get <code>version</code>{" "}
            before saving changes.
          </li>
        </ol>
        <p className="text-sm text-(--muted)">
          This page does not send API requests. The collection includes edit and delete requests; review and send them individually instead of running the entire collection.
        </p>
      </div>
      <section aria-label="Integration guide" className="mb-7 grid gap-3">
        {data.guide.map((guide, index) => (
          <details
            key={guide.title}
            open={index === 1}
            className="rounded-xl border border-(--line) p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {guide.title}
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--muted)">
              {guide.text}
            </p>
          </details>
        ))}
      </section>
      <section aria-label="Workflow examples" className="mb-7 grid gap-3">
        <h3 className="text-xl font-bold">Workflow examples</h3>
        {data.recipes.map((recipe) => (
          <details
            key={recipe.title}
            className="min-w-0 rounded-xl border border-(--line) p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {recipe.title}
            </summary>
            <p className="mt-3 break-all text-sm">
              <code>
                {recipe.method} {recipe.path}
              </code>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-(--muted)">
              {recipe.description}
            </p>
            <Snippet value={recipe.body} label="Body · application/json" />
          </details>
        ))}
      </section>
      <h3 className="mb-3 text-xl font-bold">Endpoint catalog</h3>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Field
          label="Search paths, features or permissions"
          value={query}
          onChange={setQuery}
        />
        <Select label="Group API" value={group} onChange={setGroup}>
          <option value="">All groups</option>
          {[...new Set(data.endpoints.map((r) => r.group))].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <Select label="HTTP method" value={method} onChange={setMethod}>
          <option value="">All methods</option>
          {["GET", "POST", "PATCH", "DELETE", "HEAD"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </div>
      <p className="mb-3 text-sm text-(--muted)">
        {rows.length} matching paths. Example IDs, names and responses are not real data.
      </p>
      <div className="grid gap-3">
        {rows.map((row) => (
          <details
            key={row.path}
            className="min-w-0 rounded-2xl border border-(--line) bg-(--surface) p-4"
          >
            <summary className="cursor-pointer">
              <span className="mr-2 inline-flex flex-wrap gap-1">
                {row.methods.map((m) => (
                  <span
                    key={m}
                    className={`rounded px-2 py-1 text-xs font-bold ${m === "DELETE" ? "bg-rose-500/10 text-rose-700" : "bg-blue-500/10 text-blue-700"}`}
                  >
                    {m}
                  </span>
                ))}
              </span>
              <code className="break-all text-sm">{row.path}</code>
              <span className="mt-2 block text-xs text-(--muted)">
                {row.group} · {row.role}
              </span>
            </summary>
            <div className="mt-4 min-w-0 border-t border-(--line) pt-4">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {row.description}
              </p>
              {row.parameters.length > 0 && (
                <p className="my-3 text-sm">
                  <strong>Path parameters:</strong> {row.parameters.join(", ")}.
                  Replace with real IDs; language=en/de, fmt=json/csv.
                </p>
              )}
              {Object.entries(row.examples).map(([verb, value]) => (
                <Snippet
                  key={verb}
                  value={value}
                  label={`Body ${verb} · application/json`}
                />
              ))}
              {row.multipart.length > 0 && (
                <div className="my-4">
                  <strong className="text-sm">POST · form-data</strong>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {row.multipart.map(([name, type, value]) => (
                      <li key={name}>
                        <code>{name}</code> ·{" "}
                        {type === "file"
                          ? "File — choose a file in Postman"
                          : `Text — ${value}`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-(--muted)">
                    Do not set Content-Type manually; Postman generates the multipart boundary.
                  </p>
                </div>
              )}
              {row.response_example && (
                <Snippet
                  label="Example success response · not real data"
                  value={row.response_example}
                />
              )}
              <p className="mt-3 text-xs text-(--muted)">
                Handled at <code>{row.source}</code>. Write requests use the session cookie and X-CSRFToken, except the monitor API which uses a server key.
              </p>
            </div>
          </details>
        ))}
        {!rows.length && <Status>No endpoints match these filters.</Status>}
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const resource = useResource("/api/manage/api-docs/");
  return (
    <Loading resource={resource} label="Loading API documentation…">
      {(data) => <Reference data={data} />}
    </Loading>
  );
}

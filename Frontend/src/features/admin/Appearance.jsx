import { useRef, useState } from "react";
import { request, useResource, useAction } from "../../lib/core.js";
import { Btn, Icon, Glass, Heading, Loading, Page, Status } from "../../components/ui/ui.jsx";

export default function Appearance({ backgroundUrl = "" }) {
  const resource = useResource("/api/manage/appearance/"),
    input = useRef(null),
    action = useAction(),
    [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");

  const upload = () =>
    action.run(async (signal) => {
      if (!selected) throw new Error("Choose a background image.");
      if (selected.size > 30 * 1024 * 1024)
        throw new Error("Images must not exceed 30 MB.");
      const body = new FormData();
      body.append("background_image", selected);
      await request("/api/manage/appearance/", "POST", body, signal);
      setSelected(null);
      resource.reload();
      setNotice("Saved. Sign out and sign in again to update the background.");
    });

  const remove = () =>
    action.run(async (signal) => {
      await request("/api/manage/appearance/", "DELETE", undefined, signal);
      resource.reload();
      setNotice("Saved. Sign out and sign in again to update the background.");
    });

  return (
    <Page>
      <Heading
        eyebrow="WORTIFY STUDIO · APPEARANCE"
        title="One shared background for all learners."
        description="Administrator backgrounds are shared across Wortify."
      />
      {notice && <p role="status">{notice}</p>}
      <Loading label="Loading admin data…" resource={resource}>
        {(data) => (
          <div className="appearance-layout">
            <Glass className="appearance-editor">
              <div className="appearance-heading">
                <div>
                  <span className="eyebrow">CURRENT BACKGROUND</span>
                  <h2>
                    {data.background_image
                      ? "Using the shared background"
                      : "Using the default background"}
                  </h2>
                </div>
                <span className="appearance-status">
                  {data.background_image ? "Enabled" : "Default"}
                </span>
              </div>
              <div
                className="appearance-preview"
                style={
                  data.background_url || backgroundUrl
                    ? {
                        backgroundImage: `url("${data.background_url || backgroundUrl}")`,
                      }
                    : undefined
                }
              >
                {!data.background_image && <strong>Wortify</strong>}
              </div>
              <div className="appearance-actions">
                <input
                  ref={input}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelected(e.target.files?.[0] || null)}
                />
                <Btn onClick={() => input.current?.click()}>Choose a new image</Btn>
                <span className="appearance-file">
                  {selected
                    ? selected.name
                    : "PNG, JPG or WebP · max 30 MB"}
                </span>
              </div>
              <div className="toolbar">
                <Btn
                  primary
                  isLoading={action.pending}
                  isDisabled={!selected}
                  onClick={upload}
                >
                  Save background
                </Btn>
                {data.background_image && (
                  <Btn isLoading={action.pending} onClick={remove}>
                    Restore default background
                  </Btn>
                )}
              </div>
              <Status error={action.error} />
            </Glass>
            <Glass className="appearance-guide">
              <span className="tile-icon">
                <Icon name="image" size={32} />
              </span>
              <h2>Image suggestions</h2>
              <ul>
                <li>Choose a landscape image with few details to keep text readable.</li>
                <li>
                  The image applies to all signed-in accounts.
                </li>
                <li>Changes take effect the next time you sign in.</li>
              </ul>
            </Glass>
          </div>
        )}
      </Loading>
    </Page>
  );
}

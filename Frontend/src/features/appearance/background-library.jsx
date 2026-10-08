import { useRef, useState } from "react";
import { request, useResource, useAction } from "../../lib/core.js";
import { Btn, Status, Confirm } from "../../components/ui/ui.jsx";
import { clearLoginAppearance } from "./appearance-cache.js";

export default function BackgroundLibrary() {
  const resource = useResource("/api/me/backgrounds/", true);
  const action = useAction();
  const input = useRef(null);
  const [remove, setRemove] = useState(null);
  const [notice, setNotice] = useState("");
  const [motion, setMotion] = useState(() => {
    try {
      return localStorage.getItem("wortify:background-motion") !== "off";
    } catch {
      return true;
    }
  });
  const images = resource.data?.images || [];
  async function changed(message) {
    await clearLoginAppearance();
    window.dispatchEvent(new Event("background-changed"));
    resource.reload();
    setNotice(message);
  }
  return (
    <section className="background-library" aria-label="Background library">
      <div className="background-library-heading">
        <div>
          <h3>Your backgrounds</h3>
          <p>
            Shared across themes and languages · {images.length}/10 images
          </p>
        </div>
        <Btn
          icon="plus"
          isDisabled={!resource.data || images.length >= 10 || action.pending}
          onClick={() => input.current.click()}
        >
          Add image
        </Btn>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          action.run(async (signal) => {
            if (file.size > 30 * 1024 * 1024)
              throw new Error("Images must not exceed 30 MB.");
            const data = new FormData();
            data.append("image", file);
            await request("/api/me/backgrounds/", "POST", data, signal);
            await changed("Background added and applied.");
          });
        }}
      />
      <p className="background-help">JPG, PNG, WebP · max 30 MB per image</p>
      <label className="check-line">
        <input
          type="checkbox"
          checked={motion}
          onChange={(e) => {
            setMotion(e.target.checked);
            try {
              localStorage.setItem(
                "wortify:background-motion",
                e.target.checked ? "on" : "off",
              );
            } catch {}
            window.dispatchEvent(new Event("background-motion"));
          }}
        />
        Gentle background motion
      </label>
      <div className="background-grid">
        {
          <button
            className="background-choice background-default"
            disabled={action.pending}
            aria-pressed={resource.data?.selected === null}
            onClick={() =>
              action.run(async (signal) => {
                await request(
                  "/api/me/backgrounds/select/",
                  "POST",
                  { id: null },
                  signal,
                );
                await changed("Default background restored.");
              })
            }
          >
            Default theme background
          </button>
        }
        {images.map((image) => (
          <div className="background-item" key={image.id}>
            <button
              className="background-choice"
              aria-pressed={resource.data?.selected === image.id}
              disabled={action.pending}
              onClick={() =>
                action.run(async (signal) => {
                  await request(
                    "/api/me/backgrounds/select/",
                    "POST",
                    { id: image.id },
                    signal,
                  );
                  await changed("Background changed.");
                })
              }
            >
              <img src={image.url} alt="" loading="lazy" />
              <span>{image.name}</span>
              {resource.data?.selected === image.id && (
                <strong>In use</strong>
              )}
            </button>
            <Btn
              icon="trash"
              isDisabled={action.pending}
              aria-label={`Delete image ${image.name}`}
              onClick={() => setRemove(image)}
            >
              Delete
            </Btn>
          </div>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      <Status
        loading={resource.loading || action.pending}
        error={action.error || resource.error}
      />
      {remove && (
        <Confirm
          title="Delete this background?"
          description="If this image is active, the theme will return to its default background."
          onClose={() => setRemove(null)}
          onConfirm={async (signal) => {
            await request(
              `/api/me/backgrounds/${remove.id}/`,
              "DELETE",
              undefined,
              signal,
            );
            await changed("Background deleted.");
          }}
        />
      )}
    </section>
  );
}

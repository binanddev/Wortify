import { useRef } from "react";
import { request, useResource, useAction } from "./core";
import { Btn, Status } from "./ui";
export default function PersonalBackground() {
  const resource = useResource("/api/me/background/"),
    action = useAction(),
    input = useRef(null);
  const changed = () => {
    resource.reload();
    window.dispatchEvent(new Event("appearance-updated"));
  };
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">Ảnh nền của bạn</h3>
      {resource.data?.background_url && (
        <img
          src={resource.data.background_url}
          alt="Ảnh nền riêng"
          className="h-36 w-full rounded-2xl object-cover"
        />
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          action.run(async (signal) => {
            if (file.size > 8 * 1024 * 1024)
              throw new Error("Ảnh tối đa 8 MB.");
            const data = new FormData();
            data.append("image", file);
            await request("/api/me/background/", "POST", data, signal);
            changed();
          });
        }}
      />
      <div className="flash-icon-row">
        <Btn
          icon="image"
          isLoading={action.pending}
          onClick={() => input.current.click()}
        >
          Tải ảnh nền · JPG, PNG, WebP · tối đa 8 MB
        </Btn>
        <Btn
          icon="trash"
          isDisabled={!resource.data?.background_url || action.pending}
          onClick={() =>
            action.run(async (signal) => {
              await request("/api/me/background/", "DELETE", undefined, signal);
              changed();
            })
          }
        >
          Bỏ ảnh nền riêng
        </Btn>
      </div>
      <Status error={action.error || resource.error} />
    </section>
  );
}

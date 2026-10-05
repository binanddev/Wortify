import { useEffect, useRef, useState } from "react";
import { request, useAction } from "./core";
import { Btn, Status } from "./ui";
export default function PersonalBackground({ backgroundUrl = "" }) {
  const action = useAction(),
    input = useRef(null);
  const [notice, setNotice] = useState(""),
    [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">Nền mặc định cá nhân</h3>
      {(preview || backgroundUrl) && (
        <img
          src={preview || backgroundUrl}
          alt="Nền của phiên hiện tại hoặc ảnh vừa chọn"
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
            if (file.size > 30 * 1024 * 1024)
              throw new Error("Ảnh tối đa 30 MB.");
            const data = new FormData();
            data.append("image", file);
            await request("/api/me/background/", "POST", data, signal);
            setPreview(URL.createObjectURL(file));
            setNotice(
              "Đã lưu. Hãy đăng xuất rồi đăng nhập lại để cập nhật nền. Nếu đang dùng theme, chọn nền mặc định trong mục Theme để dùng ảnh này.",
            );
          });
        }}
      />
      <div className="flex items-center gap-2">
        <Btn
          icon="image"
          isLoading={action.pending}
          onClick={() => input.current.click()}
        >
          Tải ảnh nền · JPG, PNG, WebP · tối đa 30 MB
        </Btn>
        <Btn
          icon="trash"
          isDisabled={action.pending}
          onClick={() =>
            action.run(async (signal) => {
              await request("/api/me/background/", "DELETE", undefined, signal);
              setPreview("");
              setNotice(
                "Đã bỏ ảnh nền riêng. Hãy đăng xuất rồi đăng nhập lại để cập nhật.",
              );
            })
          }
        >
          Bỏ nền mặc định cá nhân
        </Btn>
        <span className="text-sm text-(--muted)">JPG · PNG · WebP · 30 MB</span>
      </div>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Status error={action.error} />
    </section>
  );
}

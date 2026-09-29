import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { request, useResource, useAction } from "./core";
import { Btn, Field, Select, Status, Confirm } from "./ui";
const visualKeys = [
  "background",
  "transparency",
  "textSize",
  "font",
  "textWeight",
  "textContrast",
  "textColor",
  "curvature",
  "glassLens",
];
const displayOnly = (prefs) =>
  Object.fromEntries(
    visualKeys
      .filter((key) => prefs[key] !== undefined)
      .map((key) => [key, prefs[key]]),
  );
const sliders = [
  ["textSize", "Cỡ chữ", 16, 22, 1, 18],
  ["font", "Cỡ chữ thẻ", 24, 60, 2, 36],
  ["textWeight", "Độ đậm chữ", 400, 700, 50, 500],
  ["textContrast", "Tương phản", 0, 100, 5, 80],
  ["transparency", "Độ trong suốt", 0, 100, 5, 25],
  ["curvature", "Độ cong", 0, 32, 1, 18],
  ["glassLens", "Độ lúp kính", 0, 100, 5, 40],
];
function ThemeEditor({ theme, prefs, staff, lang, onClose, onSaved }) {
  const [name, setName] = useState(theme?.name || ""),
    [shared, setShared] = useState(theme?.system || false);
  const [values, setValues] = useState(
    displayOnly(theme?.preferences || prefs),
  );
  const [image, setImage] = useState(null),
    [mode, setMode] = useState(theme ? "keep" : "current"),
    [preview, setPreview] = useState("");
  const action = useAction();
  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{ base: "glass dialog" }}
    >
      <ModalContent>
        <ModalHeader>{theme ? "Sửa theme" : "Theme mới"}</ModalHeader>
        <ModalBody>
          <Field
            label="Tên theme"
            value={name}
            maxLength={80}
            onChange={setName}
          />
          {staff && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              Theme hệ thống
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {sliders.map(([key, label, min, max, step, fallback]) => (
              <label key={key} className="range-label">
                {label} <strong>{values[key] ?? fallback}</strong>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={values[key] ?? fallback}
                  onChange={(e) =>
                    setValues({ ...values, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Field
              label="Màu chữ"
              type="color"
              value={
                values.textColor?.startsWith("#") ? values.textColor : "#152740"
              }
              onChange={(textColor) => setValues({ ...values, textColor })}
            />
            <Btn
              icon="undo"
              onClick={() => setValues({ ...values, textColor: "auto" })}
            >
              Màu chữ tự động
            </Btn>
          </div>
          <Select
            label="Nền cơ bản"
            value={values.background || "mist"}
            onChange={(background) => setValues({ ...values, background })}
          >
            <option value="mist">Sương sớm</option>
            <option value="paper">Giấy sáng</option>
            <option value="night">Đêm yên tĩnh</option>
          </Select>
          <Select
            label="Ảnh nền"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setImage(null);
            }}
          >
            {theme && <option value="keep">Giữ ảnh của theme</option>}
            <option value="current">
              Dùng ảnh nền đã lưu của không gian này
            </option>
            <option value="upload">Tải ảnh mới</option>
            <option value="remove">Không dùng ảnh</option>
          </Select>
          {mode === "upload" && (
            <label className="grid gap-2">
              JPG · PNG · WebP · tối đa 30 MB
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </label>
          )}
          {preview && (
            <img
              src={preview}
              className="max-h-48 w-full rounded-2xl object-cover"
              alt="Ảnh vừa chọn"
            />
          )}
          <Status error={action.error} />
        </ModalBody>
        <ModalFooter>
          <Btn icon="close" onClick={onClose}>
            Hủy
          </Btn>
          <Btn
            icon="save"
            primary
            isLoading={action.pending}
            onClick={() =>
              action.run(async (signal) => {
                if (mode === "upload" && !image)
                  throw new Error("Hãy chọn ảnh.");
                if (image?.size > 30 * 1024 * 1024)
                  throw new Error("Ảnh tối đa 30 MB.");
                const data = new FormData();
                data.append("name", name);
                data.append("shared", String(shared));
                data.append("preferences", JSON.stringify(values));
                data.append("image_mode", mode);
                data.append("language", lang);
                if (image) data.append("image", image);
                await request(
                  theme ? `/api/themes/${theme.id}/` : "/api/themes/",
                  "POST",
                  data,
                  signal,
                );
                onSaved();
                onClose();
              })
            }
          >
            Lưu theme
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
export default function ThemeLibrary({ prefs, lang, staff }) {
  const resource = useResource("/api/themes/", true),
    action = useAction();
  const [editor, setEditor] = useState(undefined),
    [selected, setSelected] = useState(undefined),
    [scope, setScope] = useState(lang),
    [remove, setRemove] = useState(null),
    [notice, setNotice] = useState("");
  const changed = () => {
    resource.reload();
    setNotice(
      "Đã lưu. Đăng xuất rồi đăng nhập lại để cập nhật giao diện đã chọn.",
    );
  };
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2>
          Theme{" "}
          <span className="text-sm text-(--muted)">
            {resource.data?.own_count ?? 0}/5
          </span>
        </h2>
        <div className="flex gap-2">
          <Btn
            icon="undo"
            onClick={() => {
              setSelected(null);
              setScope(lang);
            }}
          >
            Dùng nền mặc định
          </Btn>
          <Btn
            icon="plus"
            isDisabled={!resource.data || resource.data.own_count >= 5}
            onClick={() => setEditor(null)}
          >
            Tạo theme từ giao diện hiện tại
          </Btn>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {resource.data?.themes.map((theme) => (
          <article
            key={theme.id}
            className="glass flex items-center gap-3 rounded-2xl p-3"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-current/20"
              style={{
                color:
                  theme.preferences.textColor === "auto"
                    ? undefined
                    : theme.preferences.textColor,
              }}
              aria-hidden="true"
            >
              Aa
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold">{theme.name}</h3>
              <p className="text-xs text-(--muted)">
                {theme.system ? "Hệ thống" : "Cá nhân"}
                {theme.has_image ? " · Ảnh nền" : ""}
                {["de", "en"]
                  .filter((l) => resource.data.selected[l] === theme.id)
                  .map((l) => ` · ${l.toUpperCase()} đã chọn`)
                  .join("")}
              </p>
            </div>
            <div className="flex gap-1">
              <Btn
                icon="check"
                onClick={() => {
                  setSelected(theme);
                  setScope(lang);
                }}
              >
                Áp dụng theme
              </Btn>
              {theme.can_edit && (
                <>
                  <Btn icon="edit" onClick={() => setEditor(theme)}>
                    Sửa theme
                  </Btn>
                  <Btn icon="trash" onClick={() => setRemove(theme)}>
                    Xóa theme
                  </Btn>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {resource.data?.themes.length === 0 && (
        <p className="text-sm text-(--muted)">
          Lưu giao diện bạn thích thành theme bằng dấu +.
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Status error={resource.error || action.error} />
      {editor !== undefined && (
        <ThemeEditor
          theme={editor}
          {...{ prefs, staff, lang }}
          onClose={() => setEditor(undefined)}
          onSaved={changed}
        />
      )}
      {selected !== undefined && (
        <Modal
          isOpen
          onClose={() => setSelected(undefined)}
          classNames={{ base: "glass dialog" }}
        >
          <ModalContent>
            <ModalHeader>{selected?.name || "Nền mặc định"}</ModalHeader>
            <ModalBody>
              <Select label="Áp dụng cho" value={scope} onChange={setScope}>
                <option value="de">Tiếng Đức</option>
                <option value="en">Tiếng Anh</option>
                <option value="both">Cả hai không gian</option>
              </Select>
              <p className="text-sm">Có hiệu lực từ lần đăng nhập tiếp theo.</p>
              <Status error={action.error} />
            </ModalBody>
            <ModalFooter>
              <Btn
                icon="check"
                primary
                isLoading={action.pending}
                onClick={() =>
                  action.run(async (signal) => {
                    await request(
                      "/api/themes/select/",
                      "POST",
                      { theme_id: selected?.id ?? null, scope },
                      signal,
                    );
                    changed();
                    setSelected(undefined);
                  })
                }
              >
                Áp dụng
              </Btn>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {remove && (
        <Confirm
          title="Xóa theme?"
          description="Các không gian đang chọn theme này sẽ trở về nền mặc định ở lần đăng nhập tiếp theo."
          onClose={() => setRemove(null)}
          onConfirm={async (signal) => {
            await request(
              `/api/themes/${remove.id}/delete/`,
              "DELETE",
              undefined,
              signal,
            );
            changed();
          }}
        />
      )}
    </section>
  );
}

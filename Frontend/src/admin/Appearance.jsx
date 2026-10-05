import { useRef, useState } from "react";
import { request, useResource, useAction } from "../core";
import { Btn, Glass, Heading, Loading, Page, Status } from "../ui";

export default function Appearance({ backgroundUrl = "" }) {
  const resource = useResource("/api/manage/appearance/"),
    input = useRef(null),
    action = useAction(),
    [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");

  const upload = () =>
    action.run(async (signal) => {
      if (!selected) throw new Error("Hãy chọn một ảnh nền.");
      if (selected.size > 30 * 1024 * 1024)
        throw new Error("Ảnh tối đa 30 MB.");
      const body = new FormData();
      body.append("background_image", selected);
      await request("/api/manage/appearance/", "POST", body, signal);
      setSelected(null);
      resource.reload();
      setNotice("Đã lưu. Đăng xuất rồi đăng nhập lại để cập nhật nền.");
    });

  const remove = () =>
    action.run(async (signal) => {
      await request("/api/manage/appearance/", "DELETE", undefined, signal);
      resource.reload();
      setNotice("Đã lưu. Đăng xuất rồi đăng nhập lại để cập nhật nền.");
    });

  return (
    <Page>
      <Heading
        eyebrow="WORTIFY STUDIO · GIAO DIỆN"
        title="Một nền chung cho mọi người học."
        description="Ảnh nền do quản trị viên cập nhật sẽ được dùng đồng nhất trong toàn bộ không gian Wortify."
      />
      {notice && <p role="status">{notice}</p>}
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
        {(data) => (
          <div className="appearance-layout">
            <Glass className="appearance-editor">
              <div className="appearance-heading">
                <div>
                  <span className="eyebrow">ẢNH NỀN HIỆN TẠI</span>
                  <h2>
                    {data.background_image
                      ? "Đang sử dụng ảnh nền chung"
                      : "Đang dùng nền mặc định"}
                  </h2>
                </div>
                <span className="appearance-status">
                  {data.background_image ? "Đã bật" : "Mặc định"}
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
                <Btn onClick={() => input.current?.click()}>Chọn ảnh mới</Btn>
                <span className="appearance-file">
                  {selected
                    ? selected.name
                    : "PNG, JPG hoặc WebP · tối đa 30 MB"}
                </span>
              </div>
              <div className="toolbar">
                <Btn
                  primary
                  isLoading={action.pending}
                  isDisabled={!selected}
                  onClick={upload}
                >
                  Lưu ảnh nền
                </Btn>
                {data.background_image && (
                  <Btn isLoading={action.pending} onClick={remove}>
                    Dùng lại nền mặc định
                  </Btn>
                )}
              </div>
              <Status error={action.error} />
            </Glass>
            <Glass className="appearance-guide">
              <span className="tile-icon">✦</span>
              <h2>Gợi ý hình ảnh</h2>
              <ul>
                <li>Chọn ảnh ngang, ít chi tiết để chữ vẫn dễ đọc.</li>
                <li>
                  Ảnh được áp dụng chung cho tất cả tài khoản đã đăng nhập.
                </li>
                <li>Thay đổi có hiệu lực từ lần đăng nhập tiếp theo.</li>
              </ul>
            </Glass>
          </div>
        )}
      </Loading>
    </Page>
  );
}

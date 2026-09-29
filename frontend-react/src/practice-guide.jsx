import { useState } from "react";
import { PracticeModal } from "./practice-workspace";
import { Page, Heading, Link, SidebarTools, Select, Btn, Icon } from "./ui";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types";
import {
  TEXT_GUIDE,
  textTemplate,
  completePracticeGuide,
} from "./practice-text";
import { PracticeRichText, TEXT_COLORS } from "./practice-rich-text";

const panel =
  "glass rounded-3xl border border-(--line) bg-(--surface) p-5 sm:p-7 backdrop-blur-xl shadow-sm";
function Download({ text, name, label }) {
  return (
    <a
      className="btn"
      title={label}
      aria-label={label}
      download={name}
      href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
    >
      <Icon name="download" />
    </a>
  );
}
export function PracticeGuide({ lang }) {
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [mode, setMode] = useState("cloze_drag_drop");
  const [style, setStyle] = useState("drag_drop");
  const [color, setColor] = useState("blue");
  const fullGuide = completePracticeGuide();
  const template = textTemplate(mode, style);
  const colorExample = `[color=${color}]Your text[/color]`;
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Đã sao chép.");
    } catch {
      setNotice("Chưa sao chép được. Bạn có thể chọn văn bản hoặc tải tệp.");
    }
  };
  const code = (text) => (
    <pre
      className="my-3 max-h-[55vh] overflow-auto whitespace-pre-wrap wrap-anywhere rounded-2xl border border-(--line) bg-transparent p-4 text-sm leading-7"
      tabIndex={0}
    >
      {text}
    </pre>
  );
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="flex flex-wrap gap-2">
          <Link
            className="btn"
            to={`/${lang}/create`}
            title="My Exercise Library"
            aria-label="My Exercise Library"
          >
            <Icon name="home" />
          </Link>
          <Link
            className="btn"
            to={`/${lang}/create/new`}
            title="Tạo bài tập"
            aria-label="Tạo bài tập"
          >
            <Icon name="plus" />
          </Link>
          <Btn icon="download" onClick={() => setDialog("full")}>
            Hướng dẫn và tất cả mẫu
          </Btn>
        </div>
      </SidebarTools>
      <div className="mx-auto grid w-full max-w-5xl gap-6 text-(--ink)">
        <Heading title="Hướng dẫn tạo bài tập" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "01",
              "Chọn mẫu",
              "7 dạng bài, 11 style. Chọn mẫu bên dưới để bắt đầu.",
            ],
            [
              "02",
              "Viết nội dung",
              "Lưu tệp .txt dạng UTF-8. Thêm EXERCISE: để viết nhiều bài trong cùng tệp.",
            ],
            [
              "03",
              "Preview & lưu",
              "Nhập tệp vào folde trong Create, kiểm tra rồi lưu. Có thể bổ sung ảnh và MP3.",
            ],
          ].map(([n, title, body]) => (
            <article key={n} className={panel}>
              <span className="text-sm font-bold text-(--accent)">{n}</span>
              <h2 className="my-2 text-lg font-semibold">{title}</h2>
              <p className="leading-7">{body}</p>
            </article>
          ))}
        </div>
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Thư viện mẫu</h2>
            <Btn icon="download" onClick={() => setDialog("full")}>
              Tải toàn bộ hướng dẫn và mẫu
            </Btn>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXERCISE_TYPES.map(([key, title, number]) => (
              <button
                type="button"
                key={key}
                className="flex items-center gap-4 rounded-2xl border border-(--line) bg-transparent p-4 text-left transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-(--accent)"
                onClick={() => {
                  setMode(key);
                  setStyle(exerciseStylesOf(key)[0][0]);
                  setDialog("template");
                }}
              >
                <span className="font-bold text-(--accent)">{number}</span>
                <span className="flex-1 font-semibold">{title}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
        <section className={panel}>
          <h2 className="text-xl font-semibold">Định dạng nội dung</h2>
          <p className="mt-2 leading-7">
            Dùng trong hướng dẫn, đoạn đọc, giải thích và câu hỏi. Giữ đáp án và
            từ tương tác ở dạng văn bản thuần.
          </p>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            {["**Bold text**", "*Italic text*"].map((text) => (
              <div
                key={text}
                className="flex items-center justify-between gap-3 rounded-2xl border border-(--line) p-4"
              >
                <div>
                  <code className="text-sm">{text}</code>
                  <p className="mt-2">
                    <PracticeRichText>{text}</PracticeRichText>
                  </p>
                </div>
                <Btn icon="copy" onClick={() => copy(text)}>
                  Sao chép cú pháp
                </Btn>
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            role="group"
            aria-label="20 màu văn bản"
          >
            {Object.entries(TEXT_COLORS).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                aria-pressed={color === name}
                title={name}
                aria-label={`Màu ${name}`}
                onClick={() => setColor(name)}
                className={`grid justify-items-center gap-2 rounded-xl border p-2 text-xs ${color === name ? "border-(--accent)" : "border-transparent"}`}
              >
                <span
                  className="h-5 w-5 rounded-full ring-1 ring-current"
                  style={{ backgroundColor: hex }}
                />
                {name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line) p-4">
            <div>
              <code className="text-sm">{colorExample}</code>
              <p className="mt-2">
                <PracticeRichText>{colorExample}</PracticeRichText>
              </p>
            </div>
            <Btn icon="copy" onClick={() => copy(colorExample)}>
              Sao chép màu đã chọn
            </Btn>
          </div>
          <p className="mt-4 text-sm leading-7">
            Đóng định dạng trước mỗi ô trống. Riêng dạng sửa lỗi, giữ câu hỏi ở
            dạng thuần để người học chỉnh từng từ. Chọn màu phù hợp với nền bài
            học.
          </p>
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Quy tắc & tài liệu</h2>
            <div className="flex gap-2">
              <Btn icon="copy" onClick={() => copy(fullGuide)}>
                Sao chép toàn bộ hướng dẫn và mẫu
              </Btn>
              <Download
                text={fullGuide}
                name="practice-complete-guide.txt"
                label="Tải toàn bộ hướng dẫn và mẫu"
              />
              <Btn icon="eye" onClick={() => setDialog("rules")}>
                Đọc quy tắc
              </Btn>
            </div>
          </div>
          <p className="mt-3 leading-7">
            Từ khóa và cú pháp bằng tiếng Anh; nội dung có thể dùng bất kỳ ngôn
            ngữ nào. Tối đa 100 bài mỗi lượt nhập, 100 câu mỗi bài, 2 MB văn
            bản.
          </p>
          <p className="mt-2 leading-7">
            Ảnh và MP3 là tùy chọn, tổng tối đa 200 MB/bài. Gắn cho cả bài hoặc
            từng câu trong Media; tệp đính kèm không nằm trong bản .txt.
          </p>
        </section>
        <p role="status" className="text-sm">
          {notice}
        </p>
      </div>
      {dialog && (
        <PracticeModal
          title={
            dialog === "template"
              ? "Mẫu bài tập"
              : dialog === "rules"
                ? "Quy tắc .txt"
                : "Hướng dẫn đầy đủ"
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "template" && (
            <Select label="Style" value={style} onChange={setStyle}>
              {exerciseStylesOf(mode).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </Select>
          )}
          <div className="flex gap-2">
            <Btn
              icon="copy"
              onClick={() =>
                copy(
                  dialog === "template"
                    ? template
                    : dialog === "rules"
                      ? TEXT_GUIDE
                      : fullGuide,
                )
              }
            >
              Sao chép nội dung
            </Btn>
            <Download
              text={dialog === "template" ? template : fullGuide}
              name={
                dialog === "template"
                  ? `${mode}-${style}.txt`
                  : "practice-complete-guide.txt"
              }
              label="Tải tệp .txt"
            />
          </div>
          <p role="status" className="text-sm">
            {notice}
          </p>
          {code(
            dialog === "template"
              ? template
              : dialog === "rules"
                ? TEXT_GUIDE
                : fullGuide,
          )}
        </PracticeModal>
      )}
    </Page>
  );
}

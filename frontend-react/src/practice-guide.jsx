import { PracticeModal } from "./practice-workspace";
import { useState } from "react";
import { Page, Heading, Link, SidebarTools, Select, Btn } from "./ui";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types";
import {
  TEXT_GUIDE,
  textTemplate,
  completePracticeGuide,
} from "./practice-text";

export function PracticeGuide({ lang }) {
  const [copyNotice, setCopyNotice] = useState("");
  const fullGuide = completePracticeGuide();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mode, setMode] = useState("cloze_drag_drop");
  const [style, setStyle] = useState("drag_drop");
  const bundle = EXERCISE_TYPES.flatMap(([mode]) =>
    exerciseStylesOf(mode).map(([style]) => textTemplate(mode, style)),
  ).join("\n");
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="studio-import-tools">
          <Link className="btn primary" to={`/${lang}/create/new`}>
            Tạo bài từ mẫu .txt
          </Link>
          <Btn icon="download" onClick={() => setTemplatesOpen(true)}>
            Chọn và tải mẫu .txt
          </Btn>
        </div>
      </SidebarTools>
      {templatesOpen && (
        <PracticeModal
          title="Thư viện mẫu bài tập"
          onClose={() => setTemplatesOpen(false)}
        >
          {" "}
          <a
            className="btn"
            download="7-dang-11-style.txt"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(bundle)}`}
          >
            Tải đủ 7 dạng · 11 style
          </a>
          <Select
            label="Dạng bài"
            value={mode}
            onChange={(value) => {
              setMode(value);
              setStyle(exerciseStylesOf(value)[0][0]);
            }}
          >
            {EXERCISE_TYPES.map(([key, title]) => (
              <option value={key} key={key}>
                {title}
              </option>
            ))}
          </Select>
          <Select label="Style" value={style} onChange={setStyle}>
            {exerciseStylesOf(mode).map(([key, title]) => (
              <option value={key} key={key}>
                {title}
              </option>
            ))}
          </Select>
          <a
            className="btn"
            download={`${mode}-${style}.txt`}
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(textTemplate(mode, style))}`}
          >
            Tải mẫu đã chọn
          </a>
        </PracticeModal>
      )}
      <div className="practice-guide">
        <Heading
          title="Tự tạo một chặng học ✨"
          description="Một tệp văn bản nhỏ, thật nhiều điều để khám phá."
        />
        <div className="guide-steps">
          <article>
            <b>01 · Chọn mẫu</b>
            <p>
              Tải mẫu .txt ở thanh Nav bên cạnh. Mở bằng Notepad hoặc trình soạn
              văn bản, lưu mã hóa UTF-8.
            </p>
          </article>
          <article>
            <b>02 · Viết bài</b>
            <p>
              Đổi tên bài, câu hỏi và đáp án. Thêm EXERCISE để tạo nhiều bài
              trong một tệp, hoặc chọn nhiều tệp cùng lúc.
            </p>
          </article>
          <article>
            <b>03 · Thử và lưu</b>
            <p>
              Trong Create, chọn “Nhập bài từ .txt”, chọn tệp, kiểm tra và làm
              thử. Chỉ khi mọi bài hợp lệ, toàn bộ lô mới được lưu vào folde
              đang chọn.
            </p>
          </article>
        </div>
        <section>
          <h2>Hướng dẫn đầy đủ và toàn bộ mẫu</h2>
          <p>
            Bản tiếng Anh gồm quy tắc, hướng dẫn và đủ 7 dạng · 11 style. Bạn có
            thể nhập trực tiếp tệp này để thử tất cả mẫu.
          </p>
          <div className="flex flex-wrap gap-3 my-4">
            <Btn
              icon="copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fullGuide);
                  setCopyNotice("Đã sao chép toàn bộ hướng dẫn và mẫu.");
                } catch {
                  setCopyNotice(
                    "Không thể sao chép tự động. Hãy chọn nội dung bên dưới để sao chép hoặc tải tệp.",
                  );
                }
              }}
            >
              Sao chép toàn bộ
            </Btn>
            <a
              className="btn"
              download="practice-complete-guide.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(fullGuide)}`}
            >
              Tải toàn bộ .txt
            </a>
          </div>
          <p role="status">{copyNotice}</p>
          <details>
            <summary>Đọc bản đầy đủ</summary>
            <pre className="text-guide" tabIndex={0}>
              {fullGuide}
            </pre>
          </details>
        </section>
        <section>
          <h2>Quy tắc chung</h2>
          <p>
            Sau khi kiểm tra .txt, bạn có thể thêm MP3 hoặc hình ảnh cho từng
            bài (không bắt buộc, tổng tối đa 200 MB/bài). Dùng icon mắt để làm
            thử trước khi lưu. Tệp đính kèm được lưu riêng, không nằm trong bản
            xuất .txt.
          </p>
          <pre className="text-guide">{TEXT_GUIDE}</pre>
          <p>
            Có thể xuống dòng trong QUESTION, INSTRUCTIONS, CONTEXT và
            EXPLANATION bằng một dòng mới bắt đầu với <code>&gt; </code>. Ví dụ:{" "}
            <code>&gt; Đây là dòng tiếp theo.</code>
          </p>
          <p>
            STYLE phải thuộc đúng TYPE. Giữ các từ khóa viết hoa; nội dung phía
            sau dấu hai chấm có thể dùng tiếng Việt, Anh hoặc Đức. Một lô nhập
            tối đa 100 bài, mỗi bài tối đa 100 câu và tổng tệp tối đa 2 MB.
          </p>
        </section>
        <section>
          <h2>Mẫu cho từng dạng</h2>
          <p>
            Đáp án dùng để tự kiểm tra. Câu sai được làm lại, câu đúng tự chuyển
            tiếp; người học chỉ lưu tiến độ, không lưu điểm.
          </p>
          {EXERCISE_TYPES.map(([mode, title, number]) => (
            <article className="guide-example" key={mode}>
              <h3>
                {number} · {title}
              </h3>
              {exerciseStylesOf(mode).map(([style, name, hint]) => (
                <details key={style}>
                  <summary>{name}</summary>
                  <p>{hint}</p>
                  <pre className="text-guide">{textTemplate(mode, style)}</pre>
                </details>
              ))}
            </article>
          ))}
        </section>
        <section>
          <h2>Sắp xếp góc học của bạn</h2>
          <p>
            Trong màn hình chính của Create, mở folde rồi chọn các bài để di
            chuyển nhiều bài hoặc gom thành một folde. Kéo thẻ vào folde để
            chuyển nhanh, hoặc dùng “Di chuyển” rồi chạm folde đích trên điện
            thoại. Hai nút mũi tên đổi thứ tự bài trong folde. Có thể hoàn tác
            lần di chuyển gần nhất.
          </p>
          <p>
            Chỉ chủ sở hữu được sửa, đổi tên, di chuyển hoặc xóa bài. Sửa nội
            dung câu hỏi bắt đầu một tiến độ mới; đổi tên và di chuyển vẫn giữ
            tiến độ đã học. Khi mở bài để sửa, tải bản .txt hiện tại để có bản
            sao trước khi chỉnh.
          </p>
        </section>
      </div>
    </Page>
  );
}

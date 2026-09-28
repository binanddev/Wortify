import { PracticeModal } from "./practice-workspace";
import { useState } from "react";
import { Page, Heading, Link, SidebarTools, Select, Btn } from "./ui";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types";
import { TEXT_GUIDE, textTemplate } from "./practice-text";

export function PracticeGuide({ lang }) {
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
          <Link to={`/${lang}/create`}>← Create</Link>
          <Link to={`/${lang}/create/new`}>Nhập bài từ .txt</Link>
          <Link to={`/${lang}/practice`}>Practice Hub · vào học</Link>
          <Btn onClick={() => setTemplatesOpen(true)}>Chọn và tải mẫu .txt</Btn>
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
              Đổi tên bài, câu hỏi và đáp án. Thêm BAI để tạo nhiều bài trong
              một tệp, hoặc chọn nhiều tệp cùng lúc.
            </p>
          </article>
          <article>
            <b>03 · Thử và lưu</b>
            <p>
              Trong Create, chọn “Nhập bài từ .txt”, chọn tệp, kiểm tra và làm
              thử. Chỉ khi mọi bài hợp lệ, toàn bộ lô mới được lưu vào thư mục
              đang chọn.
            </p>
          </article>
        </div>
        <section>
          <h2>Quy tắc chung</h2>
          <pre className="text-guide">{TEXT_GUIDE}</pre>
          <p>
            Có thể xuống dòng trong CAU, HUONG_DAN, NGU_CANH và GIAI_THICH bằng
            một dòng mới bắt đầu với <code>&gt; </code>. Ví dụ:{" "}
            <code>&gt; Đây là dòng tiếp theo.</code>
          </p>
          <p>
            STYLE phải thuộc đúng DANG. Giữ các từ khóa viết hoa; nội dung phía
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
            Trong thanh Nav của Create, chọn các bài của bạn để di chuyển nhiều
            bài hoặc gom thành một thư mục. Kéo thẻ vào thư mục để chuyển nhanh,
            hoặc dùng “Di chuyển” rồi chạm thư mục đích trên điện thoại. Hai nút
            mũi tên đổi thứ tự bài trong thư mục. Có thể hoàn tác lần di chuyển
            gần nhất.
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

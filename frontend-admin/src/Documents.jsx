import { useEffect, useState } from "react";
import { request, useResource, useAction } from "../../frontend-react/src/core";
import {
  Btn,
  Glass,
  Heading,
  Page,
  Field,
  Select,
  Loading,
  Status,
} from "../../frontend-react/src/ui";
import { BookActivity } from "../../frontend-react/src/books";
export function DownloadJson({
  value,
  name = "lernraum-chapter-v1.json",
  children = "Tải JSON mẫu",
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);
  return (
    <a className="download-template" href={url} download={name}>
      {children} ↓
    </a>
  );
}
export default function Documents() {
  const resource = useResource("/api/manage/documentation/");
  return (
    <Loading resource={resource}>
      {(data) => <Documentation data={data} />}
    </Loading>
  );
}
function Documentation({ data }) {
  const [active, setActive] = useState("cloze"),
    [language, setLanguage] = useState("en"),
    [raw, setRaw] = useState(""),
    [report, setReport] = useState(null);
  const action = useAction();
  const type = data.types.find((t) => t.id === active);
  const template = {
    schema_version: 1,
    book: { language },
    chapter: { number: 1, title: "My first chapter" },
    theory: {
      explanation: "Nội dung lý thuyết",
      rules: [],
      tables: [],
      usage_notes: [],
    },
    examples: [],
    exercises: [type.example],
  };
  return (
    <Page>
      <Heading
        eyebrow="CONTENT STUDIO · TÀI LIỆU"
        title="Một cấu trúc rõ ràng. Nhiều cách học."
        description="Chọn cách học trước, rồi số hóa nội dung. Cùng một loại bài luôn có cùng cách tương tác ở trang học."
      />
      <div className="documentation-intro">
        <Glass>
          <span className="eyebrow">01 · CHỌN LOẠI</span>
          <h3>Xem cách học sinh làm bài</h3>
          <p>Mỗi loại bên dưới có giao diện thử và một JSON mẫu đầy đủ.</p>
        </Glass>
        <Glass>
          <span className="eyebrow">02 · ĐIỀN NỘI DUNG</span>
          <h3>Giữ mã, thay câu hỏi</h3>
          <p>
            chapter.number xác định chương; exercises[].id xác định bài. Cùng mã
            sẽ cập nhật, mã mới sẽ thêm.
          </p>
        </Glass>
        <Glass>
          <span className="eyebrow">03 · KIỂM TRA</span>
          <h3>Sửa trước khi xuất bản</h3>
          <p>
            Loại chưa rõ được lưu nháp, không đưa ngay cho người học. Staff có
            thể phân loại lại trong quản trị.
          </p>
        </Glass>
      </div>
      <div className="documentation-layout">
        <nav aria-label="Các dạng bài" className="type-nav">
          {data.types.map((t) => (
            <button
              key={t.id}
              className={active === t.id ? "active" : ""}
              onClick={() => setActive(t.id)}
              aria-current={active === t.id ? "true" : undefined}
            >
              <strong>{t.label}</strong>
              <code>{t.id}</code>
            </button>
          ))}
        </nav>
        <section className="type-document">
          <h2>{type.label}</h2>
          <p>{type.description}</p>
          <div className="schema-rule">{type.rule}</div>
          <BookActivity key={active} data={type.preview} preview />
          <div className="toolbar">
            <Select
              label="Ngôn ngữ mẫu"
              value={language}
              onChange={setLanguage}
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </Select>
            <DownloadJson value={template} />
            <Btn
              onClick={() => {
                setRaw(JSON.stringify(template, null, 2));
                setReport(null);
              }}
            >
              Đưa mẫu vào trình kiểm tra
            </Btn>
          </div>
          <details>
            <summary>Xem JSON của dạng bài này</summary>
            <pre className="json-sample">
              {JSON.stringify(template, null, 2)}
            </pre>
          </details>
        </section>
      </div>
      <Glass className="schema-playground">
        <h2>Kiểm tra & chuẩn hóa JSON</h2>
        <p>
          Dán một chương từ sách cũ hoặc mẫu vừa sửa. Công cụ kiểm tra cấu trúc
          và chỉ ra bài cần phân loại; chưa ghi vào thư viện.
        </p>
        <Field
          label="JSON chương cần kiểm tra"
          multiline
          minRows={16}
          value={raw}
          onChange={(v) => {
            setRaw(v);
            setReport(null);
          }}
        />
        <div className="toolbar">
          <Btn
            primary
            isDisabled={!raw.trim()}
            isLoading={action.pending}
            onClick={() =>
              action.run(async (signal) => {
                let document;
                try {
                  document = JSON.parse(raw);
                } catch (e) {
                  throw new Error("JSON chưa đúng cú pháp: " + e.message);
                }
                setReport(
                  await request(
                    "/api/manage/documentation/",
                    "POST",
                    { document, language },
                    signal,
                  ),
                );
              })
            }
          >
            Kiểm tra cấu trúc
          </Btn>
          {report && (
            <DownloadJson
              value={report.document}
              name="normalized-chapter.json"
            >
              Tải JSON đã chuẩn hóa
            </DownloadJson>
          )}
        </div>
        <Status error={action.error} />
        {report && (
          <div className="validation-report" role="status">
            <h3>
              Chương {report.summary.number}: {report.summary.title}
            </h3>
            <p>
              {report.summary.exercises} bài · {report.summary.drafts} bài cần
              sửa trước khi xuất bản
            </p>
            {report.summary.classification.map((r, i) => (
              <div key={i}>
                <strong>
                  {r.id} → {r.type}
                </strong>
                <span>
                  {r.needs_review
                    ? " · Cần phân loại / sửa bố cục"
                    : " · Đã nhận diện"}
                </span>
                {r.warnings.map((w, j) => (
                  <p key={j}>{w}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Glass>
      <div className="documentation-notes">
        <h2>Quy ước chung</h2>
        <details open>
          <summary>Cấu trúc sách, chương và lý thuyết</summary>
          <p>
            Một JSON chứa một chương. chapter.number là số nguyên dương,
            chapter.title là tiêu đề. exercises là danh sách bài có id,
            instruction, type, items. Tệp bổ sung cùng chương chỉ cập nhật các
            bài có trong tệp; không xóa các bài khác.
          </p>
          <p>
            theory.explanation: văn bản; rules và usage_notes: danh sách văn
            bản; tables: bảng gồm title, headers và rows. examples nhận chuỗi
            hoặc đối tượng có text. Nội dung được hiển thị như văn bản, không
            chèn HTML.
          </p>
        </details>
        <details>
          <summary>Đáp án và cách chấm</summary>
          <p>
            Với text và từng ô cloze, mảng answer là các cách trả lời thay thế.
            Với multi và wordset, đó là toàn bộ tập đáp án đúng. Với order, đó
            là thứ tự mã tokens. Không dùng một chuỗi đáp án để đại diện nhiều ô
            trống.
          </p>
          <p>
            grading.ignore_case và grading.ignore_punctuation bật/tắt bỏ qua hoa
            thường, dấu câu. writing luôn lưu bài tự luyện. Thiếu đáp án không
            được tự coi là sai; quản trị sẽ thấy cảnh báo.
          </p>
        </details>
        <details>
          <summary>Ảnh, audio và giới hạn nhập</summary>
          <p>
            resources: [&#123;"type":"image", "file":"images/U01.png",
            "description":"Mô tả ảnh"&#125;]. Audio dùng type audio. Tải tệp
            riêng ở mục Hình ảnh & âm thanh với cùng đường dẫn. Không dùng đường
            dẫn ổ đĩa, dấu .. hoặc nhúng base64.
          </p>
          <p>
            Tối đa 20 tệp JSON/lượt, 5 MB/tệp, 20 MB tổng; ảnh/audio 20 tệp, 10
            MB/tệp, 50 MB tổng. Database và media là nội dung dùng khi triển
            khai; không cần thư mục book/.
          </p>
        </details>
        <details>
          <summary>Tên loại cũ vẫn được hỗ trợ</summary>
          <ul>
            {Object.entries(data.aliases).map(([a, b]) => (
              <li key={a}>
                <code>{a}</code> → <code>{b}</code>
              </li>
            ))}
          </ul>
          <p>
            Không rõ type: chọn lại trong bản xem trước hoặc lưu nháp để biên
            tập sau. Công cụ không tự đoán đáp án hay tách một đáp án thành
            nhiều ô.
          </p>
        </details>
      </div>
    </Page>
  );
}

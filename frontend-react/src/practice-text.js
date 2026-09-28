import { canFillGapBank } from "./gap-tokens.js";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types.js";

export const TEXT_GUIDE = `Mỗi bài bắt đầu bằng BAI: tên bài. Các trường dùng dấu hai chấm.
DANG: mã dạng bài; STYLE: mã kiểu tương tác (xem mẫu).
HUONG_DAN: yêu cầu; NGU_CANH: bài đọc dùng chung; NHOM: các nhóm, phân cách bằng |.
Mỗi câu bắt đầu bằng CAU: nội dung. DAP_AN: đáp án; dùng | cho các đáp án tương đương.
Điền từ / chọn trong câu: đánh dấu {{1}}, {{2}}…; mỗi dòng O: đáp án => lựa chọn 1 | lựa chọn 2.
TU: ngân hàng từ (điền từ) hoặc các mảnh theo đúng thứ tự đáp án (sắp xếp câu), phân cách bằng |.
Mỗi từ trong TU chỉ dùng một lần; lặp lại từ trong TU nếu nhiều ô cần cùng một từ.
GOI_Y: phần đầu câu viết lại; đáp án luôn là cả câu. GIAI_THICH: giải thích sau khi chấm.
PHAN_BIET_HOA: co và GIU_DAU_CAU: co (trước CAU) bật chấm chính xác chữ hoa và dấu câu. Mặc định bỏ qua.
VI_DU: co (sau CAU) đánh dấu câu ví dụ, không tính vào tiến độ; vẫn cần ít nhất một câu thực hành.
Tìm/sửa lỗi và gạch từ thừa: DAP_AN là cả câu sau khi sửa.
Nối cặp / phân loại: mỗi CAU là một thẻ, DAP_AN là thẻ ghép / tên nhóm.
Dòng trống và dòng bắt đầu bằng # được bỏ qua. Dòng bắt đầu bằng > nối tiếp nội dung văn bản của trường trước.
Không dùng | hay => bên trong một mục. Có thể nhập nhiều bài bằng nhiều dòng BAI.
Giới hạn: 100 bài, 100 câu mỗi bài, 2 MB. Lỗi có số dòng để sửa.`;

const samples = {
  cloze_drag_drop:
    "CAU: I {{1}} coffee in the {{2}}.\nO: drink => drink | eat\nO: morning => morning | evening\nTU: morning | drink | eat",
  error_correction:
    "CAU: He do not like sports.\nDAP_AN: He does not like sports.",
  matching: "CAU: cat\nDAP_AN: mèo\nCAU: dog\nDAP_AN: chó",
  sentence_building:
    "CAU: Sắp xếp thành câu đúng.\nTU: She | is | reading | a book.",
  categorization:
    "NHOM: Fruit | Animals\nCAU: apple\nDAP_AN: Fruit\nCAU: cat\nDAP_AN: Animals",
  inline_selection: "CAU: She {{1}} a doctor.\nO: is => is | are",
  short_answer:
    "CAU: Rewrite: He began learning English two years ago.\nGOI_Y: He has\nDAP_AN: He has learned English for two years. | He has been learning English for two years.",
};
export function textTemplate(
  mode = "cloze_drag_drop",
  style = exerciseStylesOf(mode)[0][0],
) {
  const sample =
    mode === "error_correction" && style === "cross_out"
      ? "CAU: They discussed about the project yesterday.\nDAP_AN: They discussed the project yesterday."
      : samples[mode];
  return `BAI: ${EXERCISE_TYPES.find((t) => t[0] === mode)?.[1] || "Bài luyện tập"}\nDANG: ${mode}\nSTYLE: ${style}\nHUONG_DAN: Hoàn thành các câu bên dưới.\n${sample}\n`;
}
export function exerciseToText(e) {
  const mode = e.presentation?.interaction;
  if (!EXERCISE_TYPES.some((t) => t[0] === mode)) return "";
  const fallback =
    mode === "short_answer" && !e.questions.every((q) => q.presentation?.prefix)
      ? "sentence_rewrite"
      : exerciseStylesOf(mode)[0][0];
  const style = exerciseStylesOf(mode).some(
    (s) => s[0] === e.presentation.style,
  )
    ? e.presentation.style
    : fallback;
  const lines = [`BAI: ${e.title}`, `DANG: ${mode}`, `STYLE: ${style}`];
  if (e.ignore_case === false) lines.push("PHAN_BIET_HOA: co");
  if (e.ignore_punctuation === false) lines.push("GIU_DAU_CAU: co");
  if (e.instruction) lines.push(`HUONG_DAN: ${e.instruction}`);
  if (e.context) lines.push(`NGU_CANH: ${e.context}`);
  if (e.presentation.categories?.length)
    lines.push(`NHOM: ${e.presentation.categories.join(" | ")}`);
  for (const q of e.questions || []) {
    lines.push("", `CAU: ${q.prompt}`);
    if (q.example) lines.push("VI_DU: co");
    if (mode === "sentence_building")
      lines.push(
        `TU: ${q.accepted_answers.map((id) => q.presentation.tokens.find((t) => t.id === id)?.text).join(" | ")}`,
      );
    else if (q.accepted_answers?.length)
      lines.push(`DAP_AN: ${q.accepted_answers.join(" | ")}`);
    for (const b of q.blanks || [])
      lines.push(
        `O: ${b.answers.join(" | ")}${b.options?.length ? " => " + b.options.join(" | ") : ""}`,
      );
    if (mode === "cloze_drag_drop" && q.presentation?.word_bank?.length)
      lines.push(`TU: ${q.presentation.word_bank.join(" | ")}`);
    if (q.presentation?.prefix) lines.push(`GOI_Y: ${q.presentation.prefix}`);
    if (q.presentation?.explanation)
      lines.push(`GIAI_THICH: ${q.presentation.explanation}`);
  }
  return lines.map((line) => line.replace(/\n/g, "\n> ")).join("\n");
}
export function parsePracticeText(text) {
  if (new TextEncoder().encode(text).length > 2000000)
    throw new Error("Tệp tối đa 2 MB.");
  const nodes = [];
  let e, q;
  let line = 0;
  let continuation;
  const fail = (message) => {
    throw new Error(`Dòng ${line}: ${message}`);
  };
  const list = (value) => {
    const items = value.split("|").map((s) => s.trim());
    if (items.some((s) => !s)) fail("Không để trống mục giữa các dấu |.");
    return items;
  };
  const seen = new WeakMap();
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    line++;
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    if (s.startsWith(">")) {
      if (!continuation) fail("Dòng > chỉ dùng sau trường văn bản.");
      const [target, key] = continuation;
      target[key] += "\n" + s.slice(1).trimStart();
      continue;
    }
    continuation = null;
    const match = s.match(/^([A-Z_]+):\s*(.+)$/);
    if (!match) fail("Cần TÊN_TRƯỜNG: nội dung.");
    const [, key, value] = match;
    if (key === "BAI") {
      e = {
        title: value,
        instruction: "",
        kind: "text",
        presentation: {},
        questions: [],
        ignore_case: true,
        ignore_punctuation: true,
      };
      nodes.push({ kind: "exercise", title: value, payload: e });
      q = null;
      if (nodes.length > 100) fail("Tối đa 100 bài.");
      continue;
    }
    if (!e) fail("Bắt đầu bằng BAI: tên bài.");
    if (key === "CAU") {
      q = {
        prompt: value,
        accepted_answers: [],
        options: [],
        blanks: [],
        presentation: {},
        _line: line,
      };
      e.questions.push(q);
      continuation = [q, "prompt"];
      continue;
    }
    const isHeader = [
      "DANG",
      "STYLE",
      "HUONG_DAN",
      "NGU_CANH",
      "NHOM",
      "PHAN_BIET_HOA",
      "GIU_DAU_CAU",
    ].includes(key);
    if (isHeader && q) fail("Đặt thông tin bài trước CAU đầu tiên.");
    const target = isHeader ? e : q;
    if (!target) fail("Đặt trường này sau CAU.");
    if (key !== "O") {
      const keys = seen.get(target) || new Set();
      if (keys.has(key)) fail(`Trường ${key} bị lặp.`);
      keys.add(key);
      seen.set(target, keys);
    }
    switch (key) {
      case "DANG":
        e.presentation.interaction = value;
        break;
      case "STYLE":
        e.presentation.style = value;
        break;
      case "HUONG_DAN":
        e.instruction = value;
        continuation = [e, "instruction"];
        break;
      case "NGU_CANH":
        e.context = value;
        continuation = [e, "context"];
        break;
      case "NHOM":
        e.presentation.categories = list(value);
        break;
      case "PHAN_BIET_HOA":
        if (!["co", "khong"].includes(value)) fail("Dùng co hoặc khong.");
        e.ignore_case = value === "khong";
        break;
      case "GIU_DAU_CAU":
        if (!["co", "khong"].includes(value)) fail("Dùng co hoặc khong.");
        e.ignore_punctuation = value === "khong";
        break;
      case "VI_DU":
        if (!["co", "khong"].includes(value)) fail("Dùng co hoặc khong.");
        q.example = value === "co";
        break;
      case "DAP_AN":
        q.accepted_answers = list(value);
        break;
      case "TU":
        q.presentation.word_bank = list(value);
        break;
      case "GOI_Y":
        q.presentation.prefix = value;
        break;
      case "GIAI_THICH":
        q.presentation.explanation = value;
        continuation = [q.presentation, "explanation"];
        break;
      case "O": {
        const parts = value.split("=>");
        if (parts.length > 2) fail("Mỗi O chỉ dùng một dấu =>.");
        q.blanks.push({
          answers: list(parts[0]),
          options: parts[1] ? list(parts[1]) : [],
        });
        break;
      }
      default:
        fail(`Trường ${key} không được hỗ trợ.`);
    }
  }
  if (!nodes.length) fail("Chưa có bài tập.");
  for (const node of nodes) {
    e = node.payload;
    const mode = e.presentation.interaction;
    const type = EXERCISE_TYPES.find((t) => t[0] === mode);
    if (e.title.length > 200) fail("Tên bài tối đa 200 ký tự.");
    if (!type) fail(`Bài ${e.title}: DANG không hợp lệ.`);
    e.kind = type[3];
    e.check_mode = "auto_check";
    if (
      e.presentation.style &&
      !exerciseStylesOf(mode).some((s) => s[0] === e.presentation.style)
    )
      fail(`Bài ${e.title}: STYLE không hợp lệ.`);
    if (!e.questions.length || e.questions.length > 100)
      fail("Mỗi bài cần 1–100 câu.");
    if (e.questions.every((q) => q.example))
      fail("Cần ít nhất một câu thực hành, không phải VI_DU.");
    const pairs = e.questions.map((q) => q.accepted_answers[0]);
    if (mode === "matching" && new Set(pairs).size !== pairs.length)
      fail("Nối cặp cần các đáp án khác nhau.");
    for (const [i, question] of e.questions.entries()) {
      q = question;
      line = q._line;
      delete q._line;
      q.id = String(i + 1);
      q.position = i + 1;
      q.kind = e.kind;
      if (mode === "sentence_building") {
        if (!q.presentation.word_bank?.length) fail("Cần TU theo thứ tự đúng.");
        q.presentation.tokens = q.presentation.word_bank.map((text, i) => ({
          id: String(i + 1),
          text,
        }));
        q.accepted_answers = q.presentation.tokens.map((t) => t.id);
      }
      if (mode === "categorization") {
        q.options = e.presentation.categories || [];
        if (
          q.options.length < 2 ||
          new Set(q.options).size !== q.options.length
        )
          fail("Cần ít nhất hai NHOM khác nhau.");
      }
      if (mode === "matching") q.options = pairs;
      if (
        ["matching", "categorization"].includes(mode) &&
        (q.accepted_answers.length !== 1 ||
          !q.options.includes(q.accepted_answers[0]))
      )
        fail("Cần một đáp án nằm trong nhóm / cặp.");
      if (e.kind === "cloze") {
        const marks = [...q.prompt.matchAll(/\{\{(\d+)\}\}/g)]
          .map((m) => +m[1])
          .sort((a, b) => a - b);
        if (
          !q.blanks.length ||
          JSON.stringify(marks) !==
            JSON.stringify(q.blanks.map((_, i) => i + 1))
        )
          fail("Các ô {{1}}… phải khớp số dòng O, không lặp ô.");
        if (
          mode === "inline_selection" &&
          q.blanks.some(
            (b) =>
              b.options.length < 2 ||
              b.answers.some((a) => !b.options.includes(a)),
          )
        )
          fail("Mỗi O cần ít nhất hai lựa chọn, có chứa đáp án.");
        if (mode === "cloze_drag_drop")
          q.presentation.word_bank ||= q.blanks.flatMap((b) =>
            b.answers.slice(0, 1),
          );
        if (
          mode === "cloze_drag_drop" &&
          !canFillGapBank(q.blanks, q.presentation.word_bank)
        )
          fail(
            "TU phải đủ từ cho mọi ô; nếu dùng một từ hai lần, hãy ghi từ đó hai lần.",
          );
      } else if (q.blanks.length) fail("Dạng này không dùng O.");
      if (!q.blanks.length && !q.accepted_answers.length) fail("Cần DAP_AN.");
      if (
        q.presentation.prefix &&
        q.accepted_answers.some((a) => !a.startsWith(q.presentation.prefix))
      )
        fail("Đáp án phải bắt đầu bằng GOI_Y.");
      if (
        mode === "short_answer" &&
        e.presentation.style === "partial_input" &&
        !q.presentation.prefix
      )
        fail("Kiểu viết tiếp câu cần GOI_Y.");
      if (mode === "error_correction" && e.presentation.style === "cross_out") {
        const original = q.prompt.split(/\s+/);
        if (
          !q.accepted_answers.some((answer) => {
            let cursor = 0;
            const target = answer.split(/\s+/);
            for (const word of original) if (word === target[cursor]) cursor++;
            return cursor === target.length && target.length < original.length;
          })
        )
          fail(
            "Gạch từ thừa: đáp án phải tạo được bằng cách bỏ từ trong câu gốc.",
          );
      }
    }
  }
  return { nodes };
}

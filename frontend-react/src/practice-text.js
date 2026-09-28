import { canFillGapBank } from "./gap-tokens.js";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types.js";

const LEGACY_FIELDS = {
  BAI: "EXERCISE",
  DANG: "TYPE",
  HUONG_DAN: "INSTRUCTIONS",
  NGU_CANH: "CONTEXT",
  NHOM: "GROUPS",
  CAU: "QUESTION",
  DAP_AN: "ANSWER",
  O: "BLANK",
  TU: "WORDS",
  GOI_Y: "PREFIX",
  GIAI_THICH: "EXPLANATION",
  PHAN_BIET_HOA: "CASE_SENSITIVE",
  GIU_DAU_CAU: "KEEP_PUNCTUATION",
  VI_DU: "EXAMPLE",
};
export const TEXT_GUIDE = `PRACTICE TEXT FORMAT — UTF-8 .txt
Start each exercise with EXERCISE: title (maximum 200 characters).
Use uppercase FIELD: value keywords. Content may be in any language.
TYPE: one of the seven type identifiers below. STYLE: a supported style of that type.
Put all exercise fields before the first QUESTION.
INSTRUCTIONS: task instructions. CONTEXT: optional shared reading passage.
GROUPS: category names separated by | (categorization only; at least two unique groups).
CASE_SENSITIVE: yes/no. KEEP_PUNCTUATION: yes/no. Both default to no.
QUESTION: starts a question. Each exercise needs 1–100 questions, including at least one non-example.
ANSWER: accepted answer; separate equivalent answers with |.
BLANK: answer 1 | equivalent answer => option 1 | option 2.
Use {{1}}, {{2}}, etc. once each in the question, and one BLANK line per numbered blank, in order.
WORDS: tokens separated by |. For cloze_drag_drop these form the word bank; each token can be used once.
Repeat a token in WORDS when multiple blanks need it. If omitted, the bank uses the first answer of each blank.
For sentence_building, WORDS must list every token in the correct answer order; duplicate words are allowed.
PREFIX: beginning of the answer for short_answer. Every accepted answer must include that prefix.
EXPLANATION: optional feedback after checking. EXAMPLE: yes/no after QUESTION marks a practice example.
Blank lines and # comment lines are ignored. Use > at the start of a continuation line after QUESTION,
INSTRUCTIONS, CONTEXT or EXPLANATION. Other fields must stay on one line.
Do not put | or => inside an individual item. Repeat EXERCISE to import multiple exercises.
Each field occurs once per exercise/question except BLANK, which repeats for each blank.
Limits per import: 100 exercises, 100 questions per exercise, 2 MB total UTF-8 text.
Save as .txt, open Create, choose or create a root folder, import files, validate, preview, then save.
Optional attachments: add MP3, PNG, JPG, WebP or GIF in Create after validating the text.
Up to 20 files, 200 MB total per exercise. Attachments are stored separately and are not embedded in .txt exports.
Use preview to try each exercise before saving; preview does not save progress.
Every exercise must belong to a folder. Loose exercises are not allowed. English and German spaces are independent.
The whole batch is saved only after validation. Errors include line numbers.

TYPES AND STYLES
cloze_drag_drop: drag_drop (move word tiles), tap_fill (tap words to fill blanks).
error_correction: click_edit (edit incorrect text), cross_out (remove extra words).
  ANSWER is the entire corrected sentence. For cross_out, only remove words; do not add or reorder them.
matching: tap_match (match cards). Each QUESTION is one card; ANSWER is its unique partner.
sentence_building: tap_build (arrange tokens). WORDS defines the correct token order.
categorization: drag_sort (sort cards). Each QUESTION is one card; ANSWER is exactly one GROUPS value.
inline_selection: pill_toggle (toggle choices), inline_select (select a choice).
  Every BLANK needs at least two options, including every accepted answer.
short_answer: partial_input (complete a required PREFIX), sentence_rewrite (write the whole answer).
  ANSWER always contains the entire sentence, including PREFIX when provided.

WORKSPACE AND EDITING
Only owners can edit, rename, move or delete their content. Use the folder cards and content tools on the Create main screen for these actions.
Drag items into folders, or use the move/group tools to organize a selection.
Download the current .txt before editing if you want a backup. Editing questions starts a new progress revision.
Learners answer one question at a time, retry incorrect answers and save progress rather than scores.
Preview does not change learning progress. Workspace pins include the highest accessible parent folder.

ALL 7 TYPES AND 11 STYLES: complete importable samples follow. Lines beginning with # are documentation.`;

export function completePracticeGuide() {
  return (
    TEXT_GUIDE.split("\n")
      .map((line) => (line ? "# " + line : "#"))
      .join("\n") +
    "\n\n" +
    EXERCISE_TYPES.flatMap(([mode]) =>
      exerciseStylesOf(mode).map(
        ([style]) => `# ${mode} / ${style}\n${textTemplate(mode, style)}`,
      ),
    ).join("\n")
  );
}

const samples = {
  cloze_drag_drop:
    "QUESTION: I {{1}} coffee in the {{2}}.\nBLANK: drink => drink | eat\nBLANK: morning => morning | evening\nWORDS: morning | drink | eat",
  error_correction:
    "QUESTION: He do not like sports.\nANSWER: He does not like sports.",
  matching: "QUESTION: cat\nANSWER: mèo\nQUESTION: dog\nANSWER: chó",
  sentence_building:
    "QUESTION: Sắp xếp thành câu đúng.\nWORDS: She | is | reading | a book.",
  categorization:
    "GROUPS: Fruit | Animals\nQUESTION: apple\nANSWER: Fruit\nQUESTION: cat\nANSWER: Animals",
  inline_selection: "QUESTION: She {{1}} a doctor.\nBLANK: is => is | are",
  short_answer:
    "QUESTION: Rewrite: He began learning English two years ago.\nPREFIX: He has\nANSWER: He has learned English for two years. | He has been learning English for two years.",
};
export function textTemplate(
  mode = "cloze_drag_drop",
  style = exerciseStylesOf(mode)[0][0],
) {
  const sample =
    mode === "error_correction" && style === "cross_out"
      ? "QUESTION: They discussed about the project yesterday.\nANSWER: They discussed the project yesterday."
      : samples[mode];
  return `EXERCISE: ${EXERCISE_TYPES.find((t) => t[0] === mode)?.[1] || "Bài luyện tập"}\nTYPE: ${mode}\nSTYLE: ${style}\nINSTRUCTIONS: Hoàn thành các câu bên dưới.\n${sample}\n`;
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
  const lines = [`EXERCISE: ${e.title}`, `TYPE: ${mode}`, `STYLE: ${style}`];
  if (e.ignore_case === false) lines.push("CASE_SENSITIVE: yes");
  if (e.ignore_punctuation === false) lines.push("KEEP_PUNCTUATION: yes");
  if (e.instruction) lines.push(`INSTRUCTIONS: ${e.instruction}`);
  if (e.context) lines.push(`CONTEXT: ${e.context}`);
  if (e.presentation.categories?.length)
    lines.push(`GROUPS: ${e.presentation.categories.join(" | ")}`);
  for (const q of e.questions || []) {
    lines.push("", `QUESTION: ${q.prompt}`);
    if (q.example) lines.push("EXAMPLE: yes");
    if (mode === "sentence_building")
      lines.push(
        `WORDS: ${q.accepted_answers.map((id) => q.presentation.tokens.find((t) => t.id === id)?.text).join(" | ")}`,
      );
    else if (q.accepted_answers?.length)
      lines.push(`ANSWER: ${q.accepted_answers.join(" | ")}`);
    for (const b of q.blanks || [])
      lines.push(
        `BLANK: ${b.answers.join(" | ")}${b.options?.length ? " => " + b.options.join(" | ") : ""}`,
      );
    if (mode === "cloze_drag_drop" && q.presentation?.word_bank?.length)
      lines.push(`WORDS: ${q.presentation.word_bank.join(" | ")}`);
    if (q.presentation?.prefix) lines.push(`PREFIX: ${q.presentation.prefix}`);
    if (q.presentation?.explanation)
      lines.push(`EXPLANATION: ${q.presentation.explanation}`);
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
    const [, rawKey, rawValue] = match;
    const key = LEGACY_FIELDS[rawKey] || rawKey;
    const value = ["CASE_SENSITIVE", "KEEP_PUNCTUATION", "EXAMPLE"].includes(
      key,
    )
      ? { co: "yes", khong: "no" }[rawValue] || rawValue
      : rawValue;
    if (key === "EXERCISE") {
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
    if (!e) fail("Bắt đầu bằng EXERCISE: tên bài.");
    if (key === "QUESTION") {
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
      "TYPE",
      "STYLE",
      "INSTRUCTIONS",
      "CONTEXT",
      "GROUPS",
      "CASE_SENSITIVE",
      "KEEP_PUNCTUATION",
    ].includes(key);
    if (isHeader && q) fail("Đặt thông tin bài trước QUESTION đầu tiên.");
    const target = isHeader ? e : q;
    if (!target) fail("Đặt trường này sau QUESTION.");
    if (key !== "BLANK") {
      const keys = seen.get(target) || new Set();
      if (keys.has(key)) fail(`Trường ${key} bị lặp.`);
      keys.add(key);
      seen.set(target, keys);
    }
    switch (key) {
      case "TYPE":
        e.presentation.interaction = value;
        break;
      case "STYLE":
        e.presentation.style = value;
        break;
      case "INSTRUCTIONS":
        e.instruction = value;
        continuation = [e, "instruction"];
        break;
      case "CONTEXT":
        e.context = value;
        continuation = [e, "context"];
        break;
      case "GROUPS":
        e.presentation.categories = list(value);
        break;
      case "CASE_SENSITIVE":
        if (!["yes", "no"].includes(value)) fail("Dùng yes hoặc no.");
        e.ignore_case = value === "no";
        break;
      case "KEEP_PUNCTUATION":
        if (!["yes", "no"].includes(value)) fail("Dùng yes hoặc no.");
        e.ignore_punctuation = value === "no";
        break;
      case "EXAMPLE":
        if (!["yes", "no"].includes(value)) fail("Dùng yes hoặc no.");
        q.example = value === "yes";
        break;
      case "ANSWER":
        q.accepted_answers = list(value);
        break;
      case "WORDS":
        q.presentation.word_bank = list(value);
        break;
      case "PREFIX":
        q.presentation.prefix = value;
        break;
      case "EXPLANATION":
        q.presentation.explanation = value;
        continuation = [q.presentation, "explanation"];
        break;
      case "BLANK": {
        const parts = value.split("=>");
        if (parts.length > 2) fail("Mỗi BLANK chỉ dùng một dấu =>.");
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
    if (!type) fail(`Bài ${e.title}: TYPE không hợp lệ.`);
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
      fail("Cần ít nhất một câu thực hành, không phải EXAMPLE.");
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
        if (!q.presentation.word_bank?.length)
          fail("Cần WORDS theo thứ tự đúng.");
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
          fail("Cần ít nhất hai GROUPS khác nhau.");
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
          fail("Các ô {{1}}… phải khớp số dòng BLANK, không lặp ô.");
        if (
          mode === "inline_selection" &&
          q.blanks.some(
            (b) =>
              b.options.length < 2 ||
              b.answers.some((a) => !b.options.includes(a)),
          )
        )
          fail("Mỗi BLANK cần ít nhất hai lựa chọn, có chứa đáp án.");
        if (mode === "cloze_drag_drop")
          q.presentation.word_bank ||= q.blanks.flatMap((b) =>
            b.answers.slice(0, 1),
          );
        if (
          mode === "cloze_drag_drop" &&
          !canFillGapBank(q.blanks, q.presentation.word_bank)
        )
          fail(
            "WORDS phải đủ từ cho mọi ô; nếu dùng một từ hai lần, hãy ghi từ đó hai lần.",
          );
      } else if (q.blanks.length) fail("Dạng này không dùng BLANK.");
      if (!q.blanks.length && !q.accepted_answers.length) fail("Cần ANSWER.");
      if (
        q.presentation.prefix &&
        q.accepted_answers.some((a) => !a.startsWith(q.presentation.prefix))
      )
        fail("Đáp án phải bắt đầu bằng PREFIX.");
      if (
        mode === "short_answer" &&
        e.presentation.style === "partial_input" &&
        !q.presentation.prefix
      )
        fail("Kiểu viết tiếp câu cần PREFIX.");
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

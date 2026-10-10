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
TYPE: one of the supported type identifiers below. STYLE: a supported style of that type.
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
Up to 200 files, 200 MB total per exercise. Assign files to the whole exercise or individual questions in the Media dialog. Attachments are stored separately and are not embedded in .txt exports.
Use preview to try each exercise before saving; preview does not save progress.
Every exercise must belong to a folder. Loose exercises are not allowed. English and German spaces are independent.
The whole batch is saved only after validation. Errors include line numbers.

TEXT FORMATTING
LaTeX-style lesson markup is available: line breaks, emphasis, aligned blocks, lists, tables and images.
Open the Formatting guide in Create for supported commands and copyable examples. This is not a full TeX compiler.
Use **bold text**, *italic text*, and [color=blue]colored text[/color].
Available colors: red, rose, pink, magenta, purple, violet, indigo, blue, sky, cyan,
teal, emerald, green, lime, yellow, amber, orange, coral, slate, gray.
Formatting is supported in INSTRUCTIONS, CONTEXT, EXPLANATION and display QUESTION text.
Keep QUESTION plain for error_correction: its words are editable answer data.
Keep ANSWER, BLANK, WORDS, PREFIX, GROUPS and titles plain (no formatting markers).
Formatting may wrap blanks such as {{1}}; interactive blanks also work inside tables and alignment blocks.
Example: QUESTION: Choose the **correct verb**: She {{1}} [color=teal]every day[/color].
Example: EXPLANATION: Use *-s* with [color=blue]he, she, it[/color].
You can combine color with bold or italic; do not nest colors. HTML is not supported.

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
  multiple_choice: "QUESTION: What would you like?\nOPTIONS: Tea, please. | Yesterday. | At home.\nANSWER: Tea, please.",
  true_false_not_given: "CONTEXT: Mia lives in Berlin.\nQUESTION: Mia lives in Berlin.\nOPTIONS: TRUE | FALSE | NOT_GIVEN\nANSWER: TRUE",
  cloze_drag_drop:
    "QUESTION: I {{1}} coffee in the {{2}}.\nBLANK: drink => drink | eat\nBLANK: morning => morning | evening\nWORDS: morning | drink | eat",
  error_correction:
    "QUESTION: He do not like sports.\nANSWER: He does not like sports.",
  matching: "QUESTION: cat\nANSWER: mèo\nQUESTION: dog\nANSWER: chó",
  sentence_building:
    "QUESTION: Arrange the words into a correct sentence.\nWORDS: She | is | reading | a book.",
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
  return `EXERCISE: ${EXERCISE_TYPES.find((t) => t[0] === mode)?.[1] || "Practice exercise"}\nTYPE: ${mode}\nSTYLE: ${style}\nINSTRUCTIONS: Complete the sentences below.\n${sample}\n`;
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
  if (mode === "cloze_drag_drop" && e.presentation.bank_scope) lines.push(`BANK_SCOPE: ${e.presentation.bank_scope || "exercise"}`);
  if (e.ignore_case === false) lines.push("CASE_SENSITIVE: yes");
  if (e.ignore_punctuation === false) lines.push("KEEP_PUNCTUATION: yes");
  if (e.instruction) lines.push(`INSTRUCTIONS: ${e.instruction}`);
  if (e.context) lines.push(`CONTEXT: ${e.context}`);
  if (e.presentation.categories?.length)
    lines.push(`GROUPS: ${e.presentation.categories.join(" | ")}`);
  for (const q of e.questions || []) {
    lines.push("", `QUESTION: ${q.prompt}`);
    if (["multiple_choice","true_false_not_given"].includes(mode)) lines.push(`OPTIONS: ${q.options.join(" | ")}`);
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
    throw new Error("Files must be no larger than 2 MB.");
  const nodes = [];
  let e, q;
  let line = 0;
  let continuation;
  const fail = (message) => {
    throw new Error(`Line ${line}: ${message}`);
  };
  const list = (value) => {
    const items = value.split("|").map((s) => s.trim());
    if (items.some((s) => !s)) fail("Do not leave empty items between separators |.");
    return items;
  };
  const seen = new WeakMap();
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    line++;
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    if (s.startsWith(">")) {
      if (!continuation) fail("A > line is only allowed after a text field.");
      const [target, key] = continuation;
      target[key] += "\n" + s.slice(1).trimStart();
      continue;
    }
    continuation = null;
    const match = s.match(/^([A-Z_]+):\s*(.+)$/);
    if (!match) fail("Use FIELD_NAME: content.");
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
      if (nodes.length > 100) fail("Up to 100 exercises.");
      continue;
    }
    if (!e) fail("Start with EXERCISE: title.");
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
      "BANK_SCOPE",
      "CASE_SENSITIVE",
      "KEEP_PUNCTUATION",
    ].includes(key);
    if (isHeader && q) fail("Place exercise metadata before the first QUESTION.");
    const target = isHeader ? e : q;
    if (!target) fail("Place this field after QUESTION.");
    if (key !== "BLANK") {
      const keys = seen.get(target) || new Set();
      if (keys.has(key)) fail(`Field ${key} is duplicated.`);
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
      case "BANK_SCOPE":
        if (!["question", "exercise"].includes(value)) fail("BANK_SCOPE must be question or exercise.");
        e.presentation.bank_scope = value;
        break;
      case "GROUPS":
        e.presentation.categories = list(value);
        break;
      case "CASE_SENSITIVE":
        if (!["yes", "no"].includes(value)) fail("Use yes or no.");
        e.ignore_case = value === "no";
        break;
      case "KEEP_PUNCTUATION":
        if (!["yes", "no"].includes(value)) fail("Use yes or no.");
        e.ignore_punctuation = value === "no";
        break;
      case "EXAMPLE":
        if (!["yes", "no"].includes(value)) fail("Use yes or no.");
        q.example = value === "yes";
        break;
      case "ANSWER":
        q.accepted_answers = list(value);
        break;
      case "OPTIONS":
        q.options = list(value);
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
        if (parts.length > 2) fail("Each BLANK must use exactly one => separator.");
        q.blanks.push({
          answers: list(parts[0]),
          options: parts[1] ? list(parts[1]) : [],
        });
        break;
      }
      default:
        fail(`Field ${key} is not supported.`);
    }
  }
  if (!nodes.length) fail("No exercises yet.");
  for (const node of nodes) {
    e = node.payload;
    const mode = e.presentation.interaction;
    const type = EXERCISE_TYPES.find((t) => t[0] === mode);
    if (e.title.length > 200) fail("Exercise titles can contain up to 200 characters.");
    if (!type) fail(`Exercise ${e.title}: Invalid TYPE.`);
    e.kind = type[3];
    e.check_mode = "auto_check";
    if (
      e.presentation.style &&
      !exerciseStylesOf(mode).some((s) => s[0] === e.presentation.style)
    )
      fail(`Exercise ${e.title}: Invalid STYLE.`);
    if (!e.questions.length || e.questions.length > 100)
      fail("Each exercise requires 1–100 questions.");
    if (e.questions.every((q) => q.example))
      fail("At least one practice question, not an EXAMPLE, is required.");
    const pairs = e.questions.map((q) => q.accepted_answers[0]);
    if (mode === "matching" && new Set(pairs).size !== pairs.length)
      fail("Matching requires distinct answers.");
    for (const [i, question] of e.questions.entries()) {
      q = question;
      line = q._line;
      delete q._line;
      q.id = String(i + 1);
      q.position = i + 1;
      q.kind = e.kind;
      if (mode === "sentence_building") {
        if (!q.presentation.word_bank?.length)
          fail("WORDS must be in the correct order.");
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
          fail("At least two distinct GROUPS are required.");
      }
      if (mode === "matching") q.options = pairs;
      if (["multiple_choice","true_false_not_given"].includes(mode) && (q.options.length < 2 || q.accepted_answers.length !== 1 || !q.options.includes(q.accepted_answers[0]))) fail("Choose one answer from OPTIONS.");
      if (
        ["matching", "categorization"].includes(mode) &&
        (q.accepted_answers.length !== 1 ||
          !q.options.includes(q.accepted_answers[0]))
      )
        fail("An answer must belong to a category or pair.");
      if (e.kind === "cloze") {
        const marks = [...q.prompt.matchAll(/\{\{(\d+)\}\}/g)]
          .map((m) => +m[1])
          .sort((a, b) => a - b);
        if (
          !q.blanks.length ||
          JSON.stringify(marks) !==
            JSON.stringify(q.blanks.map((_, i) => i + 1))
        )
          fail("Gaps {{1}}… must match the number of BLANK lines, with no duplicates.");
        if (
          mode === "inline_selection" &&
          q.blanks.some(
            (b) =>
              b.options.length < 2 ||
              b.answers.some((a) => !b.options.includes(a)),
          )
        )
          fail("Each BLANK needs at least two options including the answer.");
        if (mode === "cloze_drag_drop")
          q.presentation.word_bank ||= q.blanks.flatMap((b) =>
            b.answers.slice(0, 1),
          );
        if (
          mode === "cloze_drag_drop" &&
          !canFillGapBank(q.blanks, q.presentation.word_bank)
        )
          fail(
            "WORDS must contain enough words for every gap; list repeated words separately.",
          );
      } else if (q.blanks.length) fail("This type does not use BLANK.");
      if (!q.blanks.length && !q.accepted_answers.length) fail("ANSWER is required.");
      if (
        q.presentation.prefix &&
        q.accepted_answers.some((a) => !a.startsWith(q.presentation.prefix))
      )
        fail("The answer must begin with PREFIX.");
      if (
        mode === "short_answer" &&
        e.presentation.style === "partial_input" &&
        !q.presentation.prefix
      )
        fail("Sentence completion requires PREFIX.");
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
            "Cross out: the answer must be formed by removing words from the original sentence.",
          );
      }
    }
  }
  return { nodes };
}

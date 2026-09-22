import { newExercise, newQuestion } from "./exercise-types.js";
export function jsonTemplate(scope, mode = "short_answer") {
  const e = newExercise(mode),
    q = e.questions[0];
  e.title = "Bài mẫu";
  q.prompt = "Translate: xin chào";
  q.accepted_answers = ["hello"];
  if (mode === "cloze_drag_drop" || mode === "inline_selection") {
    q.prompt = "She {{1}} learning.";
    q.accepted_answers = [];
    q.blanks = [{ answers: ["is"], options: ["is", "are"] }];
    q.presentation.word_bank = ["is", "are"];
  }
  if (mode === "multiple_choice") {
    q.prompt = "Choose a greeting.";
    q.options = ["hello", "book", "red", "run"];
  }
  if (mode === "matching") {
    q.prompt = "xin chào";
    q.options = ["hello"];
  }
  if (mode === "categorization") {
    e.presentation.categories = ["Greetings", "Objects"];
    q.prompt = "hello";
    q.options = e.presentation.categories;
    q.accepted_answers = ["Greetings"];
  }
  if (["sentence_building", "inline_error_identification"].includes(mode)) {
    q.prompt =
      mode === "sentence_building"
        ? "Build the sentence."
        : "{{a}} {{b}} {{c}}";
    q.presentation.tokens = [
      { id: "a", text: "She" },
      { id: "b", text: mode === "sentence_building" ? "goes" : "go" },
      { id: "c", text: "home." },
    ];
    q.accepted_answers = mode === "sentence_building" ? ["a", "b", "c"] : ["b"];
    if (mode === "inline_error_identification") q.options = ["a", "b", "c"];
  }
  if (mode === "audio_dictation") {
    q.prompt = "Type the sound you hear in English.";
    q.presentation.audio = "/static/react/audio/tone.wav";
    q.accepted_answers = ["beep"];
  }
  if (mode === "true_false_not_given") {
    e.context = "Anna reads a book every day.";
    q.prompt = "Anna reads daily.";
    q.accepted_answers = ["TRUE"];
  }
  return scope === "exercise" ? e : { questions: [q] };
}
export function parseImport(text, scope) {
  const data = JSON.parse(text);
  const object = (v, label) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new Error(`${label}: cần đối tượng JSON.`);
  };
  const list = (v, label) => {
    if (!Array.isArray(v) || !v.length || v.length > 100)
      throw new Error(`${label}: cần 1–100 phần tử.`);
    return v;
  };
  const question = (q, i) => {
    object(q, `Câu ${i + 1}`);
    if (typeof q.prompt !== "string" || !q.prompt.trim())
      throw new Error(`Câu ${i + 1}: thiếu prompt.`);
    for (const k of ["accepted_answers", "options"])
      if (
        q[k] !== undefined &&
        (!Array.isArray(q[k]) || q[k].some((v) => typeof v !== "string"))
      )
        throw new Error(`Câu ${i + 1}: ${k} phải là mảng chuỗi.`);
    if (
      q.blanks !== undefined &&
      (!Array.isArray(q.blanks) ||
        q.blanks.some(
          (b) =>
            !b ||
            !Array.isArray(b.answers) ||
            !b.answers.length ||
            b.answers.some((a) => typeof a !== "string"),
        ))
    )
      throw new Error(`Câu ${i + 1}: blanks không hợp lệ.`);
    if (q.presentation !== undefined)
      object(q.presentation, `Câu ${i + 1}: presentation`);
    const { id, position, ...rest } = q;
    return { ...newQuestion("short_answer"), ...rest };
  };
  const exercise = (e) => {
    object(e, "Bài tập");
    if (typeof e.title !== "string" || !e.title.trim())
      throw new Error("Bài tập thiếu title.");
    if (e.presentation !== undefined) object(e.presentation, "presentation");
    const { id, ...rest } = e;
    return {
      instruction: "",
      context: "",
      kind: "text",
      presentation: {},
      ignore_case: true,
      ignore_punctuation: true,
      ...rest,
      questions: list(e.questions, "questions").map(question),
    };
  };
  object(data, "Nội dung");
  if (scope === "question")
    return { questions: list(data.questions, "questions").map(question) };
  if (scope === "exercise") return exercise(data);
  throw new Error("Chọn bài tập hoặc câu hỏi.");
}

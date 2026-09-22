export const EXERCISE_TYPES = [
  ["cloze_drag_drop", "Điền chỗ trống", "01", "cloze"],
  ["inline_error_identification", "Tìm lỗi trong câu", "02", "multi"],
  ["short_answer", "Viết câu ngắn", "03", "text"],
  ["sentence_building", "Sắp xếp câu", "04", "order"],
  ["multiple_choice", "Trắc nghiệm", "05", "choice"],
  ["categorization", "Phân loại", "06", "choice"],
  ["audio_dictation", "Nghe – chép", "07", "text"],
  ["matching", "Nối cặp", "08", "matching"],
  ["true_false_not_given", "Đúng / Sai / Không có", "09", "choice"],
];
export const modeOf = (e) =>
  e.presentation?.interaction ||
  {
    cloze: "cloze_drag_drop",
    choice: "multiple_choice",
    multi: "multiple_choice",
    text: "short_answer",
    order: "sentence_building",
    wordset: "short_answer",
  }[e.presentation?.type || e.kind] ||
  e.presentation?.type ||
  e.kind;
export const titleOf = (e) =>
  modeOf(e) === "inline_selection"
    ? "Điền chỗ trống"
    : EXERCISE_TYPES.find((t) => t[0] === modeOf(e))?.[1] || "Bài tập";
export function newQuestion(mode) {
  return {
    prompt: "",
    accepted_answers: [],
    options:
      mode === "multiple_choice"
        ? ["", "", "", ""]
        : mode === "true_false_not_given"
          ? ["TRUE", "FALSE", "NOT_GIVEN"]
          : [],
    blanks: [],
    presentation: {},
  };
}
export function newExercise(mode) {
  const item = EXERCISE_TYPES.find((t) => t[0] === mode);
  return {
    title: item[1],
    kind: item[3],
    instruction: "",
    context: "",
    ignore_case: true,
    ignore_punctuation: true,
    presentation: {
      interaction: mode,
      type: item[3],
      categories: mode === "categorization" ? ["Nhóm 1", "Nhóm 2"] : [],
    },
    questions: [newQuestion(mode)],
  };
}
export function previewData(e) {
  return {
    exercise: {
      ...e,
      check_mode: "auto_check",
    },
    questions: e.questions.map((q, i) => ({
      ...q,
      id: q.id || `p${i}`,
      position: i + 1,
      kind: q.kind || e.kind,
      blank_count: q.blanks?.length || 0,
      blank_options: q.blanks?.map((b) => b.options || []) || [],
    })),
    assets: {},
  };
}

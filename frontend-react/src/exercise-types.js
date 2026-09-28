export const EXERCISE_TYPES = [
  ["cloze_drag_drop", "Điền vào chỗ trống", "01", "cloze"],
  ["error_correction", "Tìm và sửa lỗi sai", "02", "text"],
  ["matching", "Nối đáp án", "03", "matching"],
  ["sentence_building", "Sắp xếp câu", "04", "order"],
  ["categorization", "Phân loại", "05", "choice"],
  ["inline_selection", "Trắc nghiệm trong câu", "06", "cloze"],
  ["short_answer", "Viết lại câu", "07", "text"],
];
export const EXERCISE_STYLES = {
  cloze_drag_drop: [
    [
      "drag_drop",
      "Kéo thả từ",
      "Kéo từ vào ô trống; cũng có thể chạm để điền.",
    ],
    ["tap_fill", "Chạm để điền", "Chọn ô trống rồi chọn từ."],
  ],
  error_correction: [
    ["click_edit", "Chạm và sửa", "Chạm vào từ sai và nhập từ đúng."],
    [
      "cross_out",
      "Gạch từ thừa",
      "Chạm để bỏ từ thừa; chạm lần nữa để khôi phục.",
    ],
  ],
  matching: [["tap_match", "Chạm nối cặp", "Chọn một thẻ ở mỗi cột để nối."]],
  sentence_building: [
    ["tap_build", "Chạm ghép câu", "Chọn từ theo thứ tự. Có thể hoàn tác."],
  ],
  categorization: [
    [
      "drag_sort",
      "Bảng phân loại",
      "Kéo thẻ vào nhóm, hoặc chọn thẻ rồi chạm tên nhóm.",
    ],
  ],
  inline_selection: [
    ["pill_toggle", "Nút chọn", "Chọn đáp án ngay trong câu."],
    ["inline_select", "Danh sách chọn", "Mở danh sách tại mỗi chỗ trống."],
  ],
  short_answer: [
    [
      "partial_input",
      "Viết tiếp câu",
      "Hoàn thành câu từ phần mở đầu cho sẵn.",
    ],
    [
      "sentence_rewrite",
      "Viết lại cả câu",
      "Khung viết tự mở rộng theo nội dung.",
    ],
  ],
};
export const exerciseStylesOf = (mode) =>
  EXERCISE_STYLES[mode] || [
    ["default", "Luyện tập", "Thực hành dạng bài này."],
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
  EXERCISE_TYPES.find((t) => t[0] === modeOf(e))?.[1] || "Bài tập";
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

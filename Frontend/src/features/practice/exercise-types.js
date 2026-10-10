export const EXERCISE_TYPES = [
  ["multiple_choice", "Choose a response", "08", "choice"],
  ["true_false_not_given", "Read and judge", "09", "choice"],
  ["cloze_drag_drop", "Fill in the gap", "01", "cloze"],
  ["error_correction", "Find and correct mistakes", "02", "text"],
  ["matching", "Match answers", "03", "matching"],
  ["sentence_building", "Arrange sentence", "04", "order"],
  ["categorization", "Categorize", "05", "choice"],
  ["inline_selection", "Inline multiple choice", "06", "cloze"],
  ["short_answer", "Rewrite sentence", "07", "text"],
];
export const EXERCISE_STYLES = {
  multiple_choice: [["dialogue_reply", "Dialogue replies", "Read the situation and choose your reply."], ["elimination", "Eliminate and decide", "Cross out distractors, then choose the best answer."]],
  true_false_not_given: [["evidence_judge", "Evidence desk", "Read the passage and decide what it actually says."]],
  cloze_drag_drop: [
    [
      "drag_drop",
      "Drag words",
      "Drag words into the gaps, or tap to fill them.",
    ],
    ["tap_fill", "Tap to fill", "Select a gap, then choose a word."],
  ],
  error_correction: [
    ["click_edit", "Tap and edit", "Tap the incorrect word and enter its correction."],
    [
      "cross_out",
      "Cross out extra words",
      "Tap an extra word to remove it; tap again to restore it.",
    ],
  ],
  matching: [["tap_match", "Tap to match", "Select a card in each column to match them."]],
  sentence_building: [
    ["tap_build", "Tap to build a sentence", "Select words in order. You can undo your choices."],
  ],
  categorization: [
    [
      "drag_sort",
      "Category board",
      "Drag cards into a category, or select a card and tap the category name.",
    ],
  ],
  inline_selection: [
    ["pill_toggle", "Choice buttons", "Choose an answer within the sentence."],
    ["inline_select", "Dropdown", "Open the dropdown at each gap."],
    ["fall_away", "Choose and reveal", "Choose a word in the sentence. Incorrect alternatives fall away after a correct answer."],
  ],
  short_answer: [
    [
      "partial_input",
      "Complete the sentence",
      "Complete the sentence using the given beginning.",
    ],
    [
      "sentence_rewrite",
      "Rewrite the sentence",
      "The writing area expands as you type.",
    ],
  ],
};
export const exerciseStylesOf = (mode) =>
  EXERCISE_STYLES[mode] || [
    ["default", "Practice", "Practice this exercise type."],
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
  EXERCISE_TYPES.find((t) => t[0] === modeOf(e))?.[1] || "Exercises";
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
      categories: mode === "categorization" ? ["Group 1", "Group 2"] : [],
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

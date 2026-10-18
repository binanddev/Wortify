import { completePracticeGuide } from "./practice-text.js";
import { FORMAT_EXAMPLES } from "./formatting-examples.js";

export function aiAuthoringGuide(lang = "en", brief = "") {
  return [
    "WORTIFY · AI AUTHORING INSTRUCTIONS",
    "Create original, accurate language-learning exercises using the exact Wortify text format below.",
    "Learning language: " + (lang === "de" ? "German" : "English") + ".",
    brief.trim() ? "MY REQUEST:\n" + brief.trim() : "Use the topic, learner level, exercise type and number of questions in my request. Ask me for the topic or other essential missing details only; do not ask again for information already supplied.",
    "Return only importable exercise text, without Markdown code fences, a preamble or a closing message. Do not copy the documentation or sample exercises into the result.",
    "Use natural contexts, varied questions and plausible distractors. Avoid ambiguous questions. Verify every answer. Include EXPLANATION for each question and COMMENT only when a shared note is useful.",
    "Choose only supported TYPE and STYLE values. Keep fields and syntax in English. Follow the requested language for learning content and explanations.",
    "For sentence_building, WORDS must be in correct sentence order: the app shuffles them. For other choices, vary the position of the correct answer.",
    "For cloze_drag_drop, explicitly choose BANK_SCOPE: question for local choices or BANK_SCOPE: exercise for shared choices. Include enough copies of repeated tokens.",
    "Never invent uploaded media URLs. Use an existing URL supplied by me or omit the image. Attach media separately in Wortify.",
    "Before returning, check all numbered blanks, option membership, required fields, unique matching partners and import limits. Do not claim the result has been tested in Wortify.",
    "If I request THEORY instead: return a separate Markdown document with the supported lesson markup. Do not wrap theory in EXERCISE fields or mix it into an exercise import. I will paste it into Create > Theory.",
    "\nCOMPLETE EXERCISE RULES AND ALL TEMPLATES\n",
    completePracticeGuide(),
    "\nLESSON FORMATTING REFERENCE\n",
    "This is a supported LaTeX-style subset, not a TeX compiler. No custom HTML, CSS, scripts or TeX packages.",
    "In exercise text, prefix continuation lines with >. Keep answers, choices, word banks and editable correction text plain.",
    "Alignment: flushleft, center, flushright. Tables: l/c/r columns. Images: HTTPS or uploaded URLs; width 1–1200px or 1–100%, optional height, align=left/center/right, fit=contain/cover. Omit height to preserve proportions. Attachments are not embedded in text exports.",
    ...FORMAT_EXAMPLES.map(([label, example]) => label + ":\n" + example),
    "\nWORKFLOW\nCopy these instructions into your AI chat, add your request, then paste the result into Wortify's Text draft. Check and preview, fix reported errors, and save into a folder. Upload media separately. Review language accuracy before publishing.",
  ].join("\n\n");
}

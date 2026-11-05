import english from "./flashcard-guide-en.json" with { type: "json" };
import german from "./flashcard-guide-de.json" with { type: "json" };

export function flashcardAiGuide(lang = "de") {
  const guide = lang === "en" ? english : german;
  const examples = JSON.stringify(guide.examples, null, 2).replaceAll("},\n  {", "},\n\n  {");
  return [...guide.instructions, "EXAMPLE JSON ARRAY:", examples, ...guide.finalCheck].join("\n\n");
}

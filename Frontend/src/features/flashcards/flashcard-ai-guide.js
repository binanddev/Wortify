import samples from "./vocabulary-samples.json" with { type: "json" };
import examples from "./flashcard-guide-examples.json" with { type: "json" };
export function flashcardAiGuide(lang = "de") {
  const fields = ["german_text", "vietnamese_meaning", "example_german", "example_vietnamese", "part_of_speech"];
  const row = values => JSON.stringify(Object.fromEntries(fields.map((key, i) => [key, values[i] || ""])), null, 2);
  return [
    "WORTIFY FLASHCARD IMPORT — AI INSTRUCTIONS",
    "Ask me for the topic, level and number of cards. Create a complete, ready-to-study deck of accurate, original " + (lang === "en" ? "English" : "German") + " vocabulary and useful phrases, with Vietnamese meanings.",
    "Return a valid JSON array of card objects, pretty-printed with each named field on its own line and a blank line between cards. No code fences or commentary. Maximum 2000 cards.",
    "Use the exact field names shown below. Use empty strings for optional values. Escape quotes and newlines using valid JSON syntax.",
    "LEARNING CONTENT REQUIREMENTS:",
    "Generate all 5 named fields for every card. Only the term and meaning are required. Examples, their translations and part of speech are optional, but provide them when generating study material. Never omit field names.",
    "Use natural contexts at the requested level. Avoid filler comments and duplicate example sentences.",
    "Prepare cards for active recall and sentence production: include useful phrases/collocations, a natural example and its faithful Vietnamese translation. Learners will first recall the term from the meaning, then translate the example without seeing it, then write a different sentence. Do not require a minimum deck size for games. A study set defaults to 5 words.",
    "FIELDS (use these exact keys):",
    "german_text: Term or phrase — up to 500 characters.",
    "vietnamese_meaning: Vietnamese meaning — up to 500 characters.",
    "example_german: Example sentence in the learning language — up to 2000 characters.",
    "example_vietnamese: Vietnamese translation of the example — up to 2000 characters.",
    "part_of_speech: Part of speech — up to 50 characters.",
    
    "Examples and translations must match. Prefer useful phrases and collocations, avoid duplicate cards, include the article in the term itself for German nouns when appropriate.",
    "Do not add IDs, accepted_answers, accepted_examples or extra columns; these are not part of this import format.",
    "EXAMPLE OBJECTS (place these objects inside one JSON array, separated by commas):",
    ...samples[lang === "en" ? "en" : "de"].slice(0,2).map(card => row([
      card.german_text, card.vietnamese_meaning, card.example_german, card.example_vietnamese,
      "verb phrase"
    ])),
    row(lang === "en"
      ? ["station",examples.station,"The station is near my house.",examples.enStation,"noun"]
      : ["der Bahnhof",examples.station,"Der Bahnhof ist in der Nähe.",examples.deStation,"noun"]),
    "FINAL CHECK BEFORE OUTPUT: exactly 5 named string fields per object; valid JSON; unique phrases and meanings; each example has 3–40 words and contains its target expression; accurate translations; correct grammar. Do not include this checklist in the output.",
    "Review grammar and translations before returning. I will paste your output into Wortify, preview and confirm the import.",
  ].join("\n\n");
}

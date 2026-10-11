import samples from "./word-game-samples.json" with { type: "json" };
import examples from "./flashcard-guide-examples.json" with { type: "json" };
export function flashcardAiGuide(lang = "de", separator = "|") {
  const delimiter = { "|": "vertical bar (|)", ",": "comma (,)", ";": "semicolon (;)", "\t": "TAB character" }[separator] || "vertical bar (|)";
  const row = values => values.map(v => '"' + v.replaceAll('"', '""') + '"').join(separator);
  return [
    "WORTIFY FLASHCARD IMPORT — AI INSTRUCTIONS",
    "Ask me for the topic, level and number of cards. Create a complete, ready-to-study deck of accurate, original " + (lang === "en" ? "English" : "German") + " vocabulary and useful phrases, with Vietnamese meanings.",
    "Return only importable rows: no heading, column header, Markdown table, code fences or commentary. One card per physical line. Maximum 2000 cards.",
    "Separator: " + delimiter + ". Quote every cell with double quotes; escape a double quote inside a cell by doubling it. Never insert line breaks inside a cell.",
    "LEARNING CONTENT REQUIREMENTS:",
    "Generate all 9 columns for every row. Fill examples, translations, part of speech, useful notes and usage guidance. For articles and plural forms, provide the correct form where linguistically applicable; use an empty quoted cell otherwise. Never shift later columns left.",
    "Include at least 6 distinct multi-word phrases or collocations with distinct Vietnamese meanings for a full Phrase pairs round. If no count is given, propose 20 cards. If the requested count is below 6, clarify the deck size before producing it.",
    "Context detective: every example must contain the exact term or phrase as a contiguous sequence of whole words (case can differ). For a German noun, put the noun in column 1 and its article in column 8. Choose natural sentence structures that preserve the expression, such as a modal plus infinitive or an English to-infinitive. Do not invent ungrammatical examples to satisfy this rule.",
    "Sentence workshop: every example must contain 3–40 whitespace-separated words and have a faithful Vietnamese translation. Use a complete, useful sentence and avoid unnecessarily long or ambiguous constructions.",
    "Phrase pairs: use genuine expressions with at least two words, such as take a break or eine Pause machen, rather than isolated words. Do not pad an isolated word just to reach the word count. Keep both phrases and their meanings distinct.",
    "Use natural contexts at the requested level. Notes should explain a useful distinction or grammar point; usage should explain a collocation or communicative situation. Avoid filler comments and duplicate example sentences.",
    "COLUMN ORDER (never reorder):",
    "1. Term or phrase — up to 500 characters.",
    "2. Vietnamese meaning — up to 500 characters.",
    "3. Example sentence in the learning language — up to 2000 characters.",
    "4. Vietnamese translation of the example — up to 2000 characters.",
    "5. Part of speech — up to 50 characters.",
    "6. Notes — up to 2000 characters.",
    "7. Usage / collocation guidance — up to 2000 characters.",
    "8. Article — up to 10 characters (German nouns; otherwise blank).",
    "9. Plural form — up to 100 characters.",
    
    "For context games, include a natural example containing the exact term or phrase whenever grammatically appropriate. Never force an unnatural infinitive into a sentence. Sentence workshop uses the full example; phrase pairs needs multi-word terms and distinct meanings.",
    "Examples and translations must match. Prefer useful phrases and collocations, avoid duplicate cards, explain usage only when helpful. Do not invent uncertain articles or plurals: leave them blank.",
    "Do not add IDs, accepted_answers, accepted_examples or extra columns; these are not part of this import format.",
    "COMPLETE EXAMPLES (9 columns per row; follow this structure with new content):",
    ...samples[lang === "en" ? "en" : "de"].slice(0,2).map(card => row([
      card.german_text, card.vietnamese_meaning, card.example_german, card.example_vietnamese,
      "verb phrase", lang === "en" ? "Learn the full expression as a unit." : "Use this expression with a modal verb and an infinitive.",
      lang === "en" ? "Use this phrase in everyday conversation." : "A useful expression for everyday conversation.", "", ""
    ])),
    row(lang === "en"
      ? ["station",examples.station,"The station is near my house.",examples.enStation,"noun","Countable noun.","Used for train and bus travel.","","stations"]
      : ["Bahnhof",examples.station,"Der Bahnhof ist in der Nähe.",examples.deStation,"noun","Masculine noun; plural with an umlaut.","am Bahnhof = at the station","der","Bahnhöfe"]),
    "FINAL CHECK BEFORE OUTPUT: exactly 9 cells per row; correct quoting; unique phrases and meanings; at least 6 phrase cards; each example has 3–40 words and contains its target expression; accurate translations; correct grammar, article and plural. Do not include this checklist in the output.",
    "Review grammar and translations before returning. I will paste your output into Wortify, select the same separator, preview and confirm the import.",
  ].join("\n\n");
}

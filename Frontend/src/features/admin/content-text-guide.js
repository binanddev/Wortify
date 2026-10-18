import flashcardTextExample from "./flashcard-package-example.json" with {type:"json"};
import { TEXT_GUIDE, textTemplate, READING_TEXT_RULES } from "../practice/practice-text.js";
import { EXERCISE_TYPES, exerciseStylesOf } from "../practice/exercise-types.js";
import { FORMAT_EXAMPLES } from "../practice/formatting-examples.js";
export const contentTextExample = `WORTIFY: 1
ID: 7cdbb39c-e1ee-4a49-a10f-f2ff1551f5bd
TITLE: A2 Travel
LANGUAGE: en

SECTION: practice
FOLDER: A2/Travel/Transport
EXERCISE: At the station
TYPE: multiple_choice
STYLE: dialogue_reply
QUESTION: Where can I buy a ticket?
OPTIONS: At the ticket office. | At seven o'clock. | By train.
ANSWER: At the ticket office.
EXPLANATION: Where asks for a place.

SECTION: reading
FOLDER: A2/Travel
LEVEL: A2
TOPIC: Travel
EXERCISE: A morning journey
TYPE: reading
STYLE: split_reading
CONTEXT: Anna takes the bus to school every morning. The journey takes twenty minutes.
QUESTION: How does Anna get to school?
OPTIONS: By bus | By train | On foot | By bicycle
ANSWER: By bus
EXPLANATION: The passage says Anna takes the bus.
`;
export function contentTextGuide(section) {
 const rules=TEXT_GUIDE.split('WORKSPACE AND EDITING')[0]
   .replace('Limits per import: 100 exercises, 100 questions per exercise, 2 MB total UTF-8 text.', 'For this system package: 5000 total nodes (folders + lessons), 100 questions per lesson, 50 MB UTF-8 per file.')
   .replace('Save as .txt, open Create, choose or create a root folder, import files, validate, preview, then save.', 'Import this package in Manage > Import content, or with the content import API.')
   .replace('Every exercise must belong to a folder. Loose exercises are not allowed.', 'Practice exercises require a folder. Reading lessons and theory may use FOLDER: /.')
   .replace('The whole batch is saved only after validation. Errors include line numbers.', 'The complete package is published atomically after preview and confirmation. Errors include line numbers.')
   .replace('ALL SUPPORTED TYPES AND STYLES: complete importable samples follow. Lines beginning with # are documentation.', '');
 return `${section ? "Generate only SECTION: " + section + ". Do not include other sections.\n" : ""}WORTIFY TEXT 1 — SYSTEM CONTENT AUTHORING
Create original flashcard decks, Practice Hub exercises/theory and Reading lessons. No accounts or progress. Everything imported here is public content credited to Wortify. Generate one file per section for the three separate import tools. Return one UTF-8 .txt file, no Markdown fences or commentary.
Use the user request; do not ask again for supplied details. If unspecified, use A2, 10 questions per practice lesson, 5 questions per reading, Vietnamese explanations, and the requested learning language. Verify language and answers, not only syntax.

PACKAGE HEADERS (once, before SECTION):
WORTIFY: 1
ID: a new UUID for a new package; never change ID or content on network retries
TITLE: package title, 1–200 characters
LANGUAGE: en or de (one language per file)

CONTAINER DIRECTIVES:
SECTION: flashcards, practice or reading. Switching section resets folder to /, level and topic to unspecified.
FOLDER: path such as A2/Travel/Transport. Paths start at section root; / means root. Folders are created automatically, reused within this file, up to 10 levels. No empty segments, . or ..; / cannot appear inside a folder name. Maximum 200 characters per name.
LEVEL: A1/A2/B1/B2/C1/C2; applies to subsequent readings and flashcard decks. TOPIC: consistent short topic, up to 80 characters. Use - to clear either.
FOLDER, LEVEL and TOPIC apply until replaced; put them BETWEEN lessons, never inside a lesson. SECTION may repeat. Existing folders in other packages are not merged.
EXERCISE: starts a lesson using the existing text rules below. TYPE: reading goes only in SECTION reading; the nine practice types go only in SECTION practice.
DECK: title starts a flashcard deck in SECTION flashcards. Title max 150 characters; flashcard folder names max 100. LEVEL defaults to A1. Each card starts with TERM: then MEANING: (both required, max 500 characters each). Optional EXAMPLE: and TRANSLATION: max 2000 characters each, POS: max 50. Use > for line breaks. No article/plural/notes/usage/alternative answers. Maximum 2000 cards per deck, 100000 per package. No duplicate terms within a deck.
THEORY: title is allowed only in SECTION practice. Follow with CONTENT: Markdown then > continuation lines. It is not an EXERCISE. Maximum 2 MB theory content.
Use > continuation for multiline text, including any line resembling a directive. Blank lines and # comments are ignored. No explicit END markers, JSON objects, database IDs or user identifiers.
Unique sibling titles across folders/lessons. Maximum 5000 nodes including generated folders and 50 MB/file. More than 100 lessons is allowed; each lesson still has 1–100 questions including a non-example. Keep a package small enough for the bot's request limits; split into new packages only for distinct content.
No uploaded/private attachments in packages. Use only supplied, legitimate HTTPS image URLs. Never invent media URLs.

EXAMPLE (replace UUID and content for a new package):
${section ? contentExample(section) : contentTextExample}

LESSON RULES (container rules above override personal-import limits):
${rules}
${READING_TEXT_RULES}

SUPPORTED FORMATTING:
Keep answers/options/tokens plain. Lesson markup is a supported subset, not a TeX compiler. No scripts or custom CSS. Reading HTML is limited by the rules above.
${FORMAT_EXAMPLES.map(([label,example])=>label+':\n'+example).join('\n\n')}

ALL PRACTICE TYPES AND STYLES (insert under SECTION practice with FOLDER):
${EXERCISE_TYPES.flatMap(([mode])=>exerciseStylesOf(mode).map(([style])=>textTemplate(mode,style))).join('\n')}
THEORY EXAMPLE:
THEORY: Travel phrases
CONTENT: # Asking for help
> Use **Where is ...?** to ask about a place.

Validate the whole package with Preview. Correct reported errors and preview again. Publish only the unchanged validated content. Never claim a file has been imported without a successful server response.
`;
}
export function contentBotGuide(origin, section="practice") {
 return `WORTIFY CONTENT IMPORT API
Base URL: ${origin}
Full authoring rules: ${origin}/api/import/guide/
OpenAPI schema: ${origin}/api/import/openapi/
POST ${origin}/api/import/content/?section=${section}
Authentication: Authorization: Bearer YOUR_IMPORT_KEY (staff import-only key, never include in generated files or URLs).
Send application/json with exactly {"text":"complete Wortify Text file","preview":true}. The JSON is only a transport envelope; the content remains compact text.
A 200 response returns counts, digest and preview_token. Check counts. Then POST {"text":"identical text","confirm":"IMPORT","preview_token":"returned token"}.
Token is bound to this content and staff account, valid for 24 hours. Editing content requires another preview. 201 means newly published; 200 means the identical ID already exists. Content is always public under Wortify.
On timeout retry the same ID and unchanged body. Never mint a new ID to retry. 400 means fix input and preview again; 401 means key revoked/invalid. Do not blindly retry either. Publication is atomic; no partial content on validation errors.
Direct JSON/text requests: max 8 MB including the envelope. Include section=flashcards, practice or reading in every request URL. The file must contain only that section. Use multipart files up to 50 MB for larger batches.
For tools supporting files: multipart file (.txt or legacy JSON), preview=true; publish with confirm=IMPORT and preview_token.
For raw text: Content-Type: text/plain; &preview=true; publish with &confirm=IMPORT and X-Wortify-Preview header.
Requires an HTTP-capable bot/tool integration. A chat without an HTTP tool can only return the file for a staff member to import. Do not pretend to have network access or to have published content.
`;
}

export function contentExample(section) {
  const header = contentTextExample.split("SECTION:")[0];
  if (section === "flashcards") return header + flashcardTextExample;
  return header + "SECTION:" + contentTextExample.split("SECTION:").find(part=>part.trimStart().startsWith(section + "\n"));
}

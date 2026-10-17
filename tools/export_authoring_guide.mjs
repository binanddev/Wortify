import {readFile,writeFile} from 'node:fs/promises';
import {flashcardAiGuide} from '../Frontend/src/features/flashcards/flashcard-ai-guide.js';
import {aiAuthoringGuide} from '../Frontend/src/features/practice/ai-authoring-guide.js';
import {READING_TEXT_RULES,textTemplate} from '../Frontend/src/features/practice/practice-text.js';
const root=new URL('../',import.meta.url);
const marker='<!-- GENERATED AUTHORING APPENDIX -->';
const policy=(await readFile(new URL('CONTENT_AUTHORING.md',root),'utf8')).split(marker)[0].trim();
const reading=`READING IMPORT
Start each lesson with EXERCISE: title, TYPE: reading, STYLE: split_reading. Put metadata before questions. Continue multiline fields with >. Separate lessons with EXERCISE.
1–100 lessons, 1–100 questions per lesson, maximum 2 MB UTF-8 per import. Each question needs 2–12 unique options. ANSWER uses exact option text, never letters/indexes. Do not put | inside options.
${READING_TEXT_RULES}

${textTemplate('reading')}`;
const parts=[
 'WORTIFY COMPLETE AUTHORING RULES — version 1.2.7',
 'Generated from the current application guides. Read the execution policy first. Never include credentials in outputs.',
 policy,
 '=== FLASHCARDS: GERMAN ===',flashcardAiGuide('de'),
 '=== FLASHCARDS: ENGLISH ===',flashcardAiGuide('en'),
 '=== PRACTICE, THEORY, ALL TYPES/STYLES AND FORMATTING ===',
 aiAuthoringGuide('de','Apply the user request and the execution defaults above. Do not ask again for details already specified. Use English learning content when en is requested; explanations default to Vietnamese.'),
 '=== READING ===',reading,
 '=== PRACTICE HUB JSON SCHEMA EXAMPLE ===',
 await readFile(new URL('Frontend/public/templates/practice-hub.json',root),'utf8'),
 '=== ONE-FILE SYSTEM CONTENT PACKAGE EXAMPLE ===',
 await readFile(new URL('Frontend/public/templates/content-package.json',root),'utf8'),
 '=== VERIFICATION ===',
 'Validate each generated batch using the current application parser/preview and backend. Check answer correctness separately. Save only after validation. Confirm counts by reading saved content. Report offline files separately from saved content. Do not paste this guide into the app import box.'
];
await writeFile(new URL('WORTIFY_AUTHORING_RULES.txt',root),parts.join('\n\n')+'\n','utf8');
await writeFile(new URL('CONTENT_AUTHORING.md',root),policy+'\n\n'+marker+'\n\n## Phụ lục đầy đủ — luật và mẫu từ ứng dụng\n\n``````text\n'+parts.slice(3).join('\n\n')+'\n``````\n','utf8');
console.log('Both standalone authoring guides exported (no credentials).');

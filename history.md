# Change Log

> **Initial Note:** 
> Prior to this release milestone (`v1.0.0`), the system underwent multiple upgrades and feature refinements, operating stably in production. All preceding unrecorded versions are consolidated, making this the baseline release.

---

### [v1.2.5] - 2026-10-11 | Flashcard Word Playground

- Refined the deck navigation group to Games.
- Replaced hidden Phrase pairs cards with visible matching boards: 12 or 20 tiles, persistent green matches, brief red mismatches and automatic progression through the deck without repeating cards.
- Added points and streaks to context/sentence games; sentence assembly checks automatically after the final token.

- Added Context detective: recall a word or phrase in its saved example, with hints, corrective feedback and a full-sentence reveal.
- Added Sentence workshop: rebuild saved examples with shuffled tokens, preserving repeated words.
- Added Phrase pairs: a face-down memory game for multi-word expressions and their meanings, with example sentences after each match.
- Added six original English and six German sample cards for instant play without changing personal decks.
- Games show eligible card counts and explain missing data. Context gaps only use forms actually present in the saved example; no inferred conjugations or generated sentences.
- Revealed sentence questions return later in the same round. Practice rounds do not change spaced-review schedules.
- Added deck-level entry and session menu entry; retained the selected card scope and existing theme components.
- Fixed the extra-study user ID prop so existing practice modes receive the current account identity.
- Ideas informed by British Council TeachingEnglish resources on lexical chunks and matching activities; all sample sentences are original.

---

### [v1.2.4] - 2026-10-11 | AI-first Lesson Authoring

- Added a visible Copy all instructions for AI action in Create, the text editor and the authoring guide.
- The copy bundle includes all current exercise rules/templates, formatting examples, explanations and separate theory instructions; optional topic/level preferences travel with it.
- Added a text download and selectable fallback when clipboard access is unavailable.
- Kept detailed documentation behind an expandable section, with a direct route to paste and preview AI output.
- New exercise drafts open directly for pasting; file import and templates remain available without an automatic modal.
- Corrected the template count and clarified where inline-choice blank rules apply.

---

### [v1.2.3] - 2026-10-10 | Discover Performance & Grammar Library

- Reuse normalized Discover search snapshots and resolve typo alternatives once per search term, rather than per word in every lesson.
- Refresh search snapshots when content revisions, visibility, hierarchy or author identity changes; retain bounded pagination and private-ancestor exclusion.
- Include multiple-choice and true/false/not-given content in Discover.
- Added 100 managed library accounts and 1,000 public grammar exercises (500 English, 500 German), distributed across 12 authors.
- Each exercise contains 10 distinct questions, shuffled choices and explanations. Grammar references: British Council, Lingolia and Schubert-Verlag; source exercise questions are not copied.
- This is structured transformation practice using 500 bilingual action phrases across 10 grammar objectives per language, not 10,000 independently written scenarios or a teacher-certified curriculum.
- Saved pre-import database backup, account list, content export and import report outside runtime application logic.

---

### [v1.2.2] - 2026-10-10 | Authoring Guide & Launch Library

- Updated Create > Guide for current interaction styles, word-bank scope, lesson markup and feedback authoring.
- Published 30 managed content-author accounts: 15 English and 15 German.
- Each author has 100 exercises with 10 distinct questions per exercise, grouped into five practical topic units.
- Added 150 supporting vocabulary/theory pages.
- The curriculum reuses 750 bilingual expressions across recognition, recall and grammar objectives; it does not represent 30,000 independently authored source sentences.
- Saved account/content exports and a database backup; removed the one-off starter generator from the application source.

---

### [v1.2.1] - 2026-10-10 | Exercise Typography & Explanations

- Added Settings > Learning controls for exercise text size (16–36px) and weight (400–700), with preview and reset.
- Exercise typography is saved per user and applies across themes without resizing navigation.
- Added exercise-wide COMMENT and per-question EXPLANATION authoring for all exercise types.
- Matching displays each pair's explanation as soon as it is matched correctly.
- Correct answers and answer reveals display applicable notes once, including all notes for whole-exercise activities.

---

### [v1.2.0] - 2026-10-10 | Lesson Formatting & Admin Change Log

#### A. Content Authoring
- Added a safe LaTeX-style display subset: line breaks, emphasis, alignment, lists, tables and sized/aligned images.
- Interactive exercise blanks remain usable inside formatted blocks and table cells.
- Create includes a formatting guide, sample downloads and a theory preview.
- Markdown theory uses the shared formatter; legacy HTML theory stays sandboxed.
- Theory documents can attach uploaded media with existing ownership and visibility checks.
- Copied collections remap embedded image URLs to their copied media records.

#### B. Administration
- Added Change log to Admin with a Markdown download.
- Frontend keeps a bundled history snapshot for independent deployment.

---

### [v1.1.0] - 2026-10-10 | Admin UI & Users Table Optimization

#### A. UI & CSS Isolation
- **A1.** Converted Admin background to solid monochrome (cream-gray for Light / black for Dark), completely removing theme background patterns.
- **A2.** Isolated Admin CSS styles to prevent overwriting or interfering with global user theme settings.

#### B. Overview Layout & Users Table
- **B1.** Removed "Today's tasks" section, expanding available viewport space for the Overview table.
- **B2.** Set default table display density to **Compact**: condensed row height, typography, and action buttons.
- **B3.** Made the **Actions** column sticky to the right edge during horizontal scrolling.

#### C. HeroUI Menu Migration
- **C1.** Migrated **Actions** menu, Filters, and Column Selection to floating overlays (`HeroUI Popover/Dropdown`).
- **C2.** Resolved table row height expansion issue previously caused by inline menu expansion.

#### D. Quality Assurance & Testing
- **D1.** Passed all 95 automated unit/integration test suites.
- **D2.** Completed CSS verification, production build, and interactive browser testing offline (without launching a web server).

---
### [v1.0.0] - Baseline Release
- **BASE.** Stable core baseline incorporating all prior feature developments before formal changelog tracking (`history.md`).

---
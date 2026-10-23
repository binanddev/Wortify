# Change Log

### [Unreleased] - 2026-10-24 | Relevant Flashcard discovery

- Search public deck metadata, level, author, folder paths/theory and card text, with accent normalization, typo matching and ranked closest suggestions. Retain strict visibility, language and explicit level/topic filters.
- Support long queries with only one or two specific keywords. Reduce search boilerplate and secondary context; add bounded Vietnamese/English/German topic synonyms while keeping literal matches ahead of related alternatives. This is lexical/thesaurus matching rather than unrestricted AI semantic inference.
- Browse public folders and subfolders with breadcrumbs, counts and level labels. Recent searches prioritize default browsing without overriding active-query relevance. Keep history per account/language in browser storage, with reload persistence and a clear-history control.
- Reuse a process-local text index with metadata invalidation and bounded refresh for bulk text edits. Existing flat API consumers remain compatible; no schema migration is added.
- Validation: 184 frontend tests, 45 targeted backend tests, production build and desktop/mobile Chrome checks passed. Related-query tests include distractor content, partial keywords, multilingual topics and private-content isolation.

---

### [Unreleased] - 2026-10-24 | Numbered Explore pages

- Replaced Explore's accumulating Show more action with numbered pages of 12 results, previous/next controls, current-page indication and result range. Use compact responsive controls and calmer folder cards/heading; retain grid/list choice.
- Keep page in the URL and retain ranking seed, search, type, order and folder scope across page changes and browser Back. Search/filter/folder changes return to page one. Recover out-of-range URLs and focus the result heading after a requested page loads; errors can retry the same page.
- Added manual EN/VI/DE labels, pagination unit coverage and server-free desktop/mobile interaction fixtures. Validation: 181 frontend tests, 7 discovery backend tests and production build passed. The global interface check detects an existing local auto-contrast regression when a button background changes; no unrelated contrast code was modified.
- User approved committing and pushing Explore pagination. No application server or deployment check was performed.

---

### [v1.13.0] - 2026-10-22 | Faster learning, Practice library and staff workspace

- Improved Practice Hub loading with dedicated metadata queries, ID-only links and user/revision-scoped progress. My practice loads owned content and authorized pinned/current roots instead of the entire public catalogue. Added folder/title filters and optional API pagination while retaining the existing metadata contract and explicit full-content requests.
- Reduced startup downloads with lazy-loaded learning/library/settings screens, theme-specific Windows/Retro/Terminal vendor styles, separate Windows runtime dependencies and Latin/Vietnamese font subsets. Preserve stylesheet order, theme appearance and 3D flashcard interactions.
- Scoped cache invalidation to the affected language, deck/node and learning event. Review sync preserves unrelated content and does not refetch the active learning screen. CRUD refreshes related resources in the background without discarding the displayed data; Flashcard navigation reuses its catalogue when changing routes.
- Paginated card management and deck editing at 50 cards per page, and Practice folder/preview lists at 24 items. Search changes and clearing search return to the first page. Retained card selections across pages; select-all in the deck editor applies to the visible page. Reduced repeated storage reads, card-pool calculations and whole-document contrast scans.
- Consolidated Practice folder/content management into My practice: a folder-only explorer, active-path expansion, search, rename, move, group, selection, guarded deletion, visibility, preview and editing. Personal/copied roots remain available without saved pins; shared roots are added explicitly. Import/edit dialogs focus on the selected folder, support multiple UTF-8 TXT files and preserve unsaved drafts with explicit dismissal guards. Help uses one complete copyable/downloadable guide with manual English/Vietnamese/German labels.
- Moved staff bulk imports, AI/API import tools and publishing controls into the existing learning page tools. Staff share the Wortify publisher library, retain an explicitly selected private sandbox, and use the ordinary Flashcard/Practice/Reading screens. Management retains account and system operations. Shared writes validate revisions and serialize mutations; learning progress and audit identity remain attached to the authenticated account. Added per-account/revision progress for shared readings and constrained staff accounts to Studio.
- Local benchmark: Practice workspace metadata median decreased from 1,586 ms to about 50 ms, with JSON reduced from 793 KB to 53 KB; the compatible full metadata response decreased to about 194 ms. Initial JS/CSS gzip size decreased by approximately 25%. Measurements use a local SQLite snapshot in RAM and exclude production network/hosting latency.
- Validation: 295 backend tests and 178 frontend tests passed, with 17 targeted metadata/staff tests repeated after the final query change. Production build, migration consistency, staff/content-library fixtures and CSS checks passed. Chrome verified card creation/editing, pagination/search, cached navigation and persisted Practice progress against an isolated RAM database, plus desktop/mobile checks across all six themes. The user completed local review and approved preparing this release. Production deployment has not been performed.
- Deployment: deploy backend and frontend together. Apply practice migration 0010_staff_reading_progress if it is not installed; upgrades from before v1.12.0 also require cards migration 0013_deck_operation. The performance changes add no further schema migration. Local database/media and hosting configuration were left unchanged.

---

### [v1.12.0] - 2026-10-22 | Flashcard library management

- Expanded Select decks into Manage decks with a compact multi-selection toolbar, select-all, metadata editing, card management, move, copy, export and confirmed deletion. Keep the current folder scope while managing. Added sorting and per-deck action menus with quick duplication.
- Added folder menus for creating decks/subfolders, renaming, moving and deleting folders while keeping their contents. Deep trees retain compact indentation; folder actions use a borderless hover/focus button that stays visible on touch layouts and while its menu is open.
- Drag one deck or a selected group into navigation folders or My Flashcards to move; hold Alt to copy. Valid targets highlight and closed folders expand on hover. Dialogs offer the same actions on touch devices and with the keyboard; focused selection supports Ctrl/Cmd+A, F2, Delete and Escape.
- Added atomic, owner/language-scoped batch operations and UUID receipts to avoid duplicate copies on retries. Copies retain content/image links with independent learning progress. Move undo is available for 15 minutes and refuses to overwrite later changes. CSV/JSON batch export downloads a ZIP with a manifest; CSV formula protection is retained.
- Added manual English/Vietnamese/German labels, shared HeroUI menus and dialogs, inline operation feedback, and guarded pending deletion. Updated API reference and Postman examples.
- Validation: 166 frontend unit tests and 25 targeted backend tests passed. Production build passed; static HTML fixtures cover edits, card creation, drag groups, Alt-copy, root/child drops, undo, retries, exports and confirmation. No local application server was started.
- Deployment: apply cards migration 0013_deck_operation for durable receipts. Local database/media were preserved; live deployment verification remains pending user confirmation.

---

### [v1.11.0] - 2026-10-22 | Listening, flexible answers and folder navigation

- Added Listen and write with separate term and definition responses, automatic term pronunciation and replay. Added optional term audio before ordinary written questions and a voice selector. Test questions play on focus or request instead of speaking over one another.
- Added opt-in Flexible 70% checking with word alignment, limited typo tolerance and per-field scores. Correct words are green; wrong/extra words are struck out and missing/corrected words inserted in red. Both dictation responses must pass; altered negation is rejected. Exact checking remains the default.
- Keep Study answers editable after revealing the solution and require an accepted answer before advancing. Show optional examples and translations only after accepted graded answers, using a styled example panel. Test mode retains its single-attempt scoring.
- Limit Flashcard navigation to folders, open the selected path and immediate children, and use compact explorer rows. Show decks in the content area without duplicate folder tiles.
- Added dictation progress sync and written mastery support, manual English/Vietnamese/German labels, accessible feedback and Glass contrast treatment. Repaired the static interface fixture's retired icon import and added server-free interaction fixtures.
- Validation: 162 frontend unit tests, 11 targeted backend sync/permission tests and production build passed. Migration check reports no changes. Static HTML fixtures cover retry, folder navigation, listening, grading, six-theme feedback contrast and interface languages; no application server was started.
- Deployment: update backend and frontend together for the new dictation review type. No new database migration is required. Live deployment checks remain pending user confirmation.

---

### [v1.10.0] - 2026-10-21 | Flashcard images and consistent theme icons

- Added optional flashcard image links with source, credit and license metadata. Images remain external URLs; cards without images retain their existing layout. Import, export, discovery and personal copies preserve image links.
- Added image search and automatic suggestions for all cards without images, with paginated review, batched saving, cancellation and retry handling. Updated copied AI instructions and authoring guides.
- Unified functional icons through a shared semantic catalog with theme-specific variants. Corrected navigation icons and contrast, restored the flip control on both navigation faces, and removed nested SVG rendering that caused inconsistent colors and visibility.
- Added image and navigation verification fixtures. Validation: production build and 154 frontend tests passed; targeted backend image tests passed. Static browser screenshots checked navigation across six themes and Notebook at tablet width without starting an application server.
- Deployment: apply cards migration 0012_card_image_links on the backend. Live deployment verification remains pending.

---

### [v1.9.0] - 2026-10-21 | Incremental content library management

- Added Library, Import and History views for staff and superusers: search, folder navigation/creation, multi-selection, rename, move, delete and content-detail modals.
- Added append, upsert and update imports for Flashcards, Practice Hub and Reading. Batches reuse exact folder paths; deck updates preserve matching card IDs and omitted cards, while lesson updates replace submitted payloads. Personal copies remain independent.
- Added per-path previews, library-revision checks, atomic publication and idempotent retries. Import keys can read the system catalog and export content for editing; management mutations remain session-authenticated.
- Updated copied AI instructions, OpenAPI, examples and standalone guides with incremental import rules and current library/editing context.
- Reading discovery uses current materialized content for legacy packages, avoiding duplicate or stale readings after updates and deletion.
- Added optional examples and translations after answers, disabled while studying examples as virtual cards. Combined card creation and management into a modal with search, edit, delete and import.
- Validation: 43 targeted backend tests, 149 frontend tests and production build passed. Static desktop/mobile browser fixtures verified library navigation, detail/edit modals, preview/publication, rename and history. No application server was started; live deployment verification remains pending.

---

### [v1.8.0] - 2026-10-21 | Word Flight and isolated gameplay

- Added Word Flight: vocabulary gates, tap/Space flight controls, drones, storm rounds and shields, with Classic, Time Attack and Zen options.
- Improved Flashcard Defense with guided targeting, a highlighted active card, right-arrow target switching, visible typed letters and a short gameplay guide.
- Moved games into a standalone iframe page to isolate keyboard handling and styles from the main application. Desktop typing reaches the game directly; native input supports mobile keyboards and composition.
- Load Phaser and game scenes only after Start. Gameplay does not change flashcard learning progress.
- Validation: 149 frontend tests and production build passed. Static browser checks passed for desktop typing in the isolated frame and mobile Word Flight input and gate completion. Build output confirms neither the main app nor game setup eagerly loads Phaser. No application server was started; live deployment testing remains pending confirmation.

---

### [v1.7.1] - 2026-10-20 | Direct typing and repeating audio

- Removed the visible typing field from Flashcard Defense. Gameplay captures typing automatically after starting or resuming, with letters displayed on the target card. Native text input preserves composition support.
- Added a touch keyboard button for reopening the mobile keyboard.
- Audio cards repeat after a two-second pause following pronunciation. Multiple cards rotate, prioritizing the locked target; pausing stops audio.
- Validation: 142 frontend tests and production build passed. Targeted audio tests verify repeat timing; static browser checks verify input focus, hidden typing field and pause/resume. No application server was started.

---

### [v1.7.0] - 2026-10-20 | Flashcard Defense

- Added Flashcard Defense with Phaser, shared across all themes: falling vocabulary targets, typing locks, lasers, explosions, progressive hints and pronunciation.
- Added multi-deck selection, Classic, 60-second Time Attack and Zen modes, three difficulty levels, answer directions and case-sensitive typing.
- Added Freeze, Nuke and Health power-ups and armored bosses based on difficult words. Gameplay does not write flashcard learning progress.
- Added layered typing, error, targeting and combat sounds, volume controls and automatic effect ducking during pronunciation.
- Fixed touch activation of game buttons inside the isolated interface while retaining HeroUI components. Added pause/resume, focus handling and responsive layouts.
- Load the game engine only when opening gameplay; updated the compatible source-map-js dependency.
- Validation: 142 frontend tests, the targeted backend test and production build passed. Static browser checks passed for mouse and touch Start, pause and resume. No application server was started; live deployment testing remains pending user confirmation.

---

### [v1.6.0] - 2026-10-19 | Study example sentences

- Added optional example-sentence study to Cards, Learn and Test using each term's existing sentence and translation. These are temporary study items, not new flashcards.
- Added sentence ordering (after its term or mixed) and independent sentence/translation first-side settings. Incomplete sentence pairs are skipped; sentence answers do not persist learning progress or change term mastery.
- Quick editing and starring sentence items target their original term. Removed the duplicate home button from deck navigation.
- Removed the Vocabulary Notebook study mode, entry points, API and dedicated implementation. The Notebook visual theme and compatibility with older backups remain intact.
- Validation: 132 frontend tests, 19 targeted backend tests and production build passed. No local web/server was started; live checks remain pending deployment confirmation.

---

### [v1.5.2] - 2026-10-19 | Guest account buttons

- Fixed guest registration and sign-in buttons inheriting the 32px logout icon sizing.
- Reused the shared HeroUI button component with full-width stacked actions, a primary registration button and bordered sign-in button. Theme styling remains shared.
- No local web/server was started.

---

### [v1.5.1] - 2026-10-19 | Shared workspace for guests

- Removed the separate guest page and header. Guests now use the existing workspace shell, navigation, themes, Explore and Reading components.
- Account actions open a compact modal with registration and sign-in buttons. Registration and sign-in use the existing authentication page.
- Skip personal navigation queries, background requests and learning sync for guests; public learning remains available and private actions stay protected.
- Validation: 126 frontend tests passed and production build passed. No local server was started; live deployment checks remain pending user confirmation.

---

### [v1.5.0] - 2026-10-19 | Browse and learn before signing in

- Opened public Flashcard, Practice Hub and Reading catalogues to guests with language navigation, search and public previews. Added public direct-study routes, paginated flashcard study and exercise/reading practice without account progress writes.
- Added sign-in and registration dialogs at account actions. Requested library saves continue after authentication; retries after a successful registration do not register the account again.
- Kept private content, account data, editing, imports, progress sync and administration authenticated. Public media access requires an attachment to active public learning content; public folder previews exclude private children.
- Reused shared study, modal and UI components and added guest route, public/private access, media revocation and write-permission regression coverage.
- No local web/server was started. Live deployment checks remain pending user confirmation.

---

### [v1.4.2] - 2026-10-19 | New-content publishing option

- Removed the duplicate My Flashcards icon from Explore navigation; the shared navigation home action remains.
- Added Only new content public for staff/admin. Newly created and imported flashcards, practice and readings are public; existing content keeps its visibility when the mode is enabled or edited.
- Retained the existing all-public and user-choice modes, updated translations and creation controls, and added regression coverage for old-content preservation and bulk imports.
- Deployment: apply content migration 0005 before using the new publishing mode. No local web/server was started.

---

### [v1.4.1] - 2026-10-18 | Flashcard discovery layout and deployment diagnostics

- Moved Flashcard Explore search, filter and refresh controls into navigation; added an apply/reset filter modal and compact responsive deck tiles using shared components.
- Added a read-only preview modal with up to ten cards and independent-copy actions. Preview access follows public visibility, language and active-owner permissions.
- Added backend version, deployed commit and feature identifiers to the uncached health endpoint; explicitly pinned the Render Blueprint branch to minhtien.
- Documented how to verify manually created Render services, failed deploys retaining old code and Netlify proxy targets. Added route-presence and preview-access regression tests.
- Live deployment testing is pending user confirmation; no local web/server was started.

---

### [v1.4.0] - 2026-10-18 | Public content, discovery and import controls

- Added a shared publishing policy for staff and administrators: publish all existing and future learning content, or let users choose public/private. Switching back to user choice preserves current visibility. Enforced the policy for normal edits, imports and bulk writes across flashcards, practice and reading.
- Added public Flashcard Explore with search, level/topic filters and independent personal deck copies. Repeated saves reuse the existing copy; learning progress is not copied.
- Unified public Practice Explore and migrated Wortify packages into the same catalogue as other public authors, removing the separate system-library panel.
- Split staff file imports and bot API instructions into Flashcard, Practice Hub and Reading sections. Added compact DECK/TERM/MEANING syntax with optional example, translation and part of speech; validated section matching before publication.
- Updated OpenAPI, section-specific templates, English/Vietnamese/German labels and both standalone authoring guides. Added a clear backend-update error for deployed services missing the import API.
- Extended touch navigation handling to iPad widths beyond the mobile breakpoint and explicitly hid inactive navigation faces to prevent mirrored overlap.
- Added Refresh application in Settings to clear application caches and reload while retaining local preferences and pending learning data.
- Validation: 248 backend tests and 124 frontend tests passed; four focused publishing-policy tests passed after the final API regression check. Production frontend build passed. No web/server was started; physical iPad verification remains outstanding.
- Deployment: apply the included cards, content and practice migrations. Update Render and Netlify together; an older Render deployment still returns 404 for the import API. The default publishing policy remains user choice until staff/admin changes it.

---

### [v1.3.1] - 2026-10-18 | Mobile navigation repair

- Replaced the mobile 3D navigation flip with a single visible drawer panel to prevent mirrored, overlapping menus on iOS/Safari. Desktop navigation keeps its existing animation.
- Corrected Menu/Page tools toggling and expanded states; constrained mobile header controls and icon actions, with independent vertical navigation scrolling.

---

### [v1.3.0] - 2026-10-18 | Learning workflows, languages and workspace management

- Added manually maintained English, Vietnamese and German application languages, independent of the learning language.
- Replaced flashcard games and the separate due-review interface with the vocabulary notebook: prepare, recall, translate, write a sentence and check again. Added recall grading, review intervals and in-session card editing.
- Simplified card fields and import templates; added quick card creation, deck switching, multi-selection and folder moves. Removed duplicate Notebook library actions.
- Added workspace management for top-level flashcard folders: search, active/all filters, remove and restore complete branches, rename and explicitly confirmed permanent deletion. Removing a branch preserves cards and learning progress.
- Repaired resume for sessions containing deleted cards; retained valid answers and excluded sessions without pending questions from the resume action.
- Added Reading discovery with search and level/topic filters, public sharing, Study now and Save to My readings. Personal copies retain independent progress and repeated saves reuse the same copy.
- Connected Practice Hub learning, editing and creation flows; reduced catalogue requests to metadata and loaded lesson content on demand. Replaced repeated tree scans with indexed lookups and memoized derived data.
- Added compact Wortify Text 1 packages for staff Practice Hub and Reading imports, including nested folders. Shared validation supports preview/publish, signed preview tokens and retry-safe package IDs; personal flashcards stay outside system imports.
- Added revocable import API keys, bot OpenAPI/authoring endpoints, editable endpoint examples and synchronized standalone content-authoring guides.
- Simplified authoring screens and fixed superuser account management. Updated API documentation and backup handling for the new learning data.
- Switched Studio and Notebook to Vietnamese-safe system fonts; refined responsive layouts and touch controls for Studio, Notebook and MS-DOS. Reduced default navigation width and interface text size while preserving saved preferences.
- Reused shared HeroUI controls for workspace dialogs and recorded the project-wide preference for concise interface copy.
- Deployment: apply the included cards, practice and users database migrations before serving the updated application.

---

### [v1.2.8] - 2026-10-17 | Workspace cleanup

- Moved both standalone content-authoring guides into docs/authoring and updated README links and the guide exporter.
- Removed generated local test logs, previews, build outputs and caches; preserved local database, media, environment configuration. Removed obsolete development recovery backups after explicit confirmation.

---

### [v1.2.7] - 2026-10-17 | One-file system content imports

- Added staff/admin JSON package import with preview, atomic validation and retry-safe package IDs.
- One document holds nested flashcard folders/decks, Practice Hub folders/exercises/theory and Reading folders/lessons, up to 10 folder levels.
- Added a persistent Wortify system library without uploader attribution; learners add independent native copies with their own progress.
- Added Reading folders and sibling-scoped flashcard folder names so different branches may use the same folder name.
- Added a downloadable complete example and two standalone chat guides with all authoring rules; moved account ZIP recovery to a separate admin document.
- Fixed Explore cache refresh for saves sharing a timestamp and hid staff attribution in public discovery.
- Limits: 50 MB, 5,000 nodes and 100,000 cards per package; uploaded binary media is not embedded. Published packages are snapshots; existing packages are not overwritten.

---

### [v1.2.6] - 2026-10-17 | Deployment, backup restore and content authoring

- Prepared Render backend, Netlify frontend, Neon PostgreSQL and private S3 media; kept SQLite/media local and consolidated startup scripts.
- Added manual deployment instructions, environment-variable references and private account documentation excluded from Git.
- Added Manage → Backup & import: preview and restore new accounts, roles, supported permission mappings, available password hashes and private learning data. Existing usernames are never overwritten; missing hashes require password reset.
- Import limits and exclusions are explicit: class memberships, old audit logs and cross-account links are not restored.
- Added a complete, regeneratable authoring guide covering flashcards in German/English, every supported exercise type/style, theory, formatting, Reading, quality checks and batch import workflows.
- Short requests have defaults: 10 A2 transport decks means 10 separate themed decks with 30 cards each, without requiring repeated clarification. Online creation still requires the real app URL and authenticated tool access.
- Included the Reading workspace, flashcard/navigation simplification, JSON/Quizlet import improvements and request/study optimizations documented below.
- Validation: 12 backup/export/restore tests, 124 frontend tests and frontend production build passed for the preceding implementation; release documentation is synchronized into Admin History.

---

## 2026-10-13 — Feature cleanup and backup compatibility

- Removed Watch & Learn, its APIs, video lessons and directly linked decks.
- Removed Word Rescue; Sentence Quest and Phrase pairs remain.
- Quizlet two-column Tab imports are recognized automatically; examples remain optional.
- Legacy ZIP imports skip retired video data; user and admin backups tested.

## Reading — independent learning workspace

- Reading is a top-level app beside Practice Hub, with its own private library, authoring, editing and deletion.
- Import/paste reading lessons and mixed single/multiple-answer questions from UTF-8 text; copy AI instructions, preview and upload images within Reading.
- Two-pane passage/question view on desktop; Passage/Questions tabs on small screens.
- Safe HTML or lesson markup supports image sizing/alignment, captions and tables. Manual checking, explanations, revision-aware progress and backups are supported.

## Games — Word Rescue & Sentence Quest

- Replaced the two exercise-style games with staged treasure expeditions: letter rescue and word-island bridge building.
- Energy, optional challenge clocks, combo rewards, hints, pause/resume and missed-stage replay. Timers stop in hidden tabs and inactive Windows app windows.
- Phrase pairs remains available. All games use the selected deck and do not alter spaced repetition.

## v3 — Watch & Learn

- Grouped video navigation: library, lesson vocabulary, subtitles and playback controls. Add/import forms open in dialogs; transcript follows playback without scrolling the entire page.

- Vietnamese meaning suggestions via free MyMemory lookup, editable before saving; graceful fallback for provider limits.

- In-app dictionary modal with selectable Wiktionary definitions, editable meanings and additional context notes.
- Clear paste-subtitles and file-import workflow.

- Personal YouTube video lessons with free best-effort transcript retrieval and SRT/WebVTT import.
- Synchronized subtitles, sentence replay/loop, dictionary links and per-video vocabulary decks.
- Original sentences and video timestamps saved with words. Video lessons included in backups.


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
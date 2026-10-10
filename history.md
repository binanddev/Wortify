# Change Log

> **Initial Note:** 
> Prior to this release milestone (`v1.0.0`), the system underwent multiple upgrades and feature refinements, operating stably in production. All preceding unrecorded versions are consolidated, making this the baseline release.

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
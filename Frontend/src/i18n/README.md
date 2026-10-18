# Interface languages

`messages.json` is the manually maintained UI catalog. English source strings are keys; `vi` and `de` contain reviewed wording. Optional `en` fixes legacy labels. There is no translation service, DOM text replacement, or machine-translation request.

- In a React component call `useLocale()` and render `tr("Source label")` (`import { t as tr, useLocale } ...`). The subscription updates open windows and dialogs without remounting them.
- For dynamic messages use named placeholders: `tr("Move {v0}", {v0: folder.name})`. Translate the surrounding message, never the user-supplied value.
- Translate display labels only. Keep API values, form option values, IDs, source-format keywords, user titles, vocabulary, answers and lesson content unchanged.
- Add both translations together. `tests/i18n.test.mjs` checks completeness and placeholder consistency. English remains the fallback for unknown server errors or third-party diagnostics.
- `/api/me/language/` saves `uiLanguage` in the account profile; workspace `de`/`en` remains the learning language. The browser remembers the last display language for the sign-in screen; the signed-in account preference takes precedence.
- Technical export guides and API examples retain their original schema keywords. Changing UI language must never rewrite saved content or exported answers.

Server-free checks: `npm test`, `npm run build`, `node scripts/verify-vocabulary-notebook.mjs`, `node scripts/verify-import-api.mjs`. The last two compile isolated fixtures and open local HTML files in headless Chrome; they do not launch Django or Vite servers.

# Browser regression checks

From the repository root, install the frontend dependencies and Chromium once:

```powershell
npm ci --prefix Frontend
npx --prefix Frontend playwright install chromium
npm run test:e2e --prefix Frontend
```

Python dependencies must already be installed. Windows uses `.venv/Scripts/python.exe`; other platforms use `python3`. Set `E2E_PYTHON` to choose another interpreter.

The runner creates a new database and media directory inside ignored `Frontend/.interface-preview/e2e-*`. It applies migrations only to that new database, creates three test accounts and fixtures, then starts Django on port 18000 and Vite on port 15173. It overrides local environment files, database and media configuration, does not contact production, and stops its own servers after the run. Existing services on these ports cause failure instead of being reused or stopped. Test accounts and passwords are disposable fixtures, never production credentials.

The suite uses the actual frontend, Django session/CSRF checks and database. It covers:

- Sign in, star/review a flashcard, verify server progress and reload; switch to another account in the same browser and check private-content isolation.
- Open the library card manager, request page two from the server, preview a card import without changing data, confirm it, verify server persistence and reload.
- Open a public lesson anonymously and check that the teacher can revoke access.
- Exhaust localStorage for sync receipts, retain an unsent star in IndexedDB, reload and verify recovery to the server.
- Create/import Practice Hub exercises, retain authored hints, edit ordering exercises without losing distractors, and keep legacy judgment lessons usable.
- Use the exercise-settings modal, complete grouped gaps on desktop/mobile, retry and restore answers, and verify server-graded results for self-check, matching, categorization and sentence ordering.
- Propose an alternative answer as a learner and approve it explicitly as the owner; save revealed questions even when the unfinished answer contains only whitespace.

Failures retain screenshots and Playwright traces in `Frontend/test-results/`; the HTML report is in `Frontend/playwright-report/`. Open it with `npx --prefix Frontend playwright show-report Frontend/playwright-report`. Those folders and isolated databases are ignored by Git.

`.github/workflows/checks.yml` runs backend checks, migration drift detection, Django's configured test runner, frontend unit tests/build, all realtime protocol tests and this browser suite on pull requests and pushes to `main`/`minhtien`. Failed browser artifacts are kept for seven days. The workflow does not deploy or access repository secrets.

## Clean installation regression

Run `npm run test:e2e:clean-start --prefix Frontend` separately from the regular browser suite (they use the same test ports). It migrates another isolated database and skips all fixtures. A test-only setup key creates the first administrator through the real form; the test previews/publishes a new English package, retries without duplicates, registers a learner, saves a personal copy, studies and reloads to verify persistence. German remains empty. No demo data or fixed content IDs are required.

The test-only setup key is set only in the isolated child server process. Never copy it to hosting. The CI workflow runs this suite after the regular browser suite.

# Classroom teaching boards

Open Classes → a class → Teaching studio. Class owners create lessons and write; current class members view. Copy lesson link opens that lesson after the normal session and membership checks.

## Data and transport

- Fixed landscape/portrait pages, white/grid/ruled paper; PDF pages are appended with their displayed orientation.
- Vector coordinates in page units. Pen/pencil/highlighter and line/rectangle/ellipse, stroke eraser, reversible clear, 100 local undo steps. Touch/stylus drawing is supported; pressure variation and text objects are not implemented.
- Local ink chunks about every 80 ms; durable HTTP writes are grouped at least 250 ms apart. Signed committed events are broadcast by the standalone `Realtime/` WebSocket relay. Viewers apply pushed vectors directly. HTTP reconciliation runs every 30 seconds while connected, or every 10 seconds during fallback. See `Realtime/README.md` for independent deployment and authentication. No production load test has been run.
- UUID batches are persisted before send and retried unchanged after acknowledgement loss. Server row locks, revision checks and unique batch IDs prevent duplicates/overwrites. Another writing window pauses editing with a downloadable recovery copy and an explicit reload action.
- IndexedDB recovery on the current device; if unavailable, live saves continue with a warning. Initial opening requires server access. Unsaved-close and browser-unload warnings protect pending changes.
- Delta reads defer the large state column; the last 500 batches are retained, at most 64 returned per poll. A stale cursor or PDF import receives a snapshot. Snapshot state is bounded to 200 pages / 200,000 points; 128 operations and 256,000 request bytes per batch, 2,048 points per chunk. Client queues are packed below 180,000 bytes, including long offline backlogs.

## PDF and deployment

- `BoardPDFUploadHandler` streams to temporary disk with a 300 × 1024 × 1024 byte limit, separate from other upload handlers. Both client and server enforce the limit; pypdf validates contents, encryption, page count and dimensions. The total lesson limit is 200 pages including existing board pages; an untouched starter page is replaced on import.
- Assets are private; the authenticated class endpoint streams them. PDF.js renders only the current page, with a bundled worker and eval disabled. Source documents are cached while open and destroyed on close.
- Export processes pages sequentially, rasterizing backgrounds + visible annotations at 1.5× page resolution into a PDF. Export is flattened; source text is not selectable. It handles PDF rotation/cropping through the same PDF.js viewport used on the board.
- Portable account backups include boards/PDFs, remap private asset IDs and reset the derived sync journal. Full site exports also include the journal. Existing backup size limits still apply.
- Install updated Frontend dependencies and Backend requirements, then run `python manage.py migrate`. Django stays WSGI-compatible. The separate Node relay requires no database/Redis for a single instance; multiple instances need Pub/Sub. Before production rollout, verify the reverse proxy upload-size/time limits and temporary disk/object-storage capacity for 300 MiB uploads; this has not been verified against Netlify/Render.

## Code-only validation

Frontend: `npm test` and `npm run build`. Tests exercise actual PDF rasterization/export using the optional PDF.js native canvas dependency, recovery/duplicate delivery/conflict cases and vector hit testing. Backend: `python manage.py test api.test_teaching api.test_backups api.test_api_reference` plus migration checks. A boundary test covers exactly 300 MiB and overflow without allocating a 300 MiB fixture.

No browser QA or production deployment is required by this task. No performance claim is based on production traffic.

Public access is opt-in per lesson via the sharing modal. Opaque public links use read-only guest tickets, never class membership or write access. Revocation/rotation changes the sharing generation; the relay disconnects outdated guests before sending new events. Backup restores rotate tokens and disable sharing. Local `start.ps1` now owns the relay process/configuration as well as Django/Vite.


## Class-only performance fixes

- Failed HTTP reconciliation now backs off from 2 seconds up to 30 seconds; an outstanding resync can no longer create a 0 ms request loop. A single-flight guard prevents overlapping ticks.
- Local draft checkpoints are coalesced at 250 ms and ordered; fully acknowledged drafts are deleted. IndexedDB connections are reused. Every outgoing durable batch is still checkpointed before send.
- Committed ink and the active stroke use separate canvases. The large committed scene is not redrawn for each pointer frame/chunk. Eraser bounds are cached incrementally.
- One PDF loading task is retained at a time; navigation/closing cancels obsolete work. Export keeps an independent one-document cache and indexes ink by page.
- Lesson-list refreshes are sequential, abortable and paused while hidden or while a board is open.
- Backend ink point totals are calculated once per batch; redundant snapshot copies and membership JOIN multiplication are removed. The relay serializes each classroom update once and isolates failing/slow viewers.

These are code-level regression/performance checks, not a production capacity claim. Django still persists a bounded full JSON snapshot for each saved batch; changing that storage model requires a separate design and measured workload.

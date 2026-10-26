# Admin guide: exporting and recovering data

Wortify 1.14.0. Only active superusers can use site exports.

## Open the tool

Sign in as Admin → Management → Backup & import. The new website exporter is above the separate emergency account export/import panel. Read this guide here or download it for later.

## Choose a preset

- All learning content: all accounts, public and private, all Flashcard/Practice/Reading content and uploaded media. Includes source packages not attached to accounts. Omits account profiles and personal learning history.
- Public learning content: public content plus unmaterialized public system readings. Private ancestors retain structure and names only.
- Content and accounts: identity, profiles, preferences, groups/permissions, classes, progress and optional audit history. Password hashes remain off unless explicitly enabled.
- Accounts only: identities, profiles, study preferences, themes and permissions without learning content. Enable media to preserve profile/theme images.

For a complete learning archive, keep all accounts/modules/languages, both visibility types, no date filters and media enabled. For one learner, choose Content and accounts, select that account and enable progress if needed.

## Filters and account scope

Practice includes every exercise and theory type, including dictation. There are no separate grammar/listening/writing/speaking filters. All answer variants, explanations, lesson payloads, positions and folder trees are retained.

Dates use the latest update timestamp, or creation timestamp if no update field exists. Tables without timestamps are not date-filtered. Child records and structural parents may fall outside the date range. Date filters do not create automatically mergeable incremental backups.

All accounts ignores account search filters. Matching filters includes every matching account, across pages. Selected accounts preserves checked users across pages; Select this page only selects the visible page.

Content is scoped by owner; progress is scoped by learner. A learner may have progress on another author's public content that is absent from the export; inspect reference/unresolved.json. System source packages are only included for All accounts, excluded from private-only exports and projected to selected modules. Source packages may duplicate already imported content; do not count both as independent lessons.

## Optional data

Without account identities removes structured ownership links and account profiles/history, but retains content IDs. Free text, filenames and URLs may contain personal information. Keep account references preserves owner/learner IDs; choose Content and accounts to include account records too.

Media includes stored uploads and generated card speech. External image/audio URLs remain links and are not downloaded. Browser speech and recordings held only on a device are not server data. Metadata-only exports cannot restore file bytes.

Learning progress requires linked identity. Account-wide LearningEvent records can refer to content beyond the selected modules. Audit history is available with Content and accounts. Password hashes are opt-in and never plaintext; without hashes, restored accounts need a password reset. Store account/hash archives encrypted with restricted access.

## Review and download

Review export → inspect counts and warnings → Download documented ZIP. Keep the page open. Changing options clears the preview. Counts may change if content changes after preview; the downloaded manifest is authoritative. Downloads do not modify website content; exports are audited.

Limits: 2 GiB expanded data, 500,000 records, fewer than 100,000 files. Split larger exports by accounts, language or module. Avoid deleting/editing media during large exports.

## Inside the ZIP

README.md starts the guide; RESTORE.md and ANALYSIS.md describe recovery/analysis. manifest.json records timestamp, filters, migrations, counts and SHA-256 file hashes. Detached exports omit account search queries and selected account IDs from the saved options. SCHEMA.json describes fields and relationships. INDEX.csv lists data files and counts. data/ holds UTF-8 JSON arrays with original IDs and nested payloads. media/ holds uploaded bytes if selected. reference/ documents media mappings, external references and projected source packages.

Keep the complete ZIP. Join data using model and original IDs; preserve nested payloads. Verify checksums before recovery.

## Recovery and errors

The new wortify-site-export ZIP cannot be uploaded to the existing Import ZIP screen. An operator must follow RESTORE.md in an isolated database/storage environment with matching migrations, map IDs/accounts/permissions and verify content before cutover. Detached content needs a destination owner.

For existing account recovery through the UI, use the separate emergency export, enable portable user ZIPs/media and optionally password hashes. Import ZIP → preview identities/permissions → restore. Existing usernames block the entire batch; nothing is overwritten. Content restores as private copies. Without hashes, set new passwords. Missing legacy permission mappings require a new export. Emergency import is limited to 512 MB and 1,000 accounts per batch; it does not restore cross-account links, class memberships, audit logs or sessions unchanged.

Permission errors require an active superuser. Empty results require adjusted account filters. Fix invalid dates or select a learning module. Missing storage files cause export failure; repair storage or export metadata first. For size limits/timeouts, split the selection and retry. Incomplete downloads or checksum mismatches must not be used for recovery. Confirm the ZIP format when import rejects a file.

Source code, static assets, deployment configuration, engine metadata and server secrets require separate backups. Sessions, reset tokens and import API keys are excluded. After recovery, verify permissions, visibility, answer keys, trees, media and learning progress.

# User backup format v1

Settings > Backup & restore exports both language workspaces to a single ZIP.

- `manifest.json`: format identifier, version, UTC creation time, SHA-256 checksums.
- `data/*.json`: allowlisted Django-model records, UTF-8. These are portable records, not executable fixture imports.
- `media/`: owned background images and practice image/audio uploads.
- `reference/workspace.json`: pinned Practice Hub folders captured by the browser.
- `reference/memberships.json`: class membership names for reference only.
- `README.txt`: recovery and privacy notes.

Export includes owned content, personal learning records, uploaded files, profile/settings and owned classes. Passwords, authentication tokens, permissions, other users, generated TTS caches and monitoring logs are excluded. Browser-only window positions and transient UI state are not learning data and are not restored. Unsynced learning changes must successfully sync before the browser starts export.

Restoration creates private copies and maps foreign keys and media IDs to newly created records. Existing content is not deleted. A repeat import creates another copy. Profile/study settings replacement is opt-in. Classroom memberships are never imported and invitation IDs regenerate. History linked to non-owned content is retained in the ZIP but skipped on restore; the result reports skipped records. Maximum 10 background images still applies.

`GET /api/me/backup/` exports server data. `POST` additionally accepts `{workspace: {de: [nodeId], en: [nodeId]}}`.
`POST /api/me/backup/restore/` accepts multipart `file` and `preview=true` to inspect counts. Send `confirm=true` and optional `settings=true` to restore. All routes require authentication; mutations require normal CSRF protection.

Limits: 512 MiB compressed/expanded, 32 MiB per data section, 10,000 ZIP entries, 100,000 records. Uploads stream to temporary storage. No ZIP paths are extracted to the filesystem. Checksums detect corruption (they are not cryptographic signatures). Only allowlisted models/fields are accepted; owner IDs are replaced with the signed-in user. Media is decoded with an explicit image/audio format before saving. Database changes are atomic; new files are removed after rollback. Configure reverse-proxy upload limits and timeouts accordingly. No database migration is required.

Run `python manage.py test api.test_backups` for round-trip, isolation, corruption, rollback and media tests.

## Administrator emergency exports

`POST /api/manage/backups/` is restricted to active superusers. Scopes: `all`, `filtered` (`q`, `role`, `status`), `selected` (`ids`). `preview=true` returns a count and sample account identities. For a binary download, send `confirm: "EXPORT"`. `include_media` and `include_audit` default true; `include_credentials` defaults false. The latter includes existing password hashes (never plaintext). Exports are recorded in the admin audit log. Maximum expanded export is 2 GiB; portable per-user archives retain their 512 MiB limit.

Emergency ZIPs contain accounts, groups, reference memberships, optional audit logs, original-ID per-user database records, and optional portable user ZIPs/media. They are **not accepted by personal restore**. Portable nested ZIPs can recover learning data as copies; original identity/role reconstruction requires an operator-led recovery on an isolated database with the same schema and careful relation mapping. Sessions, reset tokens, deployment secrets, global site assets/configuration and database schema are not part of this account-data export. Do not run the JSON files as fixtures on a live database. Store credential-bearing archives encrypted with restricted access.

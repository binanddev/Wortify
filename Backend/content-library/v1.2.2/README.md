# Launch content v1.2.2

This directory contains data exports, not a generator or application dependency.

- accounts.csv: 30 managed content authors, language, topic, root ID and requested login password.
- One JSON document per author: nested folders, theory and exercise payloads.
- import-report.json: database import counts and the pre-import SQLite backup path.
- source/: original bilingual vocabulary tables retained for editorial maintenance.

The local configured development database has 1,500 English and 1,500 German
public exercises, 100 per author, 10 distinct questions per exercise, plus 150
theory pages. All accounts are regular users, never staff/admin.

Pedagogy: each topic uses five units of ten bilingual expressions, revisited
through 20 recognition, recall and grammar objectives. There are 750 source
expressions per language, not 30,000 unrelated sentences. Level labels are
editorial estimates, not independently certified CEFR assessments.

JSON exports preserve ownership as author metadata; the normal content import
endpoint imports the nodes under the authenticated account. They do not create
accounts or preserve database IDs. Importing again would create duplicate content.
The existing database backup is the full pre-import rollback point.
The removed seed command is no longer needed to run or deploy the application.

# v1.2.3 Grammar library

- 100 regular managed library accounts; 12 randomly selected publishing authors.
- 1,000 public exercises: 500 English and 500 German, 10 questions per exercise.
- 20 grammar objectives across 50 everyday topic units per language.
- Formats: inline dropdown, inline choice buttons, choose-and-reveal.
- Every question includes a rule explanation, completed sentence and Vietnamese action meaning.
- grammar-lessons.json: validated lesson payloads, with stable content keys.
- accounts.csv: local credentials and per-author counts; do not publish.
- import-report.json: database IDs, author distribution and pre-import backup path.
- references.json: grammar-rule sources. No source exercise questions were copied.

These are structured grammar transformations, reusing 500 bilingual action
phrases across ten objectives in each language. They are not 10,000 independently
authored situations and have not received independent teacher review.
Automated validation checks schema, question uniqueness within each lesson,
answer membership, distractor uniqueness, and actual frontend grading for both
correct and incorrect submissions. Answer positions are shuffled.

This folder is an export, not a runtime dependency. Published lessons remain
in the database if this folder is removed. A full database backup is the
appropriate recovery source for users, relationships and learning progress.

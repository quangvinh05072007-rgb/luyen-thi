# OCR and upgrade decisions — 2026-10-26

Implemented: local scanned PDF import using PDF.js + @napi-rs/canvas + Tesseract.js with bundled Vietnamese trained data. No upload to an external OCR service, AI key, GPU, Python or runtime model download is required. Existing Word import already reads Office Math (OMML) and embedded images; existing KaTeX renders editable LaTeX.

Scans use original image crops as the canonical question. Diagrams, tables, inline equations and answer choices remain visually intact. OCR text is separate, editable and searchable. Formula recognition is not verified editable LaTeX; image retention avoids presenting corrupted OCR math as correct. Question continuations are kept across pages. A–D stays in printed order for these questions, while question order can still vary. Explicit answer conclusions are extracted from the separate text solution section, with missing/conflicting answers left for review. New questions remain drafts.

Limits: one OCR import at a time; at most 20 exam pages; bounded page rendering and OCR; original question images can be large on phones and in Word. Manually review segmentation and answers before approval. The final OCR question count must be compared to the source, especially on unconventional layouts or multicolumn papers.

Verified on the supplied Bắc Ninh PDF: 8 pages, first 4 scanned; 22 questions (12 MCQ, 4 true/false, 6 short response), 24 original crops including 2 question continuations; 22 explicit answers read from the text solution section. Approximately 32 seconds on this machine in a direct import run. Tests cover fixed option order, image storage/export, OCR text persistence/search, question versions and part segmentation.

Repositories assessed:

- https://github.com/naptha/tesseract.js — integrated for local Vietnamese OCR and bounding boxes.
- https://github.com/mozilla/pdf.js — existing PDF engine extended for rendering and per-page scan detection.
- https://github.com/KaTeX/KaTeX — already integrated; retained.
- https://github.com/datalab-to/marker — candidate for a separate advanced editable math extraction service; not installed or claimed active. Requires its own Python/model runtime and actual accuracy checks on Vietnamese exam papers.
- https://github.com/VikParuchuri/texify — archived/deprecated; upstream directs users to Surya. Not integrated.
- https://github.com/surveyjs/survey-library — useful form renderer; current app already has exam timing, autosave, grading and three question types. No replacement needed for OCR.
- https://github.com/1024-byte/ExamKing — supplied URL could not be verified in this audit; no code copied.

Proposed next upgrades, not implemented in this change:

1. Advanced math OCR adapter (evaluate Marker/Surya on a held-out Vietnamese math corpus), side-by-side formula correction and editable LaTeX with source crops retained.
2. Persistent background import jobs with page progress, cancellation/retry, a review checklist and batch import.
3. Rich question editor, program/topic tagging, duplicate detection, question version comparison and review assignment.
4. Exam scheduling/retakes, class gradebook, notifications, parent reports and learner support workflows.
5. Multi-school administration, recovery drills, observability and load tests before production rollout.

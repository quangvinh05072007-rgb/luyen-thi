# Import and authoring workspace

User authorized immediate implementation of the pasted upgrade roadmap. Keep current React/Node/SQLite app, school isolation, image originals, three question types, existing attempts and exports. No production scalability claims without measurement.

First delivery, implemented in the current workspace:

- [x] Tiptap authoring for stems, choices and solutions; MathLive formula insertion; table editing; retain canonical plain/LaTeX/image-token storage so existing grading and Word export continue to work.
- [x] Side-by-side source scan and editable question, keeping the original reference even after replacing a scan with editable text.
- [x] Durable background imports with page progress, multiple files, cancel/retry, reopening after navigation and server restart, draft persistence with revisioning.
- [x] Advanced OCR adapter and a local Marker runtime experiment. Only enable a tested engine. Preserve original scans and leave OCR output as a suggestion requiring review.
- [x] Behavioral tests for conversion round trips, job recovery, ownership, cancellation/retry, draft preservation and source preservation; run full regression and browser checks.

Subsequent roadmap tracks (do not represent these as completed by installing a package): semantic duplicates, SymPy grading rules with explicit domains, OMR templates and review, collaborative editing, external SSO, load testing and external backups. Each needs its own end-to-end validation before release.

Design: compact blue toolbar, editor/source tabs on mobile and two columns on desktop. No new oversized hero or summary cards. The rich editor supports the app's existing data model rather than silently changing stored question semantics. Formula widgets load only when editing. Background results stay on the server and are restricted to the uploader (or school administrator); saving them to the bank remains an explicit action creating drafts.

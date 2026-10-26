# Import and authoring workspace

User authorized immediate implementation of the pasted upgrade roadmap. Keep current React/Node/SQLite app, school isolation, image originals, three question types, existing attempts and exports. No production scalability claims without measurement.

First delivery, implemented in the current workspace:

- [x] Tiptap authoring for stems, choices and solutions; MathLive formula insertion; table editing; retain canonical plain/LaTeX/image-token storage so existing grading and Word export continue to work.
- [x] Side-by-side source scan and editable question, keeping the original reference even after replacing a scan with editable text.
- [x] Durable background imports with page progress, multiple files, cancel/retry, reopening after navigation and server restart, draft persistence with revisioning.
- [x] Advanced OCR adapter and a local Marker runtime experiment. Only enable a tested engine. Preserve original scans and leave OCR output as a suggestion requiring review.
- [x] Behavioral tests for conversion round trips, job recovery, ownership, cancellation/retry, draft preservation and source preservation; run full regression and browser checks.

Subsequent roadmap tracks completed:
- [x] Semantic & mathematical duplicate question detector (`shared/duplicate-detector.mjs`, `POST /api/questions/check-duplicate`, warning alert in `QuestionEditor.tsx`).
- [x] SymPy mathematical equivalence verification & validation (`tools/math_verify.py`, `server/math-verify.mjs`, `POST /api/math/verify`, `POST /api/math/validate`).
- [x] Enhanced side-by-side OCR comparison & one-click scan-vs-text toggle in import review (`Import.tsx`).
- [x] Optical Mark Recognition (OMR) paper exam pipeline: printable A4 bubble sheet with alignment markers for 2025/2026 graduation format, OpenCV perspective warp and bubble fill evaluation, anomaly flagging (multiple/faint/blank), and teacher grading review modal (`tools/omr_processor.py`, `server/omr.mjs`, `src/ui/OmrModal.tsx`, `Exams.tsx`).

Design: compact blue toolbar, editor/source tabs on mobile and two columns on desktop. No new oversized hero or summary cards. The rich editor supports the app's existing data model rather than silently changing stored question semantics. Formula widgets load only when editing. Background results stay on the server and are restricted to the uploader (or school administrator); saving them to the bank remains an explicit action creating drafts.

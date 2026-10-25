# Role and class navigation implementation

Approved by user: choose student/teacher before login; teacher navigation has Overview, Classes, Exams & Questions; results live inside each class.

- [x] Test expected login role before issuing sessions; test class filtering and access for assignments/appeals.
- [x] Add role-first login, filter sample accounts by selected role, retain parent/admin entry and existing authenticated sessions.
- [x] Add class workspace: Students, Assigned work, Results, Settings. Results contain assignment scores, analysis, period reports and appeals, restricted to current class.
- [x] Group exam/question workflows into a hub; keep old deep links. Put account menu in header; teacher main navigation has three entries.
- [x] Verify API tests, full check, desktop/mobile browser flows; independent code review; commit.

Use the current branch and existing React/Node stack. Role selection is checked against the authenticated account; it does not grant permissions. No production data changes during verification.

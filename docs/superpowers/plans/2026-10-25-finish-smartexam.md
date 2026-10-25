# Finish SmartExam Implementation Plan

> **For agentic workers:** use the dispatching-parallel-agents skill for the independent report, family and PWA modules; integrate and review in this session.

**Goal:** Hoàn thiện các phần còn thiếu trong bàn giao Claude thành luồng sử dụng có giao diện và kiểm thử.
**Architecture:** React/Vite + Node HTTP + SQLite hiện có. Module máy chủ mới đăng ký vào router qua hàm register, UI dùng kit hiện tại.
**Tech Stack:** React 18, TypeScript, node:test, node:sqlite, Vite.
**Spec:** docs/superpowers/specs/2026-10-25-finish-design.md

## Global Constraints
- Giữ dữ liệu cũ và phân quyền theo trường/lớp; không gửi thông tin ra dịch vụ ngoài.
- API không được cache bởi service worker. Không đưa lời giải/đáp án chưa công bố vào cổng phụ huynh.
- Giữ đủ luồng hiện có; không thay thư viện hay framework.

## Review Focus
- Giáo viên lớp khác và trường khác không được đọc báo cáo/cấp mã phụ huynh.
- Số liệu kỳ không đếm lặp các em và không bao gồm bài đang làm.
- Mã phụ huynh đổi/thu hồi làm phiên cũ mất quyền ngay.
- Chính sách hai người không thể bị vượt qua bằng sửa/khôi phục/bulk.
- Điện thoại có thể tới mọi trang và không tràn điều hướng.

## Tasks
- [x] 1. Reports: tests RED; server/reports.mjs, src/pages/teacher/PeriodicReports.tsx; khoảng ngày, so sánh, lịch tuần/tháng, Excel, tests GREEN.
- [x] 2. Family: tests RED; server/family.mjs, src/pages/Family.tsx và src/ui/FamilyAccess.tsx; cấp/thu hồi mã, phiên đọc riêng, kết quả đã công bố, tests GREEN.
- [x] 3. PWA: public manifest/icons/sw/offline, src/ui/InstallApp.tsx, tests; root nối registration và cache headers; tests GREEN.
- [x] 4. Sharing UI: Exams, Comments, Bank, ReviewSettings, metadata API; hoàn thiện duyệt hai người và kiểm thử các đường sửa/khôi phục.
- [x] 5. Daily UI: phiên bản câu hỏi, mẫu ma trận, mã đề, thao tác gia hạn/mở lại/sửa điểm, khiếu nại học sinh.
- [x] 6. Polish/integration: App routes, mobile menu, typography/contrast, review async states, browse desktop/mobile, full npm run check; independent review and fixes; update docs.

## Progress
Baseline: 140/140 tests, typecheck/build passed. Branch codex/finish-smartexam; existing checkout reused, no production data edits.

Verification: npm run check passed 173/173 tests, TypeScript and build. Independent review complete; four findings fixed with RED/GREEN regression tests. Added cross-period submissions and snapshot grace-window tests. Desktop/mobile browser flows verified on an in-memory demo.
Ruling: retain changes on codex/finish-smartexam without publishing; reuse the current checkout. Existing framework, data and local hosting remain. Reporting cohorts include assignments opening, closing or receiving submissions in period so long assignments are counted correctly.

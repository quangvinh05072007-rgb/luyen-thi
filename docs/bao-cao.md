# Báo cáo bản 0.1 — 19/10/2026

## 1. Đã làm

**Vòng lát cắt dọc chạy được đầu-cuối trong trình duyệt:**
nhập đề → gắn nhãn → duyệt → sinh đề → giao → thi online → chấm → chẩn đoán → luyện lại.

| Khối | Nội dung |
|---|---|
| Nhập đề | Dán văn bản; Word .docx (đọc Equation OMML thành LaTeX, đáp án gạch chân/tô đỏ/tô nền, bảng đáp án cuối đề kể cả dạng bảng hai hàng); PDF có lớp chữ; Excel .xlsx / CSV theo mẫu; ảnh qua AI (khi có khóa). Báo rõ khi gặp .doc, PDF scan, MathType OLE, hình. |
| Gắn nhãn | 23 chuyên đề Toán 10–12 (GDPT 2018), mức Biết/Hiểu/Vận dụng, độ tin cậy; câu tin cậy thấp được tô "cần xem". |
| Ngân hàng | Lọc theo trạng thái, loại, chuyên đề, nguồn, mức độ; sửa có xem trước KaTeX; gắn kiểu lỗi cho từng phương án nhiễu; duyệt hàng loạt (máy chủ chặn câu thiếu thông tin); nhãn nguồn Official / Teacher Bank / Imported / AI Generated / AI Modified; thống kê lượt làm, tỉ lệ đúng từng câu. |
| Ra đề | Mẫu "Đề tốt nghiệp chuẩn 12/4/6", 45 phút, 15 phút, tùy chỉnh; tỉ lệ mức độ; lọc chuyên đề; tránh câu của 5 đề gần nhất; ma trận đề; đổi từng câu; báo thiếu câu trung thực; đề được "chụp" lại khi lưu nên sửa ngân hàng sau không làm đổi đề đã giao. |
| Mã đề | Đảo câu trong từng phần và đảo phương án, theo hạt giống; mỗi học sinh một bản riêng khi thi online. |
| Xuất Word | Mọi mã đề + bảng đáp án (tùy chọn kèm lời giải), công thức là Equation thật. |
| Giao đề | Thi online có giờ hoặc bài tập về nhà; giờ mở/đóng; cho xem điểm ngay hoặc sau khi đóng bài. |
| Phòng thi | Đồng hồ theo giờ máy chủ; lưu vào máy ngay mỗi lần chọn + đồng bộ lên máy chủ (đánh số phiên bản, bản cũ không đè bản mới); mất mạng vẫn làm tiếp; có mạng lại tự gửi; nộp thử lại nhiều lần; hết giờ máy chủ tự chốt bằng bản lưu cuối; bản làm lúc mất mạng gửi muộn được giữ riêng để giáo viên quyết định có tính hay không; nộp lặp không sinh bài trùng. |
| Chấm | Đúng quy chế 2025 (Phần II: 0,1 / 0,25 / 0,5 / 1); trả lời ngắn nhận dấu phẩy, dấu trừ unicode, phân số, nhiều đáp án; đề rút gọn quy về thang 10. |
| Chẩn đoán | Mỗi câu sai → chuyên đề + kiểu lỗi (khái niệm, công thức, biến đổi, bất cẩn) từ nhãn phương án nhiễu, đáp án sai đã biết, quy tắc (sai dấu, lệch 10ⁿ, làm tròn sai, làm quá nhanh), mặc định theo mức độ. |
| Năng lực, luyện lại | Năng lực theo chuyên đề (trung bình có trọng số mức độ, giảm dần theo thời gian, có tiên nghiệm); gợi ý 8 câu đúng mức; luyện tập chấm từng câu có lời giải; sổ lỗi sai nhắc ôn 1–3–7–14–30 ngày. |
| Giáo viên | Tổng quan với "việc nên làm" (dạy lại chuyên đề, kèm riêng em nào); báo cáo bài giao: phổ điểm, điểm từng phần, kiểu lỗi, phân tích câu hỏi (tỉ lệ điểm, độ phân biệt 27%, phương án bị chọn, cờ nghi sai đáp án); bản đồ nhiệt học sinh × chuyên đề; hồ sơ học sinh; xem bài làm kèm tín hiệu bất thường. |
| Học sinh | Trang "Hôm nay" một hành động chính; chuỗi ngày, XP, mục tiêu 10 câu/ngày; mascot gốc "Cú Pi" (vẽ SVG riêng). |
| Quản lý | Chất lượng theo khối/lớp/giáo viên, tỉ lệ tham gia, chuyên đề yếu toàn trường, thành phần ngân hàng; quản lý lớp, tài khoản, mật khẩu tạm; nhật ký thao tác. |
| Bảo mật | Mật khẩu scrypt; cookie HttpOnly SameSite; khóa đăng nhập sau 5 lần sai; chặn yêu cầu ghi không phải JSON (chống CSRF); mọi truy vấn lọc theo trường từ phiên; phân quyền ở từng API; học sinh không nhận đáp án/lời giải khi đang thi; chỉ lưu tên hiển thị + tên đăng nhập của học sinh; ghi nhật ký cả việc xem hồ sơ/bài làm học sinh. |

## 2. Kiểm thử đã chạy thật

`npm run check` → kiểm tra kiểu TypeScript sạch, **47/47 test đạt**, build thành công (chạy lúc 19/10/2026 trên Windows 11, Node 24.21).

| File test | Nội dung |
|---|---|
| `grading.test.mjs` | Thang Phần II từng mức, chuẩn hóa trả lời ngắn, đề đủ 22 câu = 10 điểm, bài lẻ 7,85, quy về thang 10 |
| `generate.test.mjs` | Đúng 12/4/6, tỉ lệ mức độ 5/4/3, tái lập theo hạt giống, chỉ câu đã duyệt, báo thiếu, lọc chuyên đề, tránh câu cũ, mã đề đổi đáp án đúng |
| `diagnose.test.mjs` | Kiểu lỗi từ phương án nhiễu/quy tắc/thời gian, năng lực, sổ lỗi sai, chọn câu luyện tập, phân loại chuyên đề ("học sinh" không bị nhầm là sin) |
| `import.test.mjs` | Tách đề theo phần, đáp án dấu *, [[OK]], dòng Đáp án, bảng đáp án hai hàng và theo phần, "A." trong đề bài không bị nhầm; Excel/CSV mẫu |
| `word.test.mjs` | LaTeX → OMML (thẻ cân bằng cho toàn bộ công thức mẫu), đi vòng OMML → LaTeX, xuất rồi đọc lại đề, đọc phương án gạch chân, **file đề soạn bằng Microsoft Word thật** |
| `api.test.mjs` | Qua HTTP: đăng nhập/khóa, nhập → duyệt (chặn câu thiếu đáp án), câu nháp không vào đề, sinh/lưu/xuất Word, giao chỉ lớp mình, đề không lộ đáp án, cách ly lớp và trường, lưu theo phiên bản, hết giờ khi mất mạng → tự chốt + bản muộn chờ duyệt → giáo viên nhận và chấm lại, nộp lặp, chẩn đoán, luyện tập, báo cáo, quản lý, nhật ký, CSRF, AI tắt |

**Kiểm tra bằng Microsoft Word trên máy:** file xuất toàn bộ 64 câu mẫu mở được trong Word, Word đếm **505 Equation** (OMaths), 12 trang; đã xem ảnh trang 1 — phân số, tích phân, lôgarit hiển thị đúng. Lỗi tìm được và đã sửa: `\big|` bị in thành chữ "big".

**Dùng thử trong trình duyệt (browser pane):**
- Học sinh: trang Hôm nay → bắt đầu thi → chọn đáp án (lưu lên máy chủ) → giả lập mất mạng (chặn fetch): chip báo "Mất mạng · đã lưu trên máy", vẫn làm tiếp → có mạng lại: tự đồng bộ, máy chủ có đủ câu trả lời → nộp → trang kết quả: điểm từng phần, kiểu lỗi (đáp số −4 thay vì 4 được nhận là "Bất cẩn"; phương án C nhận đúng nhãn "Lấy hệ số tự do làm thành phần") → "Luyện lại phần yếu" → kiểm tra từng câu có lời giải.
- Giáo viên: tổng quan có "việc nên làm" → nhập đề dán → tách 3 câu, đoán chuyên đề → lưu → duyệt → ra đề chuẩn (hiện cảnh báo dùng lại câu cũ khi ngân hàng mẫu hết câu mới) → lưu → giao 12A1 → báo cáo bài giữa kì: phổ điểm, kiểu lỗi, phân tích câu hỏi.
- Quản lý: trang toàn trường. Giao diện điện thoại (375 px): trang học sinh hiển thị đúng, thanh điều hướng dưới.
- Lỗi tìm được và đã sửa: lời giải bị căn phải do trùng tên lớp CSS.

**Chưa kiểm thử thật:** chức năng AI (không có khóa trong máy này — chỉ kiểm tra được nhánh "AI tắt" trả lỗi hướng dẫn); nhập PDF bằng file PDF thật (mã có, chưa có file mẫu để thử); nhập .xlsx thật (đã test CSV cùng bộ đọc hàng; bộ đọc .xlsx chưa chạy với file Excel thật); tải file trong trình duyệt (đã test bằng API, không bấm tải trong browser pane); nhiều người thi đồng thời / tải lớn; trình duyệt Safari/iOS.

## 3. Cái gì là khung, cái gì là định hướng

- **Khung (có mã, cần khóa hoặc dữ liệu để chạy):** AI đọc ảnh đề, sinh câu tương tự, viết lời giải.
- **Dữ liệu mẫu:** trường mẫu, 64 câu do SmartExam soạn (đã kiểm đáp án bằng tay, **không phải** đề của Bộ), các bài "(mô phỏng)" có điểm sinh từ mô hình năng lực giả định. Đều ghi nhãn trên giao diện.
- **Định hướng:** xem mục 5.

## 4. Giới hạn còn lại

1. Hình vẽ trong đề Word/PDF chưa nhập được (đánh dấu `[hình]` để giáo viên bổ sung); câu hỏi chưa có ô chèn hình.
2. Công thức MathType dạng OLE và PDF scan chưa đọc được nếu không có AI.
3. Phân loại chuyên đề dựa trên từ khóa: tốt với đề có thuật ngữ rõ, kém với câu ngắn; giáo viên phải xem lại câu "cần xem".
4. Chống gian lận chỉ là tín hiệu (rời tab, dán, máy thứ hai, mất mạng); không có chế độ khóa máy.
5. Năng lực là ước lượng đơn giản, chưa phải IRT; ngưỡng yếu/khá/vững là giả định, chưa hiệu chỉnh bằng dữ liệu thật.
6. Một máy chủ, một file SQLite: phù hợp một trường; chưa thử tải hàng nghìn học sinh cùng lúc; chưa có sao lưu tự động.
7. Chưa có đăng nhập SSO, nhập danh sách học sinh hàng loạt, thông báo cho phụ huynh.

## 5. Năm việc nên làm tiếp

1. **Hình trong câu hỏi:** nhập ảnh từ docx (word/media), ô chèn/vẽ hình trong trình soạn, xuất hình vào Word.
2. **Kiểm thử tải phòng thi:** giả lập 500–1000 học sinh nộp cùng lúc, đo độ trễ lưu; thêm sao lưu SQLite định kỳ.
3. **Nhập danh sách lớp hàng loạt** từ Excel và in phiếu tài khoản; SSO nếu Sở có.
4. **Hiệu chỉnh mô hình năng lực** bằng dữ liệu thật (IRT 2 tham số cho câu đủ lượt làm), dùng độ khó thật để sinh đề.
5. **Chạy thử AI với khóa thật** và đo chất lượng: tỉ lệ câu AI tạo được giáo viên duyệt không sửa, độ chính xác đọc ảnh đề.

## 6. Bản 0.2 — sẵn sàng dùng (19/10/2026)

- Thiết lập lần đầu trên trình duyệt: tạo trường thật + tài khoản quản lý (tùy chọn kèm 64 câu mẫu), hoặc trường mẫu. Không còn tự tạo trường mẫu; trang đăng nhập chỉ hiện tài khoản mẫu khi đang chạy trường mẫu.
- Nhập danh sách học sinh/giáo viên hàng loạt (dán từ Excel, bỏ qua dòng tiêu đề và cột STT, tự tạo lớp, tên đăng nhập không trùng), in phiếu tài khoản, tải CSV.
- Sao lưu tự động (khởi động + mỗi 6 giờ, giữ 14 bản) bằng `VACUUM INTO`, nút sao lưu ngay; `npm run reset` chép bản cũ trước khi xóa.
- Máy chủ in địa chỉ mạng LAN; phiếu tài khoản và trang giao đề ghi địa chỉ đó cho học sinh.
- `Chay SmartExam.bat`: bấm đúp để cài, build, chạy và mở trình duyệt.

Kiểm thử: `npm run check` → **50/50 test đạt** (thêm `tests/setup.test.mjs`: thiết lập, nhập hàng loạt, sao lưu đọc lại được). Dùng thử trong trình duyệt: màn hình thiết lập → "Dùng trường mẫu" → nhập danh sách 2 học sinh có dòng tiêu đề → phiếu tài khoản hiện đúng.
Chưa thử: học sinh truy cập thật từ máy khác qua mạng LAN (phụ thuộc tường lửa Windows của máy chủ); bấm đúp file `.bat` trên máy chưa cài thư viện.

## 7. Bản 0.3 — Nâng cấp 1: nhiều mã đề (25/10/2026)

**Đã làm (có test):**
- `makeVariants(items, n, seed)` sinh 1–8 mã (101…108); layout từng mã được **lưu bền** trong `exams.variants_json`; đề cũ chưa có layout vẫn xuất như trước (sinh lại từ seed cũ).
- Chùm dữ kiện: cột mới `questions.group_id` (nhận qua POST/PUT câu hỏi, kèm vào `items` của đề). Câu cùng nhóm và cùng phần luôn liền nhau, giữ thứ tự gốc. Chưa có ô nhập nhóm trên giao diện và nhập Word chưa tự nhận chùm.
- Chia mã: `assignVariants` (ngẫu nhiên đều theo seed, hoặc theo danh sách `variantList`; em ngoài danh sách chia đều phần còn lại). `POST /api/assignments` nhận `variantMode`, `variantList`, `variantSeed`; lưu `assignments.variant_map_json`; `attempts.variant_code` ghi mã đã thi. Thay đổi hành vi: trước đây mỗi học sinh một bản đảo riêng, nay thi theo đúng mã in trong Word.
- API mới: `GET /api/exams/:id/answer-key` (đáp án chéo), `GET /api/assignments/:id/variants` (mã của từng em, chỉ giáo viên phụ trách lớp).
- Word: thêm trang "Bảng đáp án chéo giữa các mã đề"; công thức OMML không đổi.
- Di trú `migrate()` trong `server/db.mjs`: thêm 4 cột vào CSDL cũ, chạy lại an toàn.
- Test mới `tests/variants.test.mjs` (8 test): cùng seed → cùng kết quả, chùm liền nhau, đáp án đúng sau đảo, cùng lựa chọn → cùng điểm ở 8 mã, đáp án chéo khớp, chia mã, di trú, luồng HTTP đầu-cuối.

**Chưa làm / chưa kiểm thử:**
- Giao diện: chưa có ô chọn chế độ chia mã / nhập nhóm câu (API sẵn sàng). Chưa kiểm thử mở file Word có bảng chéo bằng Microsoft Word thật (chỉ kiểm tra XML).
- Bài giao cũ không có bảng chia mã: em vào lớp muộn được chia theo băm cố định.
- Dữ liệu mẫu (`seed.mjs`) vẫn dùng layout riêng từng em, không có `variant_code`.

## 8. Bản 0.3 — Nâng cấp 2: ôn tập giãn cách (25/10/2026)

**Đã làm (có test):**
- `shared/spaced.mjs` — hàm thuần `scheduleReview(trạng thái, đúng/sai, thời điểm)` → `{state, action}`; ngày tính theo lịch Asia/Ho_Chi_Minh (ranh giới 17:00 UTC). Bậc 1–3–7–14–30 ngày; sai → về bậc đầu (hẹn 1 ngày, tính `lapses`); đúng → lên bậc; đúng ở bậc cuối → ra khỏi sổ.
- Không ôn hai lần một câu trong một ngày (`skip`). Quy tắc thêm: làm đúng khi chưa đến hạn thì không lên bậc (`early`), tránh lên bậc bằng cách làm lại mỗi ngày; làm sai thì luôn về bậc đầu.
- Cột `review_items.due_day`, `last_day`; mục cũ được suy ra `due_day` từ `due_at` (test di trú).
- API: `GET /api/student/review/due` (đến hạn hôm nay, chỉ của chính em, kèm số ngày quá hạn), `GET /api/teacher/review-stats[?classId]` (mỗi lớp mình phụ trách: số em có câu quá hạn, từng em đến hạn/quá hạn/quá hạn lâu nhất; quản lý xem cả trường).
- Chế độ luyện tập "ôn lại" và số câu đến hạn trong hồ sơ dùng `due_day`.
- Test mới `tests/spaced.test.mjs` (8 test).

**Chưa làm / lưu ý:** giao diện chưa hiển thị thống kê quá hạn cho giáo viên. `updateReview` cũ trong `shared/diagnose.mjs` không còn được dùng ở máy chủ (giữ lại vì test cũ). Chưa kiểm thử giờ mùa hè (Việt Nam không có).

## 9. Bản 0.3 — Nâng cấp 3: nhật ký và kiểm soát quyền (25/10/2026)

**Đã làm (có test, `tests/audit.test.mjs`, 9 test):**
- `audit_log` thêm cột `target`, `old_json`, `new_json`, `reason`, `outcome` (`ok` | `denied`); di trú an toàn cho nhật ký cũ (test). **Chỉ thêm**: trigger SQLite chặn UPDATE/DELETE, API không có đường sửa/xóa (404).
- Thao tác nhạy cảm, mỗi lần thành công đúng **một** dòng (ai, lúc nào, đối tượng, giá trị cũ/mới, lý do):
  - mở lại lượt thi `POST /api/attempts/:id/reopen` (lý do bắt buộc ≥ 5 ký tự; xóa bằng chứng cũ của lượt, đặt hạn mới);
  - sửa điểm `POST /api/attempts/:id/score` (lý do bắt buộc, điểm 0–10);
  - gia hạn bài giao `POST /api/assignments/:id/extend` và bài làm `POST /api/attempts/:id/extend`;
  - xóa câu `DELETE /api/questions/:id` (xóa mềm → lưu trữ, lý do bắt buộc);
  - đổi đáp án câu **đã dùng** (đã có bằng chứng hoặc nằm trong đề) qua `PUT /api/questions/:id` — lý do bắt buộc; đổi chỗ khác chỉ là `question_edit`;
  - xuất dữ liệu: `GET /api/assignments/:id/export.csv` (điểm theo lớp) và xuất Word đề;
  - đặt lại mật khẩu (không ghi mật khẩu vào nhật ký); nhận bài nộp muộn có điểm cũ/mới.
- Quyền kiểm tra ở API: giáo viên chỉ tác động lên lớp mình phụ trách; sửa/xóa/đổi đáp án câu chỉ người tạo hoặc quản lý; thao tác chéo trường bị chặn. Mọi lần bị từ chối ghi một dòng `outcome = denied` vào nhật ký của trường người thử (sai vai trò: dòng `denied` kèm đường dẫn API; sai đối tượng: dòng theo tên thao tác). Việc "ẩn câu" hàng loạt giờ cũng cần là người tạo/quản lý.
- `GET /api/admin/audit` (chỉ quản lý) thêm bộ lọc `action`, `outcome`, `beforeId` và trả đủ cột mới; chỉ thấy trường mình. Nhãn tiếng Việt cho các thao tác mới trong `Admin.tsx`.

**Chưa làm / hạn chế:**
- Giao diện chưa có nút mở lại / sửa điểm / gia hạn / xuất CSV / ô nhập lý do (API sẵn sàng).
- Mở lại lượt thi không hoàn tác XP, chuỗi ngày và lịch ôn đã tính từ lần nộp trước.
- Yêu cầu sai dữ liệu (thiếu lý do, điểm ngoài thang) trả 400 và không ghi nhật ký; yêu cầu chưa đăng nhập không ghi.
- Các thao tác cũ (đăng nhập, tạo đề…) vẫn ghi như trước, chưa có giá trị cũ/mới. Giáo viên chưa có trang xem nhật ký của riêng mình.

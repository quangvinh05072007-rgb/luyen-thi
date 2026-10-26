# Bàn giao SmartExam cho Antigravity — 26/10/2026

## Yêu cầu của chủ dự án

Tiếp tục công việc đang dang dở trong `C:\Users\LEGION\Documents\SmartExam-AI`. Chủ dự án đã yêu cầu chuyển việc sang Antigravity. Giữ toàn bộ chức năng, dữ liệu và thay đổi hiện có. Không reset Git, seed/reset dữ liệu thật, xóa file hoặc viết lại app từ đầu.

Giao diện cần nhỏ gọn, ít chữ, theo mẫu Azota: thanh điều hướng xanh cobalt, nền nhạt, icon SVG đồng bộ, giảm thẻ và khoảng trống thừa. Rà tên chức năng, nhất là nhập đề → ngân hàng → tạo đề → giao bài → học sinh làm bài.

Người dùng đã yêu cầu triển khai roadmap nâng cấp: OCR công thức, soạn câu hỏi trực quan, nhập đề chạy nền, màn đối chiếu, ngân hàng thông minh, kiểm chứng Toán, thi giấy, cộng tác, phân quyền và kiểm thử vận hành. Triển khai có chọn lọc nhưng phải có chức năng thực tế và kiểm chứng; không xem việc cài thư viện là hoàn thành tính năng.

## Nền tảng và trạng thái

- React 18 / TypeScript / Vite; Node.js HTTP API, SQLite `node:sqlite`; chạy `npm run dev`, địa chỉ `http://localhost:4700`.
- Working tree có rất nhiều thay đổi chưa commit, bao gồm nhiều lượt UI/OCR trước đó. Giữ nguyên cả các file không liên quan, đặc biệt thư mục `character-library-upgrade/`.
- Máy chủ dev đã được khởi động và đang phục vụ app; **cần restart để nạp các thay đổi backend mới nhất**. Vite chỉ cập nhật frontend.
- `data/` là dữ liệu thật và runtime; `tmp-out/` là log/artifact thử nghiệm. Cả hai bị Git ignore. Không đưa runtime/model/database vào Git.
- Môi trường Codex Windows cần chạy máy chủ/kiểm thử HTTP ngoài sandbox nếu trình duyệt không kết nối được. Không tắt xác thực TLS.

## Đã có trước đợt nâng cấp này

- UI compact cho giáo viên, học sinh, quản trị, lớp học và trình tạo đề; responsive.
- Nhập Word đọc OMML, hình và bảng; KaTeX hiển thị công thức; xuất Word giữ ảnh và công thức LaTeX thành Equation.
- OCR scan bằng PDF.js + canvas + Tesseract tiếng Việt, giữ ảnh nguyên từng câu, công thức và hình. Câu OCR là nháp, bắt buộc duyệt.
- PDF của người dùng: `C:\Users\LEGION\Downloads\de-khao-sat-toan-12-lan-1-nam-2026-2027-lien-truong-thpt-bac-ninh.pdf`: 8 trang, 4 trang đề scan + phần lời giải có chữ, 22 câu = 12 trắc nghiệm + 4 đúng/sai + 6 trả lời ngắn, 24 ảnh do câu qua trang. Đáp án đọc từ kết luận rõ ràng trong lời giải. Không trộn A–D khi ảnh gốc đã in phương án.
- Đã có 22 câu scan nháp được lưu vào ngân hàng thật trong lượt trước; không nhập lại rồi tự duyệt hoặc nhân đôi chúng.

## Những thay đổi mới đã viết

### UI và tên chức năng

`src/flows.css`, `src/main.tsx`, `src/pages/teacher/Exams.tsx`, `Import.tsx`, `Library.tsx`, các trang học sinh:

- Kho đề có thống kê nhỏ, tìm kiếm không dấu và bộ lọc client giữ tổng số ổn định (`shared/exam-catalog.mjs`, 2 tests).
- Đổi “Nhập Word” thành “Nhập đề”; bỏ năm cố định, tên “AI” ở bài luyện thực chất dùng thuật toán; đồng bộ “Câu cần ôn”.
- Giao bài rõ hơn; chia sẻ/đánh giá thu gọn; xem phương án và đáp án trong nội dung đề; mô tả đúng giới hạn công thức scan khi xuất Word.
- Phòng làm bài phân biệt luyện tập và bài được giao; trạng thái lưu, danh sách câu có nhãn phần/câu; bỏ hiệu ứng nhảy quá mức. Đã thử chọn đáp án, reload thấy đáp án giữ lại, rồi bỏ đáp án thử để trả bài mẫu về ban đầu.

### Trình soạn

Đã cài từ npm: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-mathematics`, `mathlive`.

- `shared/editor-document.mjs`: chuyển qua lại giữa Tiptap JSON và định dạng chữ / `$LaTeX$` / `[[img:id]]` / bảng pipe hiện có. Không chuyển toàn bộ dữ liệu sang HTML không an toàn.
- `src/ui/RichField.tsx`: chỉnh trực quan công thức, chèn/sửa bảng, upload hình, undo, chuyển về LaTeX/chữ. Các lựa chọn và lời giải cũng dùng được.
- `src/ui/FormulaDialog.tsx`: MathLive, mẫu phân số/căn/lũy thừa/tích phân, fonts đóng gói cục bộ, không tải CDN.
- `src/ui/QuestionEditor.tsx`: pane ảnh gốc và nội dung sửa; desktop hai cột khi đủ rộng, mobile xếp dọc. `sourceStem` được giữ khi chuyển scan thành chữ.
- `source_stem` thêm bằng migration, có trong `toQuestion`, insert/update/version/restore ở `server/db.mjs`, `server/app.mjs`.
- Đã thử trên trình duyệt mở trình soạn và chèn `\frac{1}{2}` bằng MathLive, chuyển về mã LaTeX thấy được giữ đúng. Chưa kiểm tra kỹ toàn bộ thao tác bảng/hình, mobile và export sau sửa.

### Nhập đề chạy nền

- `server/import-jobs.mjs`: hàng đợi SQLite lưu input BLOB, result JSON, trạng thái/progress, retry/cancel; phục hồi running thành queued sau restart; một worker cục bộ. Không dùng BullMQ vì máy chưa có Redis.
- API `/api/import/jobs`, `/api/import/jobs/:id`, `.../cancel`, `.../retry`. Chỉ uploader hoặc admin cùng trường được xem/quản lý.
- `/api/import/save` nhận `jobId`, lưu idempotent: mở/lưu cùng tác vụ lần nữa trả IDs cũ, tránh tạo câu trùng.
- `/api/images` nhận PNG/JPG/WebP tối đa 5 MB, kiểm chữ ký, không nhận SVG/HTML.
- `src/ui/ImportJobsPanel.tsx`, `Import.tsx`: chọn nhiều file, tiến độ, mở lại kết quả, hủy/thử lại. Tối đa 10 file/lần, 25 MB/file, 10 tác vụ đang chờ/người.
- `server/importers.mjs` nhận options progress/signal, `server/pdf-ocr.mjs` báo tiến độ và kiểm tra hủy mỗi trang.
- `server/index.mjs` đã viết shutdown chờ đóng hàng đợi trước khi đóng DB; **chưa chạy thử shutdown cuối này**.
- `vite.config.ts` bỏ theo dõi `data/` và `tmp-out/`, tránh model/runtime làm reload trang đang sửa.
- Đã nhập hai file txt thử qua UI và thấy “Sẵn sàng kiểm tra”; rời trang rồi quay lại vẫn thấy tác vụ. UI hiện cũng có một tác vụ PDF Bắc Ninh sẵn sàng kiểm tra; không tự lưu thêm vào ngân hàng.
- **Còn thiếu:** persist thay đổi trong bản đang duyệt trước khi lưu ngân hàng. Kết quả OCR gốc được lưu, nhưng sửa preview rồi rời trang có thể mất phần sửa. Cần thêm lưu bản duyệt hoặc autosave có version chống ghi đè giữa các tab. Không quảng cáo đã giải quyết phần này.
- `ImportJobsPanel` mới hiển thị 10 tác vụ đầu trong danh sách 50; cân nhắc mở rộng/xem thêm. Polling vẫn chạy mỗi 2 giây khi trang mở; cần rà hiệu năng và lỗi mạng.

### Marker nâng cao — mới tích hợp, chưa kiểm chứng hết

- Đã tạo Python venv `data/ocr-runtime/`, cài **marker-pdf==1.10.1**, Surya 0.17.1, PyTorch 2.14.1 **CPU**, SymPy 1.14.0. Máy có RTX 5060 Laptop 8 GB nhưng chưa có PyTorch CUDA trong venv.
- Model tải trong `data/ocr-models/`. `tools/marker_extract.py` dùng Marker local, `force_ocr`, không LLM/cloud; giữ TLS verification và ghép Windows ROOT/CA vào bundle để tải model.
- Lưu ý giấy phép: Marker **1.10.1 là GPL**, trọng số có điều kiện riêng; khác với nhánh upstream mới Apache. Không quảng cáo mã/trọng số này là miễn phí vô điều kiện cho thương mại. Runtime tách riêng, không bundle vào frontend.
- Đã chạy thật trên `tmp-out/ocr-triangle-final.png`; kết quả `tmp-out/marker-triangle.json`, log `tmp-out/marker-probe.log`. Nhận được tiếng Việt và công thức tập hợp LaTeX nhưng bỏ sót hình và sai vài ký hiệu. CPU mất khoảng một phút cho riêng bước nhận chữ, tổng lâu hơn. Không đủ chứng minh nhận đúng toàn đề.
- `data/ocr-runtime/marker-ready.json` đã tạo để đánh dấu thử nghiệm local. Nó chứng minh chạy được trên một mẫu, không chứng minh đủ chất lượng sản xuất.
- `server/math-ocr.mjs`: bridge spawn Python riêng, timeout/cancel, parse kết quả, giữ source scan trong stem, đáp án để null yêu cầu duyệt.
- `POST /api/math-ocr`: nhận IDs ảnh cùng trường và loại câu; tạo job Marker trên hàng đợi hiện có, tối đa 3 ảnh/câu. `/api/meta` có `mathOcrAvailable`.
- `src/ui/MathOcrReview.tsx`: cửa sổ theo dõi job và xem gợi ý; “Chèn chữ, giữ ảnh gốc”. `QuestionEditor` mở nó từ pane ảnh gốc.
- `shared/generate.mjs`: vẫn khóa thứ tự A–D nếu ảnh gốc in phương án còn nằm trong stem dù OCR đã có chữ riêng. Có regression test.
- **Ưu tiên ngay:** restart backend, kiểm tra end-to-end API và UI Marker trên một câu gốc; kiểm tra render true/false (answer null) và source/diagram không mất; kiểm tra cancel/timeout, lỗi parser, không tự duyệt. Latest Marker API/UI chưa được chạy end-to-end.
- SymPy mới được cài, **chưa có tính năng kiểm chứng/chấm biểu thức sử dụng nó**.

## Bằng chứng kiểm tra và phần phải chạy tiếp

- Lần full `npm run check` gần nhất: **194/194 tests**, typecheck và build pass. Log: `tmp-out/import-workspace-check.log`. Lần này **trước một số thay đổi Marker/meta/shutdown/fixedOptions cuối**, không phải xác nhận toàn bộ HEAD hiện tại.
- Sau đó: `npm run typecheck` pass sau thêm `MathOcrReview`; tests targeted `pdf-ocr.test.mjs` + `math-ocr-result.test.mjs` **7/7 pass**. Đã red→green test mới khóa A–D sau OCR sửa được.
- `tests/editor-document.test.mjs`: 2 tests roundtrip; `tests/import-jobs.test.mjs`: 2 tests recover/progress/ownership/retry/cancel; `tests/import-jobs-api.test.mjs`: 2 tests API/ảnh/source/idempotent; `tests/math-ocr-result.test.mjs`: 1 mới. Với test fixedOptions thêm một, full suite hiện kỳ vọng khoảng 196 tests, phải chạy xác nhận.
- Chạy `node tools/verify-import.mjs "C:/Users/LEGION/Downloads/de-khao-sat-toan-12-lan-1-nam-2026-2027-lien-truong-thpt-bac-ninh.pdf"`: dùng DB tách riêng trong `tmp-out/`, không sửa trường thật. Đã xác nhận 22 câu (12/4/6), tiến độ 4 trang, 19 giây trên lần này, mở lại DB vẫn đủ kết quả. Log: `tmp-out/background-real-pdf.log`.
- Cần chạy lại `npm run check`, browser desktop/mobile, kiểm tra bảng/formula/image upload → save → load → version/restore → đề → xuất Word → học sinh xem đúng. Không nộp bài thi thật hoặc đổi điểm để thử.
- Công cụ chọn file trên browser automation từng treo gần 10 phút dù tác vụ vẫn chạy; tránh lặp lại không cần thiết. Test API/fixtures riêng nhanh hơn; UI chỉ cần xác nhận có thể mở kết quả.

## Thứ tự tiếp tục

1. Hoàn thiện và kiểm chứng những phần đang viết; sửa lỗi trước khi thêm feature mới. Rà job state races, shutdown, quyền trường, alias hydrate JSON, lưu source và answer-null.
2. Thêm lưu bản duyệt có revision, cảnh báo sửa chưa lưu; sửa queue list/polling, tiến độ Marker rõ hơn. Thêm test cho reopen edit và tránh lưu nhầm kết quả job.
3. Nâng màn đối chiếu: sửa ranh giới/crop, ghép câu qua trang, chọn giữ/chèn hình, đánh dấu công thức cần kiểm tra. Không đánh đồng giữ ảnh với OCR LaTeX chính xác.
4. Kiểm chứng Marker trên bộ đề Việt Nam, đo thiếu câu/sai công thức/gắn nhầm hình/thời gian. Thử PaddleOCR khi cần đối chứng; cân nhắc PyTorch CUDA sau kiểm tra phiên bản và VRAM.
5. Tìm gần trùng/semantic search, SymPy với miền xác định và parser an toàn (không `eval` chuỗi học sinh), OMR có mẫu phiếu và màn sửa; sau đó cộng tác/SSO/load/backup/observability. Các phần này chưa triển khai.

Tài liệu liên quan: `docs/ocr-and-upgrades.md`, `docs/superpowers/plans/2026-10-26-import-workspace.md`, `docs/superpowers/plans/2026-10-26-pdf-ocr.md`. Roadmap gốc người dùng dán ở `C:\Users\LEGION\.codex\attachments\f678c9f9-fd68-4143-abfd-d798d0dd82a4\Pasted text.txt`.

## Prompt để nhận việc

“Tiếp tục dự án SmartExam tại C:\Users\LEGION\Documents\SmartExam-AI. Đọc ANTIGRAVITY_HANDOFF.md và các quy định trong repo trước. Giữ mọi thay đổi và chức năng hiện có. Làm tiếp theo mục Thứ tự tiếp tục, ưu tiên hoàn thiện các phần đang dang dở và kiểm chứng thật trước khi mở rộng roadmap. Giao diện nhỏ gọn, icon đồng bộ, không tự reset dữ liệu hoặc nộp bài thi thật. Hãy bắt đầu thực hiện ngay.”

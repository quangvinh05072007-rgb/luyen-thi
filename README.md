# SmartExam AI

Nền tảng kiểm tra, đánh giá và học tập cá nhân hóa cho **Toán THPT** (GDPT 2018, cấu trúc đề tốt nghiệp từ 2025).
Giáo viên nhập đề không cần gõ lại, ra đề đúng ma trận, giao thi online, chấm tự động và biết từng em yếu ở đâu.
Học sinh thi, xem vì sao sai, luyện đúng phần còn yếu. Nhà trường theo dõi chất lượng theo khối, lớp, giáo viên.

## Chạy

Cần **Node.js 22.13 trở lên** (dùng SQLite có sẵn trong Node, không cần cài thêm gì). Đã chạy thử trên Windows 11, Node 24.

```bash
npm install
npm run build
npm start
```

Mở http://localhost:4700. Lần đầu chạy, máy tự tạo **trường mẫu** (dữ liệu mẫu, có ghi nhãn trên giao diện).
Tài khoản mẫu, mật khẩu chung `demo1234`:

| Vai trò | Tên đăng nhập | Ghi chú |
|---|---|---|
| Học sinh | `hs.an.nm` | Nguyễn Minh An, lớp 12A1 — có bài "Đề luyện thi tốt nghiệp số 1" đang mở |
| Giáo viên | `gv.lan` | Cô Lan, dạy 12A1 |
| Giáo viên | `gv.minh` | Thầy Minh, dạy 12A2 và 11B1 |
| Quản lý | `quanly` | Ban giám hiệu |
| Giáo viên trường khác | `gv.khac` | Để thấy dữ liệu tách theo trường |

Các lệnh khác:

- `npm run dev` — chế độ phát triển (API + Vite, một cổng 4700).
- `npm run check` — kiểm tra kiểu + toàn bộ test + build.
- `npm test` — chỉ chạy test.
- `npm run seed -- --reset` — xóa `data/smartexam.db` và tạo lại trường mẫu.

### Bật AI (tùy chọn)

Mọi chức năng chính chạy **không cần AI**. Để bật đọc đề từ ảnh, sinh câu tương tự, viết lời giải: tạo file `config.local.json`
(không đưa lên git):

```json
{ "ai": { "apiKey": "sk-ant-...", "model": "claude-sonnet-5-5" } }
```

hoặc đặt biến môi trường `ANTHROPIC_API_KEY`, rồi khởi động lại. Nội dung AI tạo luôn ở trạng thái **nháp**, nhãn
**AI Generated / AI Modified**, phải được giáo viên duyệt mới đến học sinh.

## Cấu trúc

```
shared/      Lõi thuần JavaScript, dùng chung máy chủ và trình duyệt, có test
  grading.mjs     chấm điểm theo quy chế 2025
  generate.mjs    sinh đề theo ma trận, tạo mã đề
  diagnose.mjs    chẩn đoán kiểu lỗi, năng lực theo chuyên đề, sổ lỗi sai, chọn câu luyện tập
  parse.mjs       tách câu từ văn bản đề
  classify.mjs    gắn chuyên đề, mức độ
  omml.mjs        LaTeX ↔ Equation của Word (OMML)
  docx.mjs        đọc/ghi .docx;  exportExam.mjs  xuất đề + đáp án
  sheet.mjs       nhập Excel/CSV;  topics.mjs  chuyên đề GDPT 2018
server/      API (http thuần), SQLite, phân quyền, nhật ký, AI tùy chọn, dữ liệu mẫu
src/         Giao diện React (giáo viên, học sinh, quản lý)
tests/       Test node:test (chấm, sinh đề, chẩn đoán, nhập, Word, luồng API đầu-cuối)
docs/        tam-nhin.md (tầm nhìn, tính năng, kiến trúc, lộ trình), bao-cao.md (báo cáo kiểm thử)
```

Định dạng đề dán/nhập: xem nút "Dùng đoạn mẫu" ở trang **Nhập đề**, và file Excel mẫu tải ở cùng trang.

# SmartExam AI

Nền tảng kiểm tra, đánh giá và học tập cá nhân hóa cho **Toán THPT** (GDPT 2018, cấu trúc đề tốt nghiệp từ 2025).
Giáo viên nhập đề không cần gõ lại, ra đề đúng ma trận, giao thi online, chấm tự động và biết từng em yếu ở đâu.
Học sinh thi, xem vì sao sai, luyện đúng phần còn yếu. Nhà trường theo dõi chất lượng theo khối, lớp, giáo viên.

## Chạy

Cần **Node.js 22.13 trở lên** (tải bản LTS ở nodejs.org). Không cần cài cơ sở dữ liệu hay công cụ build riêng.

**Cách nhanh nhất (Windows):** bấm đúp **`Chay SmartExam.bat`**. Lần đầu tự cài thư viện và build, rồi mở trình duyệt.
Giữ cửa sổ đen mở trong lúc dùng; đóng nó là tắt máy chủ.

Hoặc bằng dòng lệnh:

```bash
npm install
npm run build
npm start
```

### Lần đầu: thiết lập trường

Mở http://localhost:4700, chọn một trong hai:

- **Tạo trường của bạn**: tên trường, tài khoản quản lý (mật khẩu ít nhất 8 ký tự), tùy chọn thêm 64 câu hỏi mẫu đã duyệt để ra đề ngay.
- **Dùng trường mẫu**: có sẵn lớp, học sinh, bài thi mô phỏng để xem thử. Tài khoản mẫu `hs.an.nm`, `gv.lan`, `quanly`, mật khẩu `demo1234`.

Muốn làm lại từ đầu: tắt máy chủ, chạy `npm run reset` (dữ liệu cũ được chép vào `data/backups` trước khi xóa).

### Đưa vào dùng

1. Quản lý vào **Người dùng → Nhập danh sách**: dán từ Excel (họ tên, lớp). Lớp chưa có tự tạo. Máy sinh tên đăng nhập và mật khẩu tạm,
   có nút **In phiếu** và **Tải file CSV** để phát cho học sinh. Gán giáo viên cho từng lớp ngay trên trang đó.
2. Giáo viên **Nhập đề** (Word/PDF/Excel/dán), duyệt, **Ra đề**, **Giao** cho lớp.
3. Học sinh dùng máy/điện thoại **cùng mạng** mở địa chỉ máy chủ in trong cửa sổ đen, dạng `http://192.168.x.x:4700`
   (trang Giao đề và phiếu tài khoản cũng ghi địa chỉ này). Lần đầu Windows có thể hỏi cho phép Node.js qua tường lửa: chọn **Cho phép** với mạng riêng.

### Sao lưu

Máy tự sao lưu khi khởi động và mỗi 6 giờ vào `data/backups` (giữ 14 bản), có nút **Sao lưu ngay** ở trang Người dùng.
Chép thư mục `data/backups` ra ổ khác định kỳ. Khôi phục: tắt máy chủ, chép một bản sao lưu đè lên `data/smartexam.db`.

### Các chức năng đã hoàn thiện

- **Đề thi:** lọc kho riêng/chung/tổ, đánh giá sao và góp ý; mở đề để chia sẻ, xuất hoặc nhân bản. Khi giao, chọn thứ tự riêng từng em, chia đều ngẫu nhiên hoặc chỉ định mã theo danh sách.
- **Ngân hàng:** xem lịch sử, khôi phục và góp ý câu hỏi. Quản lý vào **Tài khoản → Duyệt câu hỏi** để chọn chính sách một/hai người duyệt. Với hai người, sửa nội dung, lời giải hoặc nhãn sẽ yêu cầu duyệt lại.
- **Ra đề → Mẫu ma trận:** lưu/dùng lại cấu trúc đề. **Kết quả:** lùi giờ đóng, gia hạn/mở lại lượt thi, sửa điểm tổng có lý do. Học sinh xem phản hồi ở **Khiếu nại**.
- **Báo cáo định kỳ:** chọn ngày Việt Nam và lớp, so sánh với kỳ trước, tải Excel hoặc lưu số liệu. Lịch tuần/tháng tạo báo cáo khi máy chủ chạy và tạo bù khi mở lại. Bài kết thúc sát nửa đêm được chờ hết ân hạn lưu trước khi đóng báo cáo. Trên điện thoại, các mục phụ nằm ở **Thêm**.

### Cổng phụ huynh

Giáo viên mở **Lớp → hồ sơ học sinh → Liên kết phụ huynh** để cấp mã có thời hạn. Sao chép mã và địa chỉ để gửi riêng cho gia đình; mã chỉ hiện trong lần cấp. Phụ huynh chọn **Dành cho phụ huynh** ở trang đăng nhập hoặc mở `/#/phu-huynh` để xem điểm đã công bố, tình hình nộp bài và gợi ý ôn tập của riêng con. Đổi/thu hồi mã làm mọi phiên cũ hết quyền ngay. Đây là tình hình nộp bài trên SmartExam, không phải điểm danh tại trường.

### Cài ứng dụng và mất mạng

Trình duyệt hỗ trợ có thể cài qua **Cài ứng dụng** hoặc **Thêm vào màn hình chính**. Service worker cần **HTTPS hoặc localhost**; địa chỉ IP LAN qua HTTP vẫn dùng được bằng trình duyệt. Chế độ ngoại tuyến không cache điểm, đề hay dữ liệu cá nhân. Nếu mất mạng khi thi, giữ trang bài làm đang mở để gửi lại dữ liệu khi có mạng. Bản cập nhật chỉ tải lại sau khi người dùng đồng ý.

### Lệnh hỗ trợ

- `npm run dev` — chế độ phát triển (API + Vite, một cổng 4700).
- `npm run check` — kiểm tra kiểu + toàn bộ test + build.
- `npm run seed -- --reset` — xóa dữ liệu và tạo ngay trường mẫu.

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

# SmartExam AI — Tầm nhìn, tính năng, kiến trúc, lộ trình

> Tài liệu viết trước khi code (ngày 19/10/2026). Phần "Trạng thái" ở cuối được cập nhật khi làm xong từng phần.

## 1. Tầm nhìn

SmartExam AI là nền tảng kiểm tra – đánh giá – học tập cá nhân hóa cho **Toán THPT Việt Nam** theo
chương trình GDPT 2018 và cấu trúc đề tốt nghiệp từ 2025:

| Phần | Số câu | Dạng | Điểm |
|---|---|---|---|
| I | 12 | Trắc nghiệm 4 lựa chọn | 0,25 điểm/câu → 3 điểm |
| II | 4 | Đúng/Sai, mỗi câu 4 ý | 1 ý đúng 0,1; 2 ý 0,25; 3 ý 0,5; 4 ý 1 → 4 điểm |
| III | 6 | Trả lời ngắn | 0,5 điểm/câu → 3 điểm |

Một câu nói gọn: **mỗi bài làm của học sinh phải trở thành một hành động học tiếp cụ thể.**
Không dừng ở con số 6,75 điểm, mà trả lời: em sai ở chuyên đề nào, sai kiểu gì (khái niệm, công thức,
biến đổi, bất cẩn), và ngày mai luyện đúng 8 câu nào.

Ba nhóm người dùng, ba lời hứa:

- **Giáo viên** — không gõ lại đề: dán/tải Word, PDF, Excel (ảnh qua AI nếu có khóa) → máy tách câu,
  đoán chuyên đề và mức độ → giáo viên sửa, duyệt. Ra đề đúng cấu trúc trong một phút, nhiều mã đề,
  giao cho lớp, chấm tự động, biết từng em yếu ở đâu và cả lớp hổng chỗ nào.
- **Học sinh** — luyện đề, thi online, hiểu *vì sao* sai (lời giải + kiểu lỗi), có nhiệm vụ mỗi ngày
  vừa sức, sổ lỗi sai tự nhắc ôn lại, chuỗi ngày học để giữ nhịp.
- **Nhà trường** — chất lượng theo khối, lớp, giáo viên; nhật ký thao tác; dữ liệu tách theo trường.

Nguyên tắc:
1. **AI hỗ trợ, giáo viên quyết định.** Mọi câu hỏi mang nhãn nguồn: Official, Teacher Bank, Imported,
   AI Generated, AI Modified. Câu chưa duyệt không bao giờ đến tay học sinh (máy chủ chặn, không chỉ giao diện).
2. **Chạy được không cần AI.** Nhập đề, gắn nhãn, sinh đề, chấm, chẩn đoán đều là thuật toán chạy tại máy.
   AI (Claude) là lớp thêm: đọc ảnh đề, sinh câu tương tự, giải thích thêm — tắt khi chưa có khóa và nói rõ.
3. **Phòng thi đáng tin.** Đồng hồ do máy chủ giữ; lưu tự động; mất mạng vẫn làm tiếp, có mạng lại thì đồng bộ;
   nộp bài lặp lại không sinh bài trùng; hết giờ máy chủ tự chốt bài bằng bản lưu cuối.
4. **Bảo vệ học sinh dưới 18 tuổi.** Chỉ lưu tên hiển thị và tên đăng nhập; không email, không số điện thoại,
   không ngày sinh. Học sinh chỉ thấy dữ liệu của mình. Mọi truy vấn lọc theo trường ở máy chủ.

## 2. Danh sách tính năng

### Vòng lõi (lát cắt dọc — làm trước)
| # | Tính năng | Ghi chú |
|---|---|---|
| 1 | Nhập đề từ văn bản dán, Word (.docx, cả công thức Equation), PDF có lớp chữ, Excel/CSV theo mẫu | Bộ tách câu hiểu "Câu 1.", "A. B. C. D.", "a) b) c) d)", "PHẦN I/II/III", "Đáp án:", "Lời giải:" |
| 2 | Gắn nhãn tự động: chuyên đề GDPT 2018 (lớp 10–12), mức độ (Biết/Hiểu/Vận dụng), loại câu | Bộ phân loại từ khóa có trọng số, trả về độ tin cậy; giáo viên sửa |
| 3 | Ngân hàng câu hỏi: lọc, sửa, duyệt, nhãn nguồn, xem trước KaTeX | Câu nháp không vào đề |
| 4 | Sinh đề theo ma trận: đúng 12/4/6, phân bổ chuyên đề và mức độ, tránh câu vừa dùng | Báo thiếu câu trung thực thay vì lấp đầy bừa |
| 5 | Nhiều mã đề: đảo câu trong phần, đảo phương án (đáp án theo phương án gốc) | Theo hạt giống, tái lập được |
| 6 | Giao đề: thi (có giờ), bài tập về nhà, luyện tập; theo lớp; thời gian mở/đóng | |
| 7 | Phòng thi: đồng hồ máy chủ, lưu tự động, chịu mất mạng, nộp an toàn, chốt bài khi hết giờ | |
| 8 | Chấm tự động đúng quy chế 2025 (cả thang Phần II) | Có test |
| 9 | Chẩn đoán lỗi: mỗi câu sai → chuyên đề + kiểu lỗi (khái niệm/công thức/biến đổi/bất cẩn) | Từ nhãn phương án nhiễu + quy tắc (lệch dấu, lệch 10 lần, làm quá nhanh câu dễ) |
| 10 | Năng lực theo chuyên đề (làm mịn Bayes, trọng số mức độ, giảm dần theo thời gian) | |
| 11 | Luyện lại thích ứng: chọn chuyên đề yếu, mức độ vừa sức, ưu tiên câu từng sai | |

### Mở rộng (đã có trong bản này)
- **Sổ lỗi sai** tự động, nhắc ôn theo khoảng giãn cách (1–3–7–14 ngày) — học sinh nhớ lâu hơn làm lại ngay.
- **Phân tích câu hỏi** sau bài thi: tỉ lệ đúng, độ phân biệt (nhóm 27% trên/dưới), phương án nhiễu bị chọn nhiều
  — giúp giáo viên phát hiện câu lỗi đáp án hoặc câu quá dễ.
- **Bản đồ nhiệt lớp × chuyên đề** — giáo viên biết dạy lại phần nào cho cả lớp, phần nào kèm riêng.
- **Chống gian lận vừa đủ**: đảo đề theo từng em, ghi rời tab/thoát toàn màn hình/dán chữ, phát hiện mở bài
  trên hai máy; hiện cho giáo viên như *tín hiệu*, không tự kết tội.
- **Xuất Word** có công thức Equation thật (OMML) — đề và đáp án, mỗi mã đề.
- **Gamification vừa đủ**: chuỗi ngày học, điểm kinh nghiệm, nhiệm vụ trong ngày; mascot gốc "Cú Pi".
- **Bảng điều khiển nhà trường**: điểm trung bình, tỉ lệ tham gia theo khối/lớp/giáo viên.
- **Nhật ký thao tác** (đăng nhập, duyệt câu, giao đề, nộp bài, xuất dữ liệu).
- **AI (khi có khóa Claude)**: đọc đề từ ảnh, sinh câu tương tự (nhãn AI Generated, trạng thái nháp),
  viết lời giải (AI Modified). Không có khóa → nút nói rõ "Chưa cấu hình khóa AI".

### Định hướng (chưa làm)
- Đăng nhập SSO của Sở, đồng bộ danh sách lớp từ phần mềm quản lý trường.
- OCR ngoại tuyến cho ảnh/PDF scan (hiện cần AI).
- Ứng dụng di động gốc, chế độ thi khóa máy.
- IRT/CAT thật sự (ước lượng tham số câu từ dữ liệu lớn).

## 3. Kiến trúc

```
Trình duyệt (React + Vite + KaTeX)          Máy chủ Node 24 (http thuần, không framework)
  ├─ Giáo viên / Học sinh / Quản lý  ──JSON──▶ server/  router, phiên cookie HttpOnly, phân quyền
  ├─ Phòng thi: localStorage + hàng đợi        ├─ db.mjs  node:sqlite (file data/smartexam.db)
  │   đồng bộ khi có mạng                      ├─ AI: Claude qua fetch (tùy chọn)
  └─ shared/*.mjs (dùng chung) ◀────────────── └─ shared/*.mjs
       chấm điểm, sinh đề, chẩn đoán, tách câu, phân loại, LaTeX↔OMML, docx
```

- **Không phụ thuộc gốc C++**: CSDL dùng `node:sqlite` có sẵn trong Node 24 → cài trên Windows không cần build tools.
- **Logic dùng chung là JavaScript thuần** (`shared/`), test bằng `node:test`, cùng một mã chạy ở máy chủ và trình duyệt.
- **Tách trường**: mọi bảng có `school_id`; mọi truy vấn lấy `school_id` từ phiên, không từ yêu cầu.
- **Phân quyền**: `admin` (quản lý trường), `teacher`, `student`. Kiểm tra ở từng API.
- **Mật khẩu**: scrypt + muối; phiên ngẫu nhiên 32 byte, cookie HttpOnly SameSite=Lax.
- **Thời gian thi**: `deadline_at` ghi lúc bắt đầu = min(bắt đầu + thời lượng, giờ đóng). Bản lưu sau hạn + 30 giây ân hạn bị từ chối;
  bài quá hạn được chốt tự động bằng bản lưu cuối.

Mô hình dữ liệu (rút gọn): `schools, users, classes, questions, exams, assignments, attempts,
review_items (sổ lỗi sai), activity (chuỗi ngày, XP), audit_log, sessions`.

## 4. Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Tài liệu, khung dự án | xong |
| 1 | Lát cắt dọc: nhập → gắn nhãn → sinh đề → giao → thi → chấm → chẩn đoán → luyện lại | xong, đã kiểm thử (docs/bao-cao.md) |
| 2 | Phân tích câu hỏi, bản đồ nhiệt, sổ lỗi sai giãn cách, xuất Word OMML, quản lý trường | xong bản đầu |
| 3 | AI: ảnh → đề, sinh câu tương tự, lời giải | khung có, cần khóa để chạy |
| 4 | SSO, OCR ngoại tuyến, IRT, ứng dụng di động | định hướng |

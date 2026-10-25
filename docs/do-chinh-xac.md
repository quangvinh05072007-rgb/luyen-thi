# Độ chính xác nhập đề

Chạy lại: `npm run bench` (in bảng) — `npm test` giữ ngưỡng chặn lùi (`tests/bench.test.mjs`).

## Phải đọc trước khi tin các con số

- **Bộ chuẩn là 64 câu mẫu do SmartExam soạn**, được "in" ra 11 kiểu trình bày rồi nhập lại. Cả bộ in lẫn bộ nhập do cùng một nhóm viết và đã được chỉnh cho khớp nhau, nên **100% bên dưới nghĩa là "không còn lỗi đã biết trên bộ này", không phải "đúng 100% với đề thật"**.
- **Chưa có đề thật của trường/Bộ.** Khi có, đặt file và `<tên>.expected.json` (cùng định dạng câu: `type, stem, options, answer, topic`) vào `tests/bench/real/`; `npm run bench` sẽ chạy cùng cách và đó mới là con số đáng tin.
- Chuyên đề: 42 câu "để dành" (`tests/bench/heldout.mjs`) được soạn **sau khi đã chỉnh bộ phân loại**, nên lần đo đầu là ước lượng ngoài mẫu. Mẫu nhỏ (42 câu) nên sai số lớn.

## Hai chỉ số quan trọng nhất

1. **Đáp án sai** = máy trả đáp án khác bản chuẩn (giáo viên dễ tin). Mục tiêu: 0. Khi các nguồn đáp án mâu thuẫn, máy **để trống và báo**, không chọn bừa.
2. **Lỗi âm thầm** = câu nhập sai (đề, phương án hoặc đáp án) mà "độ đáng ngờ" vẫn ở mức thấp nên màn hình duyệt không cảnh báo. Mục tiêu: 0.

## Lần đo đầu tiên (trước khi sửa) — các lỗi thật bộ đo tìm ra

| Hiện tượng | Số liệu lần đầu |
|---|---|
| Đáp án sai | 0 / 704 |
| Đáp án thiếu (bảng đáp án cuối đề) | 18 / 704 — dạng viết liền "ĐSSĐ" không đọc được khi chữ cuối là Đ (`\b` của JavaScript không coi Đ là chữ) và "ĐSĐS" viết liền không đọc được |
| Word: đề khớp bản gốc | 43,8% — công thức Equation bị thêm dấu cách sau mỗi công thức ("$x$ ."), `6\%` mất dấu `\` thành `6%` (trong KaTeX `%` mở chú thích, làm hỏng công thức), `f'` thành `f\prime` |
| Lỗi âm thầm | 59 câu |
| Chuyên đề đoán đúng | 60,6%; **tin cậy ≥ 0,7 mà sai: 9,4%** — nguyên nhân chính: so khớp không dấu làm "mốt" trùng "một" nên mọi câu xác suất rơi vào Thống kê |

## Sau khi sửa (bản hiện tại)

| Kiểu trình bày | Câu | Tìm thấy | Loại đúng | Đề đúng | Phương án đúng | Đáp án đúng | Đáp án thiếu | Mâu thuẫn (để trống) | **Đáp án sai** | Câu có lỗi | Được cảnh báo | **Lỗi âm thầm** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Văn bản, đáp án đánh dấu * | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản, dòng "Đáp án: …" dưới từng câu | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản, chỉ có bảng đáp án cuối đề | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản, 4 phương án cùng một dòng + bảng đáp án | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản, đủ ba nguồn đáp án (* + dòng + bảng) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 1) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 2) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Văn bản lộn xộn (nhiễu ngẫu nhiên, hạt 3) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Word, đáp án tô màu đỏ (công thức Equation) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| Word, bảng đáp án cuối đề (công thức Equation) | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| CSV/Excel theo mẫu | 64 | 64 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |
| **Tổng** | 704 | 704 | 100% | 100% | 100% | 100% | 0 | 0 | **0** | 0 | 0 | **0** |


Chuyên đề (các kiểu không có cột chuyên đề, 640 câu): đoán đúng 99.7%, không đoán được 0%, **tin cậy ≥ 0,7 mà sai 0 câu (0%)**.
Bộ để dành (42 câu): đoán đúng 90.5%, không đoán được 3, tin cậy ≥ 0,7 mà sai 1. Sai: #4 T10.HTL → không đoán được (0); #10 T10.TOHOP → không đoán được (0); #23 T11.MULOG → không đoán được (0); #42 T12.XSDK → T11.XACSUAT (0.9)

Đã sửa: đọc "ĐSĐS" viết liền; khoảng trắng quanh công thức; thoát `%`, `#`, `$` trong công thức; `f'`; so khớp không dấu chỉ cho từ khóa dài; thêm luật ngữ cảnh cho chuyên đề (mẫu số liệu ghép nhóm, xác suất có điều kiện, tích phân diện tích, tọa độ không gian, hàm mũ/lôgarit, đạo hàm, quan hệ vuông góc, bài toán tối ưu). Độ tin cậy chuyên đề giờ thấp hơn khi nhiều chuyên đề cùng điểm.

## Bộ để dành — chuyên đề ngoài mẫu (lần đo đầu, chưa chỉnh theo bộ này)

Đoán đúng **38/42 (90,5%)**; không đoán được 3; **tin cậy ≥ 0,7 mà sai 1**. Các câu sai: tam giác dùng định lí côsin (không có từ khóa), bài đếm số có ba chữ số, rút gọn lũy thừa $a^{1/3}\cdot a^{2/3}$ (không đoán được); bài xác suất toàn phần về phân xưởng bị xếp vào Các quy tắc tính xác suất (tin cậy 0,9). **Bộ phân loại từ khóa có giới hạn thật**; giáo viên vẫn phải xem lại cột chuyên đề, câu nào "tin cậy thấp" đều được tô "cần xem".

## Những gì bộ đo chưa đo

- Đề Word do giáo viên thật soạn (kiểu gõ, font, bảng, hộp văn bản), PDF scan, ảnh chụp đề (cần AI).
- Hình vẽ khối của Word, biểu đồ Word, EMF/WMF: báo `[hình]`, không nhập.
- Mức độ (Biết/Hiểu/Vận dụng): đoán theo độ dài và từ khóa, chưa đo độ chính xác.
- PDF: chỉ kiểm thử một file do Word xuất (2 câu).

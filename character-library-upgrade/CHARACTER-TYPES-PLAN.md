# Nhân vật đa dạng

- Giữ nguyên renderer mặc định, font, màu và thư viện chỉ có tên.
- Thêm 8 mẫu: 3 bà cụ, 3 trẻ em, 2 người lớn khác vóc dáng.
- Tuỳ chỉnh độc lập: độ tuổi, khuôn mặt, vóc dáng, nét da; thêm kính.
- Biến đổi vóc dáng chung cho bốn góc và mọi động tác, neo chân vào cùng mặt đất. Đầu/tóc có tỉ lệ riêng theo tuổi, không ép nhỏ toàn bộ hình người lớn.
- Mặt gốc không đổi; các khuôn mặt mới có contour riêng trước/nghiêng và dùng chung lựa chọn mắt, môi.
- Khung ảnh thư viện và camera cận tự bám vị trí đầu, kể cả trẻ em thấp hơn.
- Bổ sung mẫu một lần vào dữ liệu đang lưu, không sửa nhân vật hiện có hoặc chọn thay nhân vật đang mở.
- Kiểm chứng: so SVG mặc định trước/sau, render đa góc/động tác, tính idempotent của migration, xem model sheet raster thật.

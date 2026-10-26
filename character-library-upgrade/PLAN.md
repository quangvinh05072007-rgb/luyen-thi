# Nâng cấp Kho nhân vật 2

Giữ giao diện kho, preset, màu, biểu cảm, nền, tìm kiếm, lưu và nhập/xuất cấu hình. Thay renderer cũ bằng toàn bộ động cơ của nhanvat_nu_v2: FK 57 đoạn, chuyển động, nội suy tư thế, lò xo tóc/vải. Chuyển 8 nhóm trang phục và 10 lựa chọn tóc thành các mẫu gắn với rig mới; thêm 4 mẫu sẵn có từ file nữ. Đầu và tỷ lệ cơ thể dùng file nữ v2. File gốc trong Downloads được giữ làm nguồn.

Hướng thực hiện: ghép renderer vào giao diện kho có sẵn, thay vì xây lại giao diện hoặc chỉ sao chép màu lên nhân vật cũ. Kết quả là một HTML chạy ngoại tuyến, không cần cài đặt. Bộ chỉnh khớp dùng thông số rig mới để nhất quán ở mọi góc nhìn. Xuất Remotion phải tính chuyển động theo frame.

- [x] Kiểm tra hành vi trên nguồn cũ để xác nhận giới hạn góc nhìn và renderer.
- [x] Tạo module rig từ nguồn nữ v2, thêm mẫu trang phục/tóc và ghép vào kho.
- [x] Đồng bộ camera, bộ chỉnh khớp, lưu và xuất SVG/Remotion với renderer mới.
- [x] Kiểm tra tổ hợp trang phục/tóc/góc nhìn và trang phục/động tác/góc nhìn, tạm dừng, lưu lại, xuất file; chụp ảnh và xem trực tiếp.

Kiểm tra trọng tâm: SVG không có NaN/Infinity hoặc ID trùng; trang phục khác nhau về hình dáng; tóc ngắn không còn đuôi tóc dài; mọi góc dùng cùng một tư thế; không đổi nhân vật khi đang tạm dừng; HTML không có phụ thuộc mạng; cấu hình được lưu và đọc lại.

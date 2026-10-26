# Đồng bộ nhân vật và bổ sung tuỳ chỉnh

Theo chỉ đạo cuối của người dùng: giữ nguyên khuôn mặt trước và nghiêng của bản cũ trong nhanvat_nu_v2.html. Không vẽ lại đầu. nativeHeadSel tiếp tục gọi khoFront ở trước và headArt ở nghiêng/sau; chỉ thay nội dung mắt trong đường bao mắt nghiêng gốc và ánh xạ biểu cảm môi sang góc nghiêng. Cùng kiểu, màu mắt và sắc thái môi cho mọi góc. Kiểm tra nguyên văn đường bao mặt gốc bằng verify-preserved-face.cjs. Giữ bộ khớp/chuyển động hiện có.

Yêu cầu thêm của người dùng: tự rà các mục thiếu, nhất là kiểu tay, bàn tay và màu. Bổ sung tư thế tay riêng, bàn tay trái/phải độc lập (có nắm tay, chỉ tay, chữ V), tay áo, màu quần/váy, giày, tất và phụ kiện. Mặc định theo trang phục/động tác, chỉ ghi đè khi chọn. Đưa trực tiếp vào tuỳ chỉnh, không bắt mở bộ khớp nâng cao. Giữ thư viện tên-only và font/màu cũ.

- [x] Xác nhận lỗi mắt/biểu cảm/phụ kiện bằng kiểm tra trước sửa.
- [x] Giữ nét mặt gốc, đồng bộ lựa chọn mắt/môi và bổ sung cấu hình tay/màu.
- [x] Nâng bảng tuỳ chỉnh, giữ dữ liệu qua lưu/đọc lại.
- [x] Kiểm tra số liệu, xem ảnh so sánh trước/nghiêng/sau và hồi quy toàn bộ.

# Hoàn thiện SmartExam AI

Yêu cầu: hoàn tất phần còn lại trong bàn giao Claude, trên React/Vite và Node/SQLite hiện có. Người dùng đã yêu cầu thực hiện; các lựa chọn thông thường do người triển khai quyết định.

## Phạm vi
- Giao diện chia sẻ đề riêng/chung, lọc tổ và xếp hạng, đánh giá sao, bình luận đề/câu hỏi, chính sách duyệt hai người và trạng thái chờ duyệt.
- Hoàn thiện giao diện còn thiếu cho lịch sử câu hỏi, mẫu ma trận, chọn chế độ mã đề và các thao tác bài làm đã có API.
- Báo cáo theo khoảng ngày, so sánh lớp và kỳ trước; cấu hình báo cáo tuần/tháng, lưu bản báo cáo đến hạn trong ứng dụng và tải Excel. Không gửi email hay dịch vụ ngoài.
- Cổng phụ huynh chỉ đọc qua mã liên kết do giáo viên/quản lý phát hành cho một học sinh; đổi mã thu hồi phiên cũ; không lộ đáp án, bài chưa công bố hoặc dữ liệu học sinh khác.
- PWA có manifest, biểu tượng, cài đặt khi trình duyệt hỗ trợ, giao diện ngoại tuyến. Không cache API/dữ liệu cá nhân; luồng lưu bài khi mất mạng hiện tại tiếp tục hoạt động.
- Giao diện sáng xanh, chữ tiếng Việt rõ, tăng tương phản, nhịp khoảng cách hợp lý; điều hướng điện thoại tối đa 5 mục, các mục phụ trong menu; responsive, focus bàn phím, giảm chuyển động, trạng thái trống/lỗi/đang gửi.

## Lựa chọn triển khai
Mở rộng ứng dụng hiện tại thay vì thay framework hay bổ sung dịch vụ ngoài: giữ cài đặt tại trường đơn giản và dữ liệu sẵn có. Chia các tính năng mới thành module máy chủ độc lập, dùng cùng router và phân quyền. Cổng phụ huynh dùng phiên riêng, không thêm quyền phụ huynh vào tài khoản học sinh.

## Xác nhận
Kiểm thử phân quyền và cách ly trường/lớp, khoảng ngày và số liệu báo cáo, mã phụ huynh hết hạn/thu hồi, cache ngoại tuyến; chạy npm run check và xem giao diện desktop/mobile. AI với khóa thật và thử nhiều thiết bị qua Wi-Fi vẫn cần môi trường thực tế.

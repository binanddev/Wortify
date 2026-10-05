# Quản trị Wortify

Workspace tại `/manage`, `/en/admin` hoặc `/de/admin`, dùng chung shell React và được tải riêng.

- Tổng quan: số tài khoản, trạng thái và nội dung gần đây.
- Người dùng: tìm kiếm, lọc vai trò/trạng thái, tạo/sửa, đặt lại mật khẩu, khóa/mở, thu hồi phiên, xóa có xác nhận và lý do. Admin cấp User/Staff/Admin; Staff chỉ quản lý tài khoản thường.
- Nội dung: lọc nguồn/ngôn ngữ/loại/trạng thái, tạo thư mục, lý thuyết và bài tập, upload media, xem trước, công bố/ẩn cây và xóa. Biên tập giữ nguyên chủ sở hữu. Version chống ghi đè bản đã được sửa.
- Nhật ký: Admin xem toàn bộ, Staff xem thao tác của mình.
- Hệ thống, giao diện chung và tài liệu API: chỉ Admin. Tài liệu có tìm kiếm endpoint, hướng dẫn session/CSRF, mẫu nghiệp vụ, tải Markdown và Postman Collection; không tự gửi request thử.

UserData hỗ trợ dữ liệu của tài khoản thường qua model được phép, phân trang 25 mục, tìm quan hệ bằng tên. Backend kiểm tra chủ sở hữu/ngôn ngữ; không sửa auth hoặc đường dẫn tệp tùy ý. Xóa toàn bộ dữ liệu giữ tài khoản, yêu cầu nhập username và thu hồi phiên.

Các modal ghi dữ liệu khóa đóng khi đang lưu, hiển thị lỗi trong ngữ cảnh và xác nhận trước thao tác phá hủy. Staff không thể nâng quyền bằng cách gọi API trực tiếp.

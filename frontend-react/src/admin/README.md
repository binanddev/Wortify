# Quản trị Wortify

Tất cả giao diện quản trị nằm trong `frontend-react/src/admin`, dùng chung shell và build React. Admin.jsx tải riêng tại `/en/admin`, `/de/admin` hoặc `/manage`. Appearance.jsx giữ trong Cài đặt, chỉ dành superuser.

Superuser có dashboard số người dùng/nội dung, trạng thái kết nối DB, migration chờ áp dụng, phiên bản runtime và nhật ký quản trị. Các chức năng học và tạo nội dung thông thường vẫn đầy đủ.

Staff quản lý tài khoản thường (tạo, sửa, đổi mật khẩu, khóa, thu hồi phiên, xóa). Không được đọc/sửa/xóa tài khoản staff hoặc superuser qua API quản trị, không tự nâng quyền và không sửa cấu hình hệ thống. Django admin mặc định vẫn dành superuser.

UserData quản lý dữ liệu theo từng tài khoản, phân trang 25 mục, xem/tạo/sửa/xóa qua danh sách model cho phép. Các quan hệ được kiểm tra quyền sở hữu; nội dung và cây dùng lại validator của hệ thống. Tệp âm thanh/hình ảnh cần upload qua công cụ Media, không tạo đường dẫn tệp tùy ý. Xóa toàn bộ dữ liệu giữ tài khoản và mật khẩu, yêu cầu nhập tên xác nhận, thu hồi phiên, ghi audit. Không có thao tác xóa thật nào chạy khi triển khai code này.

# Quản trị người dùng Wortify

`src/Admin.jsx` tải riêng từ ứng dụng React chính tại `/en/admin`, `/de/admin` hoặc `/manage`. Dùng chung shell, giao diện, dependencies và build.

Chỉ superuser: tìm kiếm, tạo/sửa, đổi role/mật khẩu, khóa, xóa tài khoản, thu hồi phiên đăng nhập và xem audit. Chặn tự khóa, xóa hoặc hạ quyền; password validation của Django, không ghi mật khẩu trong audit.

User và staff đều tạo/học nội dung trong Practice Hub và Flashcard. Không có quản trị Book/Chapter hoặc Content Studio cũ. `Appearance.jsx` quản lý nền toàn hệ thống trong Cài đặt của superuser.

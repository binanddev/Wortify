# Content Studio

Mã React quản trị nằm trong `src/Admin.jsx`, tải riêng từ ứng dụng chính tại `/manage`. Dùng chung providers, API client, thiết kế và build của `frontend-react` để tránh cài hai bộ dependencies.

API `/api/manage/` chỉ cho tài khoản active + superuser. Staff có quyền Django thông thường vẫn bị từ chối. Không cho tự khóa tài khoản. Đổi mật khẩu dùng Django password validation; nhật ký không ghi mật khẩu.

Tạo sách → Thêm chương / JSON → chọn nhiều tệp → xem trước → xác nhận. Không cần thư mục book/. Hướng dẫn và mẫu schema v1 nằm ngay trong giao diện; có thể tải mẫu từ API /api/manage/json-template/ hoặc docs/book-template-v1.json. Mỗi loại câu hỏi có kind riêng, đáp án và JSON gốc không được gửi đến API người học.


Media: chọn nhiều tệp → ghép tên / sửa đường dẫn đích / mô tả → xác nhận tải. Chỉ ảnh raster/audio; không nhận HTML/SVG/script. Upload kiểm tra kích thước, chữ ký định dạng, đường dẫn và quyền. Không giải nén ZIP. Tài nguyên cùng key được cập nhật; file cũ không tự xóa để tránh mất dữ liệu khi phục hồi.

Biên tập trực tuyến lưu database. JSON bổ sung cập nhật bài cùng mã trong chương cùng số, giữ các bài khác. Media được lưu riêng và không phụ thuộc tệp JSON gốc.

# Lernraum

Phần mềm học ngôn ngữ với **React 19 + HeroUI v2 + Tailwind CSS 4 + Framer Motion**, backend Django 5.2. Hai không gian English / Deutsch độc lập.

## Chạy trên Windows — dùng PowerShell

Mở Terminal **PowerShell**, dán đúng hai dòng sau. Không cần kích hoạt venv, không dùng lệnh Bash trong PowerShell:

```powershell
Set-Location -LiteralPath 'E:\code\bigmywweb'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Hoặc mở thư mục dự án rồi **nhấp đúp `start.cmd`**. Script kiểm tra Python/Node, cài thành phần thiếu, cập nhật database và bật web. Giữ cửa sổ terminal mở trong khi học; nhấn Ctrl+C để tắt cả hai dịch vụ.

- Trang học: http://127.0.0.1:5173
- Quản trị sách: http://127.0.0.1:5173/manage
- Dùng tài khoản đã có. Nếu database mới chưa có quản trị, mở terminal khác và chạy:

```powershell
Set-Location -LiteralPath 'E:\code\bigmywweb'
.\.venv\Scripts\python.exe -X utf8 manage.py createsuperuser
```

**Khi gặp lỗi:**

- “Port ... already in use”: dừng cửa sổ chạy web cũ bằng Ctrl+C trước khi chạy lại. Không mở hai lần.
- “Node.js is required”: cài Node.js 22.12 trở lên, rồi đóng/mở lại Terminal.
- “Python is required”: cài Python 3.12 trở lên, rồi đóng/mở lại Terminal.
- “running scripts is disabled”: dùng nguyên dòng `powershell.exe ...` ở trên, không chạy trực tiếp `./start.ps1`. `npm.cmd` đã được dùng trong script để tránh lỗi chính sách `npm.ps1`.
- Lần đầu cần Internet để tải thư viện. Nếu tải bị gián đoạn, chạy lại script; không tự xóa thư mục dự án.
- Không cần giữ `book/` hoặc `frontend/` để chạy. Sách mới được thêm bằng JSON trong quản trị.

## Git Bash / Linux / macOS

Trong **Bash**, tại thư mục dự án chạy `bash start.sh`. Đây là lựa chọn khác, không phải lệnh dành cho PowerShell. Cần Python 3.12+ và Node.js >=22.12.

## Chức năng

- Thư viện thẻ: thư mục, tìm kiếm, sắp xếp bộ, tạo/sửa/xóa từ, chuyển vị trí, nhập danh sách có xem trước và xuất dữ liệu.
- Xem thẻ: lật 3D, phím cách/mũi tên, đảo mặt, trộn thẻ, tự chạy, giọng đọc. Xem tự do không ghi điểm.
- Flashcards / Learn / Test: phiên được lưu trên server, phản hồi tại chỗ, luyện lại từ sai; Test chỉ chấm sau khi nộp toàn bài.
- Luyện bổ sung: trắc nghiệm, viết, nghe chép, sắp xếp câu, ghép cặp, luyện nói khi cấu hình STT.
- Bookdigital: sách → chương/lý thuyết → bài, câu hỏi chuẩn hóa từ JSON, audio/ảnh, sửa và nộp lại tại chỗ.
- Hồ sơ, thành tích thực, lớp học, gửi/nhận bài chấm.
- Cỡ chữ 24–60px, 3 nền, âm thanh tương tác bật/tắt, giảm chuyển động theo hệ điều hành, bố cục mobile.

## Sách JSON và quản trị

Sách, chương, lý thuyết, câu hỏi và đáp án đều được lưu trong database. `book/` chỉ là nguồn nhập ban đầu, không thuộc mã triển khai và có thể xóa. Admin tạo sách và tải thêm JSON trực tiếp qua giao diện, không cần thư mục nguồn.

Hiện đã nhập 4 sách, 74 chương, 369 bài. Các bài thiếu đáp án, đáp án mơ hồ hoặc không khớp lựa chọn được chuyển sang chấm thủ công và ghi chú trong quản trị. Cần đối chiếu nội dung nguồn; nhập JSON không đồng nghĩa xác nhận đáp án đúng.

`frontend-admin/src/` chứa giao diện quản trị, dùng chung React build, mở tại `/manage`. Chỉ superuser được truy cập. Có thể tìm/tạo/sửa/khóa người dùng, đặt lại mật khẩu, tạo sách, thêm/cập nhật chương bằng JSON có xem trước, biên tập bài/lý thuyết, xem media thiếu và tải 1–20 tệp/lượt (10 MB/tệp, 50 MB/lượt). Tên tệp được ghép tự động với đường dẫn JSON; admin kiểm tra và xác nhận trước khi tải. Media nằm trong `backend/private_media`, được phục vụ qua API yêu cầu đăng nhập.

Mục **Hướng dẫn & mẫu JSON** ngay trong admin cho tải mẫu, quy tắc nhập và ví dụ các dạng bài. Bản mẫu cũng có tại [docs/book-template-v1.json](docs/book-template-v1.json). JSON mới dùng schema_version 1; bộ nhập vẫn hỗ trợ các biến thể sách đã cung cấp.

## Phát triển và kiểm thử

```bash
npm run dev
npm run build
npm test
.venv/Scripts/python.exe -X utf8 manage.py check
.venv/Scripts/python.exe -X utf8 manage.py test
```

Django giữ auth, CSRF, quyền sở hữu, SRS và chấm điểm. Frontend cũ đã ngắt hoàn toàn, bạn có thể xóa `frontend/`. Thư mục backups và công cụ import_legacy đã được gỡ theo yêu cầu.

Xem [tổng quan kiến trúc](docs/README.md), [vận hành và kiểm thử](docs/OPERATIONS.md), [quy tắc cho agent](AGENTS.md) và [frontend](frontend-react/README.md).

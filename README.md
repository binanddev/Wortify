# Wortify

Ứng dụng học tiếng Anh/Đức gồm thư viện thẻ, luyện tập, đọc hiểu và lớp học.
React/Vite nằm trong `Frontend/`, Django API trong `Backend/`, dịch vụ đồng bộ bảng lớp học trong `Realtime/`.

## Chạy trên máy

Yêu cầu Python 3.12+ và Node.js 22.12+.

```powershell
.\start.ps1
```

Mở http://127.0.0.1:5173. Launcher chuẩn bị dependency khi cần, cập nhật schema local và chạy Django/Vite. Ctrl+C dừng các server do launcher mở. Khi cần cài sạch thư viện, dùng `.\start.ps1 -Install`.

Local mặc định dùng `Backend/db.sqlite3` và `Backend/private_media`; các dữ liệu này không đưa lên Git. Có thể đặt `WORTIFY_LOCAL_DATA_DIR` để dùng thư mục dữ liệu riêng. Không chép cấu hình production vào `Backend/.env`.

Class và bảng được tải theo nhu cầu. Realtime local chỉ được chuẩn bị khi mở bảng có quyền truy cập; khi realtime không khả dụng, Class dùng HTTP dự phòng. Chi tiết trong [hướng dẫn Realtime](Realtime/README.md).

## Kiểm tra

```powershell
.\.venv\Scripts\python.exe Backend/manage.py check
.\.venv\Scripts\python.exe Backend/manage.py test
.\.venv\Scripts\python.exe Backend/manage.py makemigrations --check --dry-run
npm test
npm --prefix Realtime test
npm run build
```

Kiểm thử thao tác trình duyệt: xem [hướng dẫn E2E](Frontend/e2e/README.md). [CI](.github/workflows/checks.yml) chạy kiểm tra khi mở pull request hoặc push vào nhánh được cấu hình.

Các kiểm thử backend tạo database test riêng. Không chạy migration lên dữ liệu đang sử dụng chỉ để kiểm tra thay đổi.

## Tài liệu

- [Frontend](Frontend/README.md): cấu trúc mã, chạy độc lập và kiểm tra giao diện.
- [Backend](Backend/README.md): API, cấu hình và vận hành backend.
- [Triển khai](DEPLOY.md): Render, Netlify, database và media production.
- [Sao lưu và khôi phục](ADMIN_BACKUPS.md): thao tác quản trị dữ liệu.
- [Biên soạn nội dung](docs/authoring/CONTENT_AUTHORING.md): định dạng và quy tắc nhập nội dung.
- [Bật/tắt tính năng](FEATURE_AVAILABILITY.md).
- [Lịch sử phiên bản](history.md).
- [Ghi chú thiết lập và phiên bản cũ](PROJECT_NOTES.md): chỉ tham khảo lịch sử.

## Cấu hình và dữ liệu riêng

`render.yaml` và `netlify.toml` là cấu hình triển khai ở gốc repo. Các biến backend production có mẫu tại `Backend/.env.production.example`. Push code không sao chép database hoặc media local lên production.

Khóa và thông tin kết nối chỉ lưu trong biến môi trường hoặc tệp riêng đã bị Git bỏ qua. `README.private.local.md` là ghi chú riêng trên máy, không phải tài liệu dùng chung; không chép nội dung tệp đó vào issue, log hoặc Git.

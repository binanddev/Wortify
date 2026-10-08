# Wortify — Backend và Frontend độc lập

Ứng dụng học tiếng Anh/Đức, gồm hai dự án có thể đưa vào hai repo và triển khai trên hai server riêng:

- **Backend/**: Django API, database/migrations, media riêng tư, requirements, dữ liệu mẫu, cấu hình môi trường và Gunicorn/PostgreSQL.
- **Frontend/**: React/Vite, package-lock, static assets, tests, cấu hình môi trường và Nginx/Netlify.

Hai bên giao tiếp qua HTTP `/api/`, không đọc file của nhau. Frontend proxy API tới địa chỉ backend cấu hình được. Browser dùng cùng origin cho giao diện và API để session, CSRF và media có xác thực hoạt động.

## Chạy local nhanh trên Windows

Từ thư mục gốc hiện tại:

```powershell
.\start.ps1
```

Script chuẩn bị dependency, chạy migration, build frontend và mở http://127.0.0.1:5173. API ở http://127.0.0.1:8000. Các script gốc và `tools/run_local.py` chỉ là tiện ích chạy chung, không cần đưa vào hai repo mới. Môi trường Python `.venv` sẵn có tại gốc vẫn dùng được.

Sau khi đã cài dependency, dùng `.\start-fast.ps1` để chạy nhanh không cài/build lại. Linux/macOS: `bash start.sh`. Nhấn Ctrl+C để dừng những server do script mở. Nếu còn server từ cấu trúc cũ, dừng cửa sổ đó rồi khởi động lại.

## Chạy hai phần riêng

Terminal backend:

```powershell
cd Backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
.\start.ps1
```

Terminal frontend:

```powershell
cd Frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
.\start.ps1
```

Backend tự tạo `.venv` bên trong repo của nó. Trên Linux/macOS chạy `bash start.sh` trong từng thư mục. Có thể dùng các lệnh cài/chạy thủ công trong README của từng phần.

`Backend/.env` tự nạp; biến môi trường của tiến trình được ưu tiên. Database SQLite hiện có vẫn ở `Backend/db.sqlite3`, media vẫn ở `Backend/private_media`. Không cần chuyển hoặc tạo lại dữ liệu. Đường dẫn tương đối `DJANGO_DB_PATH`, `DJANGO_MEDIA_ROOT`, `DJANGO_STATIC_ROOT` luôn tính từ gốc Backend.

`Frontend/.env` có `DJANGO_DEV_ORIGIN=http://127.0.0.1:8000`. Đổi biến này nếu chạy backend ở server/cổng khác. Frontend và backend có thể chạy từ hai thư mục hoàn toàn khác nhau. Khi chạy chung, có thể đặt `WORTIFY_BACKEND_PORT` và `WORTIFY_FRONTEND_PORT` trong môi trường shell; launcher tự nối hai cổng.

## Kiểm tra và quản trị

```powershell
# Từ gốc, dùng môi trường Python hiện có:
.\.venv\Scripts\python.exe Backend/manage.py check
.\.venv\Scripts\python.exe Backend/manage.py test
.\.venv\Scripts\python.exe Backend/manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe Backend/manage.py createsuperuser
npm test
npm run build
```

Hoặc chạy `python manage.py ...` trong Backend với virtualenv của riêng nó; `npm test` và `npm run build` trong Frontend. Các công cụ seed nằm trong `Backend/tools`; lệnh `seed_development_demo` dùng dữ liệu mẫu tại `Backend/sample_data` và chỉ chạy khi DEBUG bật. `tests_js` ở gốc là test của giao diện legacy đã bị thay thế, không nằm trong bộ test React hiện tại.

## Hai repo / hai server

- Copy **nội dung Backend/** vào repo backend, gồm các file cấu hình ẩn. Không copy `.venv`, database, private media, cache hoặc secret vào Git.
- Copy **nội dung Frontend/** vào repo frontend, gồm các file cấu hình ẩn. Không copy `node_modules`, `dist`, cache hoặc secret vào Git.
- Mỗi repo đã có `.gitignore`, `.dockerignore`, file môi trường mẫu, dependency manifest, script chạy và cấu hình triển khai riêng. Không cần file ở gốc monorepo.
- Dữ liệu database/media thực tế cần chuyển riêng và backup trước khi triển khai. Không đổi database engine bằng cách trỏ PostgreSQL vào file SQLite.

Hướng dẫn đầy đủ:

- [Backend: cài đặt, môi trường, deploy và dữ liệu](Backend/README.md)
- [Frontend: local, proxy và triển khai](Frontend/README.md)

Deploy backend trước và migrate database, sau đó đặt `proxy_pass` trong Nginx frontend trỏ tới backend. Chỉ phương án Netlify dùng biến `BACKEND_ORIGIN`. Ví dụ backend ở private IP `10.20.0.2:8000`, frontend public ở `https://learn.example.com`. Backend cho phép domain frontend trong Host/CSRF, frontend kết thúc HTTPS và proxy API qua mạng private/VPN. Hai server không chia sẻ filesystem.

## File môi trường: chọn đúng một lối chạy

- Local Backend: `.env.example` → `.env` trong Backend.
- Production Backend trực tiếp: `.env.production.example` → `.env` trong Backend. Hướng dẫn: [Backend/deploy/README.md](Backend/deploy/README.md).
- Local Frontend: `.env.example` → `.env` trong Frontend.
- Frontend Nginx: không cần file môi trường production; sửa upstream trong `deploy/nginx/native.conf.example`.
- Frontend Netlify: đặt BACKEND_ORIGIN trên Netlify; `.env.production.example` chỉ để build thử local.

Không copy đè `.env` đang có. File thật không được commit; chỉ commit `.example`. Những file env bên trong deploy dành cho Docker được giữ nguyên và không nằm trong quy trình trực tiếp.

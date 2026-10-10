# Wortify Backend

Django API độc lập. Chỉ cần nội dung repo này để cài, chạy test và triển khai; không cần Node.js hoặc frontend. Giao diện quản trị là một phần của frontend; backend cung cấp `/api/`.

## Local

Yêu cầu Python 3.12+ (dependency AV cần wheel phù hợp hệ điều hành/Python). Trong gốc repo backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Hoặc `.\start.ps1` tự chuẩn bị và chạy. Linux/macOS: `bash start.sh` hoặc dùng `.venv/bin/python` với các lệnh trên. Test: `python manage.py test`; kiểm tra migration: `python manage.py makemigrations --check --dry-run`.

## Cấu hình

`.env` ở gốc backend được tự nạp từ mọi working directory. `WORTIFY_ENV_FILE` chọn file khác (đường dẫn tương đối tính từ backend). Biến môi trường tiến trình luôn ưu tiên. Docker Compose truyền biến trực tiếp và không copy `.env` vào image.

- `DJANGO_ENV`: development / staging / production. Production yêu cầu secret ngẫu nhiên ít nhất 50 ký tự, DEBUG tắt.
- `DJANGO_ALLOWED_HOSTS`: domain mà reverse proxy gửi trong Host, phân cách dấu phẩy.
- `DJANGO_CSRF_TRUSTED_ORIGINS`: các origin frontend đầy đủ, ví dụ `https://learn.example.com`.
- `DJANGO_TRUST_PROXY=1`: chỉ bật khi backend nằm sau proxy tin cậy và bị giới hạn truy cập.
- `DJANGO_DB_PATH`, `DJANGO_MEDIA_ROOT`, `DJANGO_STATIC_ROOT`: hỗ trợ đường dẫn tuyệt đối; đường dẫn tương đối luôn tính từ repo backend. Mặc định `db.sqlite3`, `private_media`, `staticfiles`.
- PostgreSQL dùng `DJANGO_DATABASE_ENGINE=postgresql` và các biến `DJANGO_DB_*` trong `.env.production.example`.

Local Vite bảo toàn Host/Origin nên session và CSRF hoạt động với mặc định localhost. Production browser gọi `/api/` qua frontend reverse proxy; không gọi trực tiếp API khác origin. Không cần CORS hoặc cookie cross-site trong kiến trúc này. Với frontend hostname riêng khi local, thêm hostname đó vào ALLOWED_HOSTS.

## Triển khai không Docker

Xem [deploy/README.md](deploy/README.md) cho quy trình triển khai trực tiếp, cấu hình mẫu và cập nhật release.

## Backup và chuyển dữ liệu

Backup PostgreSQL và toàn bộ thư mục media trước khi update. Chuyển từ SQLite có thể dùng `python manage.py dumpdata --natural-foreign --exclude contenttypes --exclude auth.permission --exclude sessions --exclude admin.logentry --output backup/data.json` (tạo thư mục backup trước), migrate database đích rồi `python manage.py loaddata backup/data.json`. Chuyển cả nội dung `private_media` vào media root đích, giữ đường dẫn tương đối. File backup chứa dữ liệu người dùng nên bảo quản ngoài Git.

Cập nhật release: backup → cài dependency → migrate → collectstatic → khởi động lại service → kiểm tra `/api/health/check/`, đăng nhập và media từ frontend. Xem log bằng `journalctl -u wortify`. Không tự sinh migration trên production.

`sample_data/` chứa snapshot mẫu nhập liệu dùng cho tests và seed. Đây là dữ liệu độc lập của backend; frontend có thể cập nhật mẫu tải xuống của riêng nó. `python manage.py seed_development_demo` chỉ dùng cho local DEBUG, tạo tài khoản demo với mật khẩu được ghi trong mã seed.

## Quản trị và tài liệu API

Frontend có workspace quản trị tại `/manage`. Admin quản lý tài khoản và phân quyền User/Staff/Admin, hệ thống và giao diện chung. Staff quản lý tài khoản thường và biên tập nội dung học toàn hệ thống; không quản lý tài khoản đặc quyền hoặc cấu hình hệ thống. Mọi quyền được kiểm tra lại tại backend. Thay đổi quyền/mật khẩu, khóa tài khoản có thu hồi phiên; thao tác quản trị có nhật ký.

Tab **Tài liệu API** chỉ dành Admin, lấy tài liệu từ `/api/manage/api-docs/`. Có hướng dẫn session/CSRF, ví dụ nghiệp vụ, bộ lọc endpoint và tải Postman Collection. Bản độc lập nằm trong `docs/API_REFERENCE.md` và `docs/wortify.postman_collection.json`, có thể gửi cho lập trình viên mà không cần tài khoản Admin. Không chứa mật khẩu/khóa thực tế.

Sau khi cập nhật API, xuất lại tài liệu bằng `python tools/export_api_docs.py` từ repo backend. Lệnh này không khởi động web. Trong Postman, import collection, đặt Environment riêng với baseUrl/username/password, rồi gửi ba request trong thư mục 00 theo thứ tự. Chỉ gửi từng request cần thử trên dữ liệu thử nghiệm.

## Thư viện ảnh nền

`api/backgrounds.py`: tối đa 10 ảnh riêng tư mỗi tài khoản, kiểm tra nội dung JPG/PNG/WebP 30 MB, khóa owner khi upload để kiểm soát quota. Chọn nền áp dụng cả EN/DE và mọi interface. Giữ model `Theme` và các khóa lựa chọn cũ để bảo toàn dữ liệu ảnh, nhưng thư viện mới chỉ ghi ảnh/tên, không ghi preset. Manifest không trả thông số theme cũ. POST tạo/sửa/chọn preset cũ trả 410; API đọc ảnh cũ còn hoạt động. Không cần migration database trong thay đổi này. Ảnh cũ không bị xóa tự động; ảnh cá nhân cũ tính vào quota. Các file `private_media` vẫn cần backup.

Nền mặc định theo giao diện dùng `Profile.use_default_background` (migration users/0007). Migration giữ lựa chọn của hồ sơ có ảnh cũ; hồ sơ mới mặc định dùng nền code. `/api/me/backgrounds/select/` nhận `id: null` để đặt lại mà không xóa tệp. Chạy `python manage.py migrate` khi cập nhật bản này.

## Discover search (v1.2.3)

The explore/?browse=1 endpoint returns at most 12 summaries. Each worker keeps
one normalized public-content snapshot per language. A lightweight metadata
query on each request detects hierarchy, visibility, title, author and revision
changes; full JSON is only loaded when rebuilding that snapshot. Fuzzy matches
are calculated once per query term against the shared vocabulary. Private
ancestors exclude their entire subtree.

Normal node saves update updated_at. Bulk payload updates made outside the API
must also update updated_at so all workers refresh their search snapshots.
The cache is process-local and rebuilds after a restart; it is not a persistent
full-text search service. Metadata checks still scale with the node count.

The v1.2.3 content was imported directly into the database in one transaction,
without adding a permanent generator or seeding command. The local
content-library/v1.2.3/ directory contains exports and an import report, not
runtime assets. Preserve a database backup when moving or removing those files.
Account CSV files contain initial credentials and should stay outside Git.

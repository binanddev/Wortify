# Wortify Backend

Django API độc lập. Chỉ cần nội dung repo này để cài, chạy test và triển khai; không cần Node.js hoặc frontend. Giao diện quản trị là một phần của frontend; backend cung cấp `/api/`.

## Local

Yêu cầu Python 3.12+ (dependency AV cần wheel phù hợp hệ điều hành/Python). Trong gốc repo backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
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
- PostgreSQL dùng `DJANGO_DATABASE_ENGINE=postgresql` và các biến `DJANGO_DB_*` trong cấu hình Compose.

Local Vite bảo toàn Host/Origin nên session và CSRF hoạt động với mặc định localhost. Production browser gọi `/api/` qua frontend reverse proxy; không gọi trực tiếp API khác origin. Không cần CORS hoặc cookie cross-site trong kiến trúc này. Với frontend hostname riêng khi local, thêm hostname đó vào ALLOWED_HOSTS.

## Deploy trên server backend riêng

Chỉ cần repo backend và Docker Compose trên máy Linux:

```bash
cp deploy/.env.production.example deploy/.env.production.local
# Điền secret, mật khẩu DB, PUBLIC_HOST, BACKEND_BIND_IP.
dc() { docker compose --env-file deploy/.env.production.local -f deploy/compose.backend.yml -f deploy/compose.split-backend.yml "$@"; }
dc config --quiet
dc build
dc up -d db
dc run --rm backend python manage.py migrate --noinput
dc run --rm backend python manage.py check --deploy
dc run --rm backend python manage.py createsuperuser
dc up -d backend
```

`PUBLIC_HOST=learn.example.com` là domain public của frontend. `BACKEND_BIND_IP=10.20.0.2` là private/VPN IP thực tế trên máy backend; cổng mặc định 8000, đổi bằng `BACKEND_PORT`. Server frontend đặt `BACKEND_ORIGIN=http://10.20.0.2:8000`. Firewall chỉ cho phép server frontend truy cập cổng này, vì backend tin các header proxy gửi tới.

Compose build context chỉ là repo backend. PostgreSQL lưu volume `database`, upload lưu volume `media`. Không chạy `docker compose down -v` nếu còn cần dữ liệu. Nếu chuyển từ hệ thống Docker cũ, giữ đúng COMPOSE_PROJECT_NAME hoặc chủ động restore volume; không coi volume mới trống là dữ liệu cũ. Staging dùng `deploy/.env.staging.example` với secret, project name, domain và volume riêng.

Nếu dùng Netlify, cần một HTTPS reverse proxy public riêng cho API; cho phép domain API trong ALLOWED_HOSTS và domain frontend trong CSRF_TRUSTED_ORIGINS. Mẫu Compose ở trên được thiết kế cho private backend sau server frontend.

## Backup và chuyển dữ liệu

Backup PostgreSQL và toàn bộ volume media trước khi update. Chuyển từ SQLite có thể dùng `python manage.py dumpdata --natural-foreign --exclude contenttypes --exclude auth.permission --exclude sessions --exclude admin.logentry --output backup/data.json` (tạo thư mục backup trước), migrate database đích rồi `python manage.py loaddata backup/data.json`. Chuyển cả nội dung `private_media` vào media root/volume đích, giữ đường dẫn tương đối. File backup chứa dữ liệu người dùng nên bảo quản ngoài Git.

Cập nhật release: backup → build → migrate → up → kiểm tra `/api/health/check/`, đăng nhập và media từ frontend. Xem log bằng `dc logs --tail=100 backend`. Không tự sinh migration trên production.

`sample_data/` chứa snapshot mẫu nhập liệu dùng cho tests và seed. Đây là dữ liệu độc lập của backend; frontend có thể cập nhật mẫu tải xuống của riêng nó. `python manage.py seed_development_demo` chỉ dùng cho local DEBUG, tạo tài khoản demo với mật khẩu được ghi trong mã seed.

## Quản trị và tài liệu API

Frontend có workspace quản trị tại `/manage`. Admin quản lý tài khoản và phân quyền User/Staff/Admin, hệ thống và giao diện chung. Staff quản lý tài khoản thường và biên tập nội dung học toàn hệ thống; không quản lý tài khoản đặc quyền hoặc cấu hình hệ thống. Mọi quyền được kiểm tra lại tại backend. Thay đổi quyền/mật khẩu, khóa tài khoản có thu hồi phiên; thao tác quản trị có nhật ký.

Tab **Tài liệu API** chỉ dành Admin, lấy tài liệu từ `/api/manage/api-docs/`. Có hướng dẫn session/CSRF, ví dụ nghiệp vụ, bộ lọc endpoint và tải Postman Collection. Bản độc lập nằm trong `docs/API_REFERENCE.md` và `docs/wortify.postman_collection.json`, có thể gửi cho lập trình viên mà không cần tài khoản Admin. Không chứa mật khẩu/khóa thực tế.

Sau khi cập nhật API, xuất lại tài liệu bằng `python tools/export_api_docs.py` từ repo backend. Lệnh này không khởi động web. Trong Postman, import collection, đặt Environment riêng với baseUrl/username/password, rồi gửi ba request trong thư mục 00 theo thứ tự. Chỉ gửi từng request cần thử trên dữ liệu thử nghiệm.

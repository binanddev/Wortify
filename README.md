# Wortify

Ứng dụng học tiếng Anh/Đức: Django API trong `Backend/`, React/Vite trong `Frontend/`.

## Chạy local

Yêu cầu Python 3.12+ và Node.js 22.12+.

```powershell
.\start.ps1
```

Một launcher duy nhất: chuẩn bị thư viện khi cần, cập nhật schema local và chạy cả hai server. Không build frontend mỗi lần mở. Trang web: http://127.0.0.1:5173. Ctrl+C dừng server do launcher mở. Khi cập nhật dependency, chạy `.\start.ps1 -Install`.

Launcher luôn dùng `Backend/db.sqlite3` và `Backend/private_media`. Các tệp này giữ dữ liệu thử trên máy, không đưa lên Git. `.env.production.local` không được tự nạp khi chạy local. Không chép cấu hình production đè lên `Backend/.env`.

## Deploy

Xem [DEPLOY.md](DEPLOY.md): một repo Git, backend Render + frontend Netlify + database/media Neon. Sau lần thiết lập đầu, push lên nhánh được liên kết sẽ tự build/deploy.

- `render.yaml`: cấu hình backend.
- `netlify.toml`: cấu hình frontend.
- `Backend/.env.production.example`: danh sách biến production.
- `Backend/gunicorn.conf.py`: web server production.

### Tạo Web Service thủ công trên Render

Nếu đang ở màn hình **New → Web Service**, điền như sau:

- Repository: `binanddev/Wortify`.
- Branch: `minhtien` (nhánh hiện chứa cấu hình deploy).
- Language / Runtime: **Python 3**. Nếu đang hiện Node hoặc gợi ý yarn, đổi runtime sang Python 3 trước.
- Region: **Singapore**.
- Root Directory: `Backend` (giá trị `Backend/` cũng được).
- Instance Type: **Free**.

**Build Command** — chép nguyên dòng:

```sh
pip install -r requirements-production.txt && python manage.py collectstatic --noinput
```

**Start Command** — chép nguyên dòng:

```sh
python manage.py migrate --noinput && gunicorn --config gunicorn.conf.py config.wsgi:application
```

Không chép phần tiền tố `Backend/ $` hiển thị ở đầu ô. Không thêm `cd Backend`, vì Root Directory đã là Backend. Thay toàn bộ lệnh yarn mặc định bằng các lệnh trên.

Health Check Path: `/api/health/`. Auto Deploy: **On Commit**. Gunicorn tự đọc cổng `PORT` do Render cấp.

Khi tạo thủ công, `render.yaml` không tự điền biến môi trường: thêm **toàn bộ** biến trong mục cấu hình backend, gồm `PYTHON_VERSION=3.12.8`, `DJANGO_ENV=production`, `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DATABASE_URL`, `FRONTEND_ORIGIN`, `MEDIA_STORAGE=s3`, `AWS_STORAGE_BUCKET_NAME=wortify-media` và bốn biến AWS kết nối. Lấy `DJANGO_SECRET_KEY` đã tạo từ README riêng trên máy; không điền chữ “tự tạo”. Sau đó chọn **Deploy Web Service**.

## Kiểm tra

```powershell
.\.venv\Scripts\python.exe Backend/manage.py check
.\.venv\Scripts\python.exe Backend/manage.py test
.\.venv\Scripts\python.exe Backend/manage.py makemigrations --check --dry-run
npm test
npm run build
```

Hướng dẫn mã nguồn: [Backend](Backend/README.md), [Frontend](Frontend/README.md).

## Hướng dẫn deploy chi tiết và tài khoản

1. **Neon/media + Render/backend:** xem [README Backend](Backend/README.md#deploy-backend-trên-render--từng-bước), có đầy đủ biến môi trường, giá trị cố định và nơi lấy khóa.
2. **Netlify/frontend:** xem [README Frontend](Frontend/README.md#deploy-frontend-trên-netlify--từng-bước), có cấu hình build, domain và proxy.
3. **Thông tin thật trên máy:** [README.private.local.md](README.private.local.md) chứa tài khoản Neon và biến bí mật. File này được Git bỏ qua, không xuất hiện trong repo online.

Bucket `wortify-media` đã được tạo. Bước tiếp theo là lấy endpoint/credentials S3 và điền vào Render; PostgreSQL và Object Storage dùng hai kiểu kết nối khác nhau. Không cần tạo lại bucket.

Đã tạo và kiểm tra đăng nhập 10 tài khoản trên Neon production: `wortify_admin_01` đến `wortify_admin_05` (superuser), `wortify_staff_01` đến `wortify_staff_05` (staff). Xem trạng thái tạo và mật khẩu trong README riêng. SQLite local giữ dữ liệu test độc lập; push code không copy database local lên Neon.

## Tạo nội dung bằng chat

Gửi nguyên [CONTENT_AUTHORING.md](docs/authoring/CONTENT_AUTHORING.md) hoặc [WORTIFY_AUTHORING_RULES.txt](docs/authoring/WORTIFY_AUTHORING_RULES.txt) cho chat mới rồi yêu cầu nội dung. Chat xuất một gói JSON tổng để staff nhập ở Manage → Import content. Khôi phục tài khoản là chức năng riêng; xem [ADMIN_BACKUPS.md](ADMIN_BACKUPS.md).

## Version 1.2.6 — hướng dẫn cho chat mới

Đọc [CONTENT_AUTHORING.md](docs/authoring/CONTENT_AUTHORING.md) để bắt đầu chỉ bằng một câu yêu cầu. Với chat ngoài workspace, đính kèm [WORTIFY_AUTHORING_RULES.txt](docs/authoring/WORTIFY_AUTHORING_RULES.txt): file đầy đủ luật, định dạng và mẫu cho flashcard, bài tập, lý thuyết và Reading. Xuất lại từ code bằng `npm run guide:content`.

## Version 1.2.7 — import nội dung hệ thống một file

Staff/Admin vào Manage → Import content, chọn một file JSON chứa cây Flashcards, Practice Hub và Reading, xem trước rồi nhập. Mẫu đầy đủ nằm ở `Frontend/public/templates/content-package.json`; hướng dẫn biên soạn trong `docs/authoring/CONTENT_AUTHORING.md`. Giới hạn 50 MB, 5.000 node, 100.000 thẻ, 10 cấp folder.

Gói hiển thị là Wortify trong System library, không hiện người nhập. Người học Add package để nhận bản riêng và tiến độ riêng. Cùng UUID không nhập trùng; gói sai bị hoàn tác. Cần chạy migrations mới trước khi sử dụng; Render đã tự migrate khi khởi động.

Cả [CONTENT_AUTHORING.md](docs/authoring/CONTENT_AUTHORING.md) và [WORTIFY_AUTHORING_RULES.txt](docs/authoring/WORTIFY_AUTHORING_RULES.txt) đều chứa đủ hướng dẫn và mẫu: gửi nguyên một trong hai file cho chat, không cần sửa URL/tài khoản. Hướng dẫn khôi phục tài khoản dành riêng cho admin nằm ở [ADMIN_BACKUPS.md](ADMIN_BACKUPS.md).

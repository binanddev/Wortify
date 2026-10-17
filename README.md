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

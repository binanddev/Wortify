# Lernraum: vận hành, kiểm thử và thay đổi

## Chạy local

### Windows PowerShell

Từ `E:\code\bigmywweb`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Script tự tạo/ dùng `.venv`, cài `requirements.txt`, cài npm bằng `npm ci` nếu thiếu, migrate, build React rồi chạy Django và Vite. Mở `http://127.0.0.1:5173`; Content Studio là `/manage`. Dừng bằng `Ctrl+C`. `start.cmd` gọi cùng script.

### Chạy riêng

```powershell
.\.venv\Scripts\python.exe -X utf8 manage.py runserver 127.0.0.1:8002
Set-Location .\frontend-react
npm run dev
```

Tạo superuser trên database mới:

```powershell
.\.venv\Scripts\python.exe -X utf8 manage.py createsuperuser
```

Không chạy hai instance cùng lúc; script cố ý không tự kill process đang chiếm cổng.

## Test và build

```powershell
.\.venv\Scripts\python.exe -X utf8 manage.py check
.\.venv\Scripts\python.exe -X utf8 manage.py test
Set-Location .\frontend-react
npm test
npm run build
```

Backend test bao phủ cards, practice, community, workspace và React migration contract. Frontend test dùng Node test runner cho API/CSRF/error/shuffle. Với thay đổi contract backend, chạy cả hai nhóm.

Smoke test tối thiểu:

- auth, logout, session expiry, CSRF và lỗi 401/403/non-JSON;
- route `/`, `/en/...`, `/de/...`, back/forward và refresh route sâu;
- deck CRUD/import/export, Flash/Learn/Test và keyboard;
- book/chapter/exercise, answer feedback và giữ form sau submit;
- Content Studio: quyền superuser, preview/confirm/retry JSON, sửa exercise và upload media;
- desktop/mobile, reduced motion, focus/labels, audio/recorder trên browser hỗ trợ.

## Deploy

1. Cài Python 3.12+, Node 22.12+, `pip install -r requirements.txt`, `npm ci` trong `frontend-react`.
2. Đặt `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`; bật HTTPS.
3. Chạy `npm run build`, `manage.py migrate`, `manage.py collectstatic --noinput`, `manage.py check --deploy`.
4. Giữ `frontend-react/dist/.vite/manifest.json`, bundle, `backend/private_media` và database cần thiết. Không public database, private media, secret hoặc source JSON có đáp án.
5. Chạy WSGI/ASGI với `backend` trên `PYTHONPATH`; reverse proxy chuyển URL về Django và phục vụ static đúng cấu hình.
6. Reverse proxy cần body limit tối thiểu 55 MB cho batch media; ứng dụng vẫn áp dụng giới hạn từng file/batch.

## Quy trình thay đổi an toàn

1. Xác định route, module, endpoint, response shape, role và language bị ảnh hưởng.
2. Đọc [../AGENTS.md](../AGENTS.md), module liên quan và test hiện có trước khi sửa.
3. Giữ API client contract: dùng `request`, CSRF, credentials, abort, pending guard; không catch rộng hoặc success giả.
4. Giữ auth/ownership, response privacy, migration history và idempotency của import.
5. Chạy test nhỏ nhất bao phủ thay đổi, sau đó build nếu chạm frontend; chạy full backend test khi đổi model/API.
6. Cập nhật [README.md](README.md) hoặc template nếu contract/route/schema thay đổi.

## Xử lý lỗi thường gặp

| Triệu chứng | Kiểm tra đầu tiên |
| --- | --- |
| Port đã dùng | Dừng instance cũ bằng `Ctrl+C`, không kill ứng dụng không liên quan |
| Không kết nối API | Django 8002, Vite proxy, cookie session và `/api/session/` |
| CSRF lỗi | Host/Origin, CSRF cookie, `DJANGO_CSRF_TRUSTED_ORIGINS` |
| Admin không mở | Tài khoản phải là active superuser; kiểm tra lazy import `/manage` |
| Asset không hiện sau build | `dist/.vite/manifest.json`, `STATICFILES_DIRS`, đường dẫn `/static/react/` |
| Audio/record lỗi | browser capability, consent, cleanup stream, provider/key và timeout |

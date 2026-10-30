# Wortify

Ứng dụng học tiếng Anh/Đức: Django API trong `Backend/`, React/Vite trong `Frontend/`.

## Hướng dẫn admin

Phiên bản 1.14.0: xem [hướng dẫn xuất, sao lưu và khôi phục dữ liệu](ADMIN_BACKUPS.md). Hướng dẫn có thể đọc/tải trực tiếp tại Quản trị → Sao lưu & nhập.

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

Staff/Admin vào Manage → Import content, chọn/dán một file Wortify Text 1 chứa Luyện tập và Đọc hiểu, xem trước rồi công bố công khai dưới tên Wortify. Flashcard không nằm trong luồng này. Mẫu: `Frontend/public/templates/content-package.txt`; luật: `docs/authoring/CONTENT_AUTHORING.md`. Giới hạn 50 MB/file, 5.000 mục, 10 cấp folder; vẫn nhận JSON cũ.

Gói hiển thị là Wortify trong System library, không hiện người nhập. Người học Add package để nhận bản riêng và tiến độ riêng. Cùng UUID không nhập trùng; gói sai bị hoàn tác. Cần chạy migrations mới trước khi sử dụng; Render đã tự migrate khi khởi động.

Cả [CONTENT_AUTHORING.md](docs/authoring/CONTENT_AUTHORING.md) và [WORTIFY_AUTHORING_RULES.txt](docs/authoring/WORTIFY_AUTHORING_RULES.txt) đều chứa đủ hướng dẫn và mẫu: gửi nguyên một trong hai file cho chat, không cần sửa URL/tài khoản. Hướng dẫn khôi phục tài khoản dành riêng cho admin nằm ở [ADMIN_BACKUPS.md](ADMIN_BACKUPS.md).


### Ngôn ngữ giao diện và API nhập nội dung

- Cài đặt → **App language**: English / Tiếng Việt / Deutsch. Lưu theo tài khoản cho toàn ứng dụng; không đổi ngôn ngữ hoặc nội dung bài học. Bộ dịch viết sẵn tại `Frontend/src/i18n/messages.json`, không gọi dịch vụ dịch tự động.
- Staff/admin → `/manage` → **Content import API** → Enable API để lấy khóa nhập riêng. Có hướng dẫn curl/Postman ngay tại màn hình; Rotate API key đổi khóa, Disable API thu hồi khóa.
- Endpoint `POST /api/import/content/`: Bearer key. Bot gửi JSON `{text, preview: true}`, sau đó gửi nguyên text với `confirm: "IMPORT"` và `preview_token` nhận được (hiệu lực 24 giờ). Text/JSON request tối đa 8 MB; multipart file tối đa 50 MB. Giữ nguyên UUID/nội dung khi retry.
- `/api/import/guide/` cung cấp luật, `/api/import/openapi/` cung cấp đặc tả cho công cụ HTTP/bot. Chat không có công cụ HTTP chỉ tạo file, không tự công bố.
- Gói JSON hệ thống chỉ gồm `practice` và `reading`. Không chấp nhận `flashcards` kể cả mảng rỗng. Thẻ vẫn nhập trong bộ thẻ cá nhân. Khóa API không thể quản lý người dùng, khôi phục ZIP hay truy cập thẻ cá nhân.
- Sau khi cập nhật backend cần chạy migrations (deploy hiện có thực hiện bước này) để tạo bảng khóa API. Không thêm biến môi trường hoặc cài dịch vụ ngoài.
- Hai tài liệu gửi nguyên cho chat nằm trong `docs/authoring/`; hướng dẫn phân biệt nội dung hệ thống và thẻ cá nhân, có quy tắc tạo file và nhập API. Không ghi khóa API vào tài liệu hay Git.


### Lớp học và realtime local

Chạy `.\start.ps1` như bình thường. Launcher chuẩn bị Frontend, áp dụng migration rồi chạy Django (8000) và Vite (5173). Class được nạp theo nhu cầu: chỉ khi mở bảng với quyền hợp lệ, bộ điều phối local mới chuẩn bị dependency Realtime và bật WebSocket (8787). Không phải điền secret/URL realtime thủ công ở local; khóa phát triển riêng được lưu trong `.venv/wortify-realtime.secret` và không dùng cấu hình production. Node realtime dùng chế độ theo dõi thay đổi mã khi chạy local.

Nếu đang mở phiên server cũ, dừng đúng cửa sổ đó bằng Ctrl+C rồi chạy lại launcher. Launcher sẽ báo khi cổng web bị dịch vụ khác chiếm, không tự dừng tiến trình khác. Lỗi/cổng bận của realtime chỉ làm Class dùng đồng bộ HTTP dự phòng, không chặn web khởi động. Có thể đổi các cổng qua `WORTIFY_BACKEND_PORT`, `WORTIFY_FRONTEND_PORT`, `WORTIFY_REALTIME_PORT`.

Trong lớp, dùng tab **Bài giảng** và **Bài tập**. Các thao tác tạo/giao bài, mời học viên, thành viên và cài đặt dùng modal. Giáo viên có thể mở bảng → **Chia sẻ bài giảng** để cho phép khách không đăng ký xem trực tiếp. Mặc định mọi bài giảng riêng tư; link công khai chỉ cho xem bảng/PDF của đúng bài giảng, không mở danh sách thành viên/bài tập. Có thể tắt hoặc đổi link; bản khôi phục sao lưu luôn trở lại riêng tư.


#### Chuẩn bị thư viện khi chạy local

Launcher kiểm tra các dependency theo `package-lock.json` và thử nạp runtime trước khi chạy. Khi thư viện đã đủ, launcher bỏ qua npm ngay cả khi chưa có stamp cũ. Nếu lần cài trước bị ngắt, chỉ sửa bổ sung; không chạy `npm ci` toàn bộ theo mặc định, không tạo một cache npm mới riêng cho repo. Package có metadata nhưng thiếu tệp nội bộ được giữ bản cũ trong `.development-backups/incomplete-dependencies/` rồi cài lại đúng phiên bản.

Dùng `.\start.ps1` bình thường. Chỉ thêm `-Install` khi chủ động muốn cài sạch. Lượt cần cài có tiến độ mỗi 10 giây và log trong `.development-backups/setup/`; kiểm tra CPU giúp phân biệt đang giải nén với đứng im. Npm im lặng/không hoạt động 90 giây hoặc quá giới hạn tổng thời gian sẽ dừng với log cụ thể. Lệnh npm được gọi qua Node trực tiếp để Ctrl+C không để lại batch job của npm.


#### Ranh giới độc lập của Class

Settings và Profile không import mã Class. App chỉ tải trang Class khi vào đường dẫn lớp; tab Bài giảng tải studio và mở bài mới tải bảng. Khi rời bảng, kết nối, lịch đồng bộ, tải PDF và worker được dọn. Build kiểm tra ranh giới import này để tránh hồi quy. Lỗi render riêng Class được giữ trong vùng nội dung, thanh điều hướng vẫn sử dụng được.

Backend khai báo route Class trong `Backend/api/classroom/routes.py`, chỉ import handler khi đúng API được gọi. Dịch vụ `Realtime/` vẫn deploy độc lập; cơ chế tự bật qua loopback có khóa chỉ áp dụng cho launcher local được cấu hình rõ ràng, không khởi chạy process trong production Django. PDF không đi qua WebSocket.

Có thể đặt `WORTIFY_LOCAL_DATA_DIR` thành thư mục dữ liệu local riêng trước khi chạy launcher; cả migration, SQLite và media dùng thư mục đó. Mặc định vẫn dùng dữ liệu hiện tại trong Backend.

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

Chạy cả ứng dụng bằng `start.ps1` ở gốc workspace. Linux/macOS dùng `.venv/bin/python` với các lệnh trên. Test: `python manage.py test`; kiểm tra migration: `python manage.py makemigrations --check --dry-run`.

## Cấu hình

`.env` ở gốc backend được tự nạp từ mọi working directory. `WORTIFY_ENV_FILE` chọn file khác (đường dẫn tương đối tính từ backend). Biến môi trường tiến trình luôn ưu tiên. Render truyền biến trực tiếp qua Environment.

- `DJANGO_ENV`: development / staging / production. Production yêu cầu secret ngẫu nhiên ít nhất 50 ký tự, DEBUG tắt.
- `DJANGO_ALLOWED_HOSTS`: domain mà reverse proxy gửi trong Host, phân cách dấu phẩy.
- `DJANGO_CSRF_TRUSTED_ORIGINS`: các origin frontend đầy đủ, ví dụ `https://learn.example.com`.
- `DJANGO_TRUST_PROXY=1`: chỉ bật khi backend nằm sau proxy tin cậy và bị giới hạn truy cập.
- `DJANGO_DB_PATH`, `DJANGO_MEDIA_ROOT`, `DJANGO_STATIC_ROOT`: hỗ trợ đường dẫn tuyệt đối; đường dẫn tương đối luôn tính từ repo backend. Mặc định `db.sqlite3`, `private_media`, `staticfiles`.
- Neon PostgreSQL dùng `DATABASE_URL`; media production dùng `MEDIA_STORAGE=s3` và các biến AWS trong `.env.production.example`.

Local Vite bảo toàn Host/Origin nên session và CSRF hoạt động với mặc định localhost. Production browser gọi `/api/` qua frontend reverse proxy; không gọi trực tiếp API khác origin. Không cần CORS hoặc cookie cross-site trong kiến trúc này. Với frontend hostname riêng khi local, thêm hostname đó vào ALLOWED_HOSTS.

## Triển khai Render

Xem [DEPLOY.md](../DEPLOY.md). Cấu hình chính: `render.yaml` ở gốc workspace và `gunicorn.conf.py` tại đây.

## Deploy backend trên Render — từng bước

Dùng cùng repo với frontend. Cấu hình `../render.yaml` đã chuẩn bị sẵn.

1. Push code và migrations lên Git; không push `.env`, database local, private media hoặc README riêng.
2. Render → New → Blueprint → kết nối repo → chọn nhánh `minhtien` đang chứa cấu hình deploy. Blueprint path: `render.yaml` ở gốc.
3. Kiểm tra service `wortify-api`, runtime Python, region Singapore, plan Free, root directory `Backend`.
4. Build command: `pip install -r requirements-production.txt && python manage.py collectstatic --noinput`.
5. Start command: `python manage.py migrate --noinput && gunicorn --config gunicorn.conf.py config.wsgi:application`.
6. Health check path: `/api/health/`. Auto deploy: On Commit.
7. Điền biến bên dưới, chọn Deploy. Khi log báo server đã chạy, ghi lại URL HTTPS Render để dùng cho Netlify.
8. Khi có URL Netlify thật, sửa `FRONTEND_ORIGIN` cho khớp rồi Save/redeploy backend.

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

### Biến môi trường Render và giá trị

Các giá trị `<...>` phải thay bằng dữ liệu thật; không copy nguyên dấu ngoặc. Các khóa thật đã có được lưu ở `../README.private.local.md` trên máy và `Backend/.env.production.local`, không nằm trong Git.

```dotenv
PYTHON_VERSION=3.12.8
DJANGO_ENV=production
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<lấy từ README.private.local.md hoặc để Blueprint tự tạo>
DATABASE_URL=<chuỗi PostgreSQL Neon trong README.private.local.md>
FRONTEND_ORIGIN=https://<tên-site-thật>.netlify.app
MEDIA_STORAGE=s3
AWS_STORAGE_BUCKET_NAME=wortify-media
AWS_ENDPOINT_URL_S3=<endpoint S3 của nhánh production do Neon cấp>
AWS_ACCESS_KEY_ID=<token_id của credential Neon có quyền storage>
AWS_SECRET_ACCESS_KEY=<s3_secret_access_key của credential đó>
AWS_REGION=ap-southeast-1
```

`DJANGO_SECRET_KEY` giữ ổn định giữa các deploy; đổi khóa sẽ làm mất hiệu lực phiên đăng nhập. `DATABASE_URL` giữ nguyên `sslmode=require&channel_binding=require`. Không dùng URL PostgreSQL làm S3 endpoint. Region cần khớp thông tin storage Neon trả về; mẫu trên dùng Singapore.

Render tự cấp `PORT`, `RENDER`, `RENDER_EXTERNAL_HOSTNAME`; không cần tự điền. Code tự cho phép hostname Render và hostname trong `FRONTEND_ORIGIN`, tự tin cậy proxy HTTPS của Render. Không cần đặt `DJANGO_DB_PATH`, `DJANGO_MEDIA_ROOT`, các biến `DJANGO_DB_*` hoặc khóa AWS trên Netlify.

Tùy chọn: `WEB_CONCURRENCY=1` (mặc định), `SUPERUSER_SETUP_KEY` chỉ dùng khi cần link tạo admin. Nếu đã có các tài khoản trong README riêng thì không cần setup key. Không bật DEBUG production.

### Neon: bucket đã tạo, lấy kết nối media

Bucket `wortify-media` cần ở đúng nhánh production và để Private. Để lấy biến từ Neon CLI mà không đè môi trường app, mở terminal trong một thư mục cấu hình riêng rồi chạy:

```powershell
npx neon@latest login
npx neon@latest link
npx neon@latest branches list
npx neon@latest env pull --file .env.local
```

Hoàn thành đăng nhập trong trình duyệt nếu được mở. Khi link chọn đúng project và branch chứa bucket. Mở `.env.local` vừa tạo, lấy `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` đưa vào Render Environment và bản lưu riêng `Backend/.env.production.local`. Không copy file này đè `Backend/.env`.

Nếu cần tạo credential riêng cho production, sau khi link chạy:

```powershell
npx neon@latest credentials create --scope storage:read --scope storage:write --name wortify-render
```

Kết quả `token_id` là `AWS_ACCESS_KEY_ID`; `s3_secret_access_key` là `AWS_SECRET_ACCESS_KEY`. Lưu ngay vì secret chỉ hiển thị lúc tạo. Endpoint lấy từ thông tin storage của cùng nhánh hoặc kết quả env pull, không tự đoán từ hostname database. Không cần tạo lại bucket đã có.

### Kiểm tra sau deploy

- Mở `https://<backend>.onrender.com/api/health/`: nhận JSON có `app: Wortify`.
- Trên Netlify: đăng nhập bằng tài khoản Neon trong README riêng; superuser có quyền Admin, staff chỉ có quyền Staff.
- Tạo một bộ thẻ hoặc bài đọc, tải ảnh/âm thanh, lưu rồi tải lại trang để kiểm tra database và media.
- Deploy lại backend và kiểm tra dữ liệu/media còn truy cập được. Health check riêng không chứng minh upload S3 đã hoạt động.
- `403` khi upload: kiểm tra quyền storage, nhánh, endpoint và cặp key/secret. Lỗi CSRF: kiểm tra `FRONTEND_ORIGIN` đúng URL Netlify. `DisallowedHost`: kiểm tra hostname Render và frontend.

Nguồn: [Render Blueprint](https://render.com/docs/blueprint-spec), [Neon credentials](https://neon.com/docs/storage/authentication).

## Backup và chuyển dữ liệu

Backup PostgreSQL và toàn bộ thư mục media trước khi update. Chuyển từ SQLite có thể dùng `python manage.py dumpdata --natural-foreign --exclude contenttypes --exclude auth.permission --exclude sessions --exclude admin.logentry --output backup/data.json` (tạo thư mục backup trước), migrate database đích rồi `python manage.py loaddata backup/data.json`. Chuyển cả nội dung `private_media` vào media root đích, giữ đường dẫn tương đối. File backup chứa dữ liệu người dùng nên bảo quản ngoài Git.

Cập nhật release: backup → cài dependency → migrate → collectstatic → khởi động lại service → kiểm tra `/api/health/check/`, đăng nhập và media từ frontend. Xem log trên Render. Không tự sinh migration trên production.

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


### Khi frontend mới nhưng API báo không tìm thấy đường dẫn

`render.yaml` chỉ cấu hình service được quản lý bằng Blueprint; nó không tự cập nhật một Web Service đã tạo thủ công. Với service `wortify.onrender.com`, vào Settings và kiểm tra Repository `binanddev/Wortify`, Branch `minhtien`, Root Directory `Backend`, runtime Python và Build/Start Command ở trên. Đặt Auto-Deploy thành On Commit, rồi Manual Deploy → Deploy latest commit. Nếu deploy thất bại, Render có thể vẫn phục vụ bản Live cũ; kiểm tra log migration/build thay vì chỉ nhìn trạng thái Live.

Sau deploy, `/api/health/` phải trả `version`, `revision` và `features`. `revision` phải khớp commit mới trên GitHub. Kiểm tra cùng đường dẫn qua Netlify: hai phản hồi phải có cùng revision. Nếu khác nhau, kiểm tra `BACKEND_ORIGIN=https://wortify.onrender.com` trên Netlify rồi build/deploy lại frontend (proxy được tạo lúc build).

Khi chưa đăng nhập, `/api/de/flashcard/discover/` phải trả 200 (danh sách công khai), còn `/api/manage/import-api/` phải trả 401; cả hai không được trả 404. `/api/import/openapi/` phải trả 200. Không sửa quyền tài khoản để xử lý lỗi route 404.


### Khách chưa đăng nhập

Khách được đọc catalogue Flashcard, Practice Hub và Reading công khai, xem bài/đính kèm công khai và học thử. Chỉ GET/HEAD của các endpoint public được phép; tạo/sửa/xóa, sao chép vào thư viện cá nhân, đồng bộ tiến độ và quản trị vẫn yêu cầu phiên đăng nhập. Chủ sở hữu bị vô hiệu hóa và tài nguyên riêng tư không được đưa vào các endpoint công khai. Bài tập thử được chấm trong trình duyệt, không tạo bản ghi tiến độ.


## Dictation learning sync (1.11.0)

The learning sync review whitelist accepts `type: "dictation"`. Correct dictation reviews satisfy the written-recall requirement for comprehensive deck mastery and retain their own timing/SRS mode. UUID retries remain idempotent. Deck options persist `listenBeforeAnswer` and `gradingMode` (`exact` or `flexible`) through the existing options event. Like other Studio reviews, the frontend submits the grading result; the sync endpoint records the review rather than regrading raw typed text. Deploy backend and frontend together; no schema change is needed.


## Library operations (1.12.0)

Apply cards migration `0013_deck_operation` during deployment. `DeckOperation` stores operation UUIDs, request fingerprints and results separately from learning events; these transient management receipts are excluded from portable learning backups.

`POST /api/{lang}/decks/manage/` accepts `request_id` (UUID), `action` (`move`, `copy`, `delete`, `undo`) and up to 100 distinct owned deck IDs. Move/copy require `folder` (null for root); copy may supply `names` keyed by source ID. Copy up to 20,000 cards per operation. Copies have new deck/card IDs, retain image links and accepted answers, obey publication policy, and have no copied progress. Delete removes the entire selection atomically. Repeating an identical UUID request returns its original result; reusing it with different input is rejected.

Move returns an operation_id for Undo. Send a new request_id with action=undo and operation_id within 15 minutes. Every deck must still have the recorded destination and revision, and all original destinations must remain valid. Folder changes and ordinary deck mutations use the same owner lock as batch operations.

`GET /api/{lang}/decks/export/?ids=1,2&format=json` (or csv) returns a ZIP of content files and manifest.json. The same 100-deck/20,000-card limits and ownership/language checks apply. Learning progress is excluded and existing CSV formula escaping is preserved. All writes require session authentication and CSRF. Tests: `manage.py test api.test_deck_management`.

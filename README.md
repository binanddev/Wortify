# Wortify

Web học tiếng Anh/Đức: React 19 + Vite + Tailwind/HeroUI, Django 5.2 chỉ cung cấp API. Frontend gồm cả quản trị trong `frontend-react/src/admin`. Development dùng SQLite; cấu hình deploy bên dưới dùng PostgreSQL, Gunicorn và Nginx.

## Chạy trên Windows

Cần Python 3.12+, Node.js 22.12+ và Internet để cài thư viện.

```powershell
Set-Location -LiteralPath 'E:\code\bigmywweb'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Hoặc mở `start.cmd`. Frontend: http://127.0.0.1:5173; API: http://127.0.0.1:8000/api/health/. Giữ terminal chạy, Ctrl+C dừng những dịch vụ do nó khởi động. Script không tắt dịch vụ lạ chiếm cổng. Đổi cổng bằng `WORTIFY_FRONTEND_PORT` và `WORTIFY_BACKEND_PORT`. Linux/macOS phát triển: `bash start.sh`.

Tùy chọn file môi trường development:

```powershell
Copy-Item .env.example .env
$env:WORTIFY_ENV_FILE = (Resolve-Path .env).Path
.\.venv\Scripts\python.exe --version
```

Đường dẫn Python thực tế của dự án là **`.\.venv\Scripts\python.exe`**. Không bắt buộc tạo `.env` để chạy local; khi dùng file, đặt `WORTIFY_ENV_FILE` trước lệnh Django/start. Biến đã có trong môi trường tiến trình được ưu tiên hơn file. Loader nhận `KEY=value`, dấu nháy bao ngoài và dòng chú thích, không thực thi shell hoặc nội suy biến. Vite local dùng `DJANGO_DEV_ORIGIN` khi cần trỏ API khác; không đưa secret vào biến `VITE_*`.

## Tự tạo superuser

Chạy ở thư mục gốc, đúng môi trường/database đang dùng:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Nhập username, email (có thể bỏ trống) và mật khẩu hai lần. Terminal không hiện ký tự khi gõ mật khẩu. Sau đó đăng nhập giao diện web và mở `/de/admin`, `/en/admin` hoặc `/manage`. Superuser vẫn có đầy đủ Flashcard, Practice Hub, Explore và Create để kiểm thử. Không cung cấp giao diện Django admin; quản trị bằng React tại `/manage`.

Đổi mật khẩu tài khoản đã tồn tại:

```powershell
.\.venv\Scripts\python.exe manage.py changepassword ten_tai_khoan
```

Tạo staff: đăng nhập superuser → Quản trị → Người dùng → icon `+` → vai trò Staff. Staff quản lý tài khoản thường và dữ liệu của họ; không sửa/xóa staff hoặc superuser, không tự nâng quyền và không dùng Django admin.

Trong container production, dùng `dc exec backend python manage.py createsuperuser` sau khi đã định nghĩa hàm `dc` theo kịch bản dưới đây. Tạo superuser trên database mới bằng lệnh này, không đưa mật khẩu vào image, README hay Git.

## Chức năng và dữ liệu thử

- `/{en|de}/flashcard`: thư viện folde, bộ thẻ, Flash/Learn/Test và ôn cách quãng. Hai ngôn ngữ độc lập.
- `/{lang}/practice`: học từng câu, tự kiểm tra, làm lại đến đúng và lưu tiến độ.
- `/{lang}/explore`: tìm nội dung công khai; `/{lang}/create`: quản lý folde và nhập `.txt`, xem trước và thêm media. Hướng dẫn tại `/{lang}/create/guide`. Có 7 dạng bài, 11 styles; `giaodien.html` chỉ là tham khảo.
- Cài đặt: ảnh nền riêng JPG/PNG/WebP tối đa 30 MB; màu, độ đậm, tương phản chữ; kính 0–100% giữ viền sáng. Áp dụng cho tài khoản ở mọi trang và cả EN/DE.
- Theme: Cài đặt → Theme → icon `+`, lưu ảnh nền cùng màu/cỡ/độ đậm/tương phản chữ, độ trong suốt, độ cong và độ lúp kính. Mỗi tài khoản tối đa 5 theme cá nhân hoặc theme do mình tạo; theme hệ thống của người khác không tính vào giới hạn này. Chọn icon ✓ để áp dụng cho DE, EN hoặc cả hai. Icon bút/thùng rác sửa/xóa theme của mình. Staff/superuser có lựa chọn công bố thành theme hệ thống; người học không thấy người tạo.
- Ảnh nền được tải một lần cho mỗi lần đăng nhập, lưu Blob trong IndexedDB và hiển thị qua URL nội bộ trình duyệt. Hai không gian dùng cùng ảnh chỉ tải một bản. Reload/đổi trang/đổi ngôn ngữ dùng bản lưu, không gọi lại ảnh hay manifest. Cập nhật ảnh, chọn hoặc sửa theme có hiệu lực sau đăng xuất/đăng nhập lại; giao diện hiển thị thông báo. Đăng xuất xóa cache nền. Nếu trình duyệt chặn lưu trữ/hết dung lượng hoặc tải lỗi, báo lỗi trong Cài đặt và yêu cầu đăng nhập lại, không tự tải lặp lại trên mỗi reload. Xóa dữ liệu website có thể làm mất cache.
- Hover/active/selected/focus dùng nền trong suốt, viền kính và focus ring; Cài đặt có độ cong 0–32 px và độ lúp 0–100. Giảm chuyển động theo tùy chọn hệ điều hành. Điều chỉnh hiển thị trực tiếp vẫn có hiệu lực trong phiên; lưu thành theme để tái sử dụng.
- Âm nền là các nốt nhẹ có khoảng nghỉ, chỉ khởi động sau thao tác của người dùng; tạm im khi nghe audio/video/TTS hoặc ẩn tab. Không có sóng trầm chạy liên tục. Âm lượng thay đổi không tạo lại audio context.
- Practice Hub và các chế độ Flashcard có icon **Bỏ qua** để hiện đáp án, sau đó icon **Tiếp tục**. Câu bỏ qua không được tính là trả lời đúng: Practice Hub vẫn để câu đó chưa hoàn thành; Flashcard ghi nhận chưa nhớ để ôn lại. Bài kiểm tra giữ cách hiển thị hiện có, icon tiếp tục chuyển focus tới câu kế tiếp hoặc tổng kết/nút nộp bài.

Dữ liệu demo chỉ dùng development:

```powershell
.\.venv\Scripts\python.exe manage.py seed_development_demo
```

Lệnh yêu cầu DEBUG và chạy lại không nhân bản. Tài khoản demo mặc định được mô tả trong [kiến trúc](docs/AGENTS.md). Không chạy seed hoặc dùng các tài khoản test trên production.

## Môi trường deploy

### Frontend trên Netlify, backend đã deploy riêng

#### Đăng ký superuser bằng giao diện React

Mở `https://wwwortify.netlify.app/setup-7f3c91d8/<SUPERUSER_SETUP_KEY>/`.
Thay phần trong dấu ngoặc bằng khóa đã đặt trên Render (chuỗi ngẫu nhiên tối
thiểu 32 ký tự, chỉ chữ/số/gạch ngang/gạch dưới). Không có `/api/` trong URL trang.
Form dùng chung giao diện đăng ký React; chỉ khác đường dẫn và quyền tài khoản.
Backend xác thực khóa trên mỗi yêu cầu và trả JSON, không render HTML.
Có thể tạo nhiều superuser. Đổi khóa trên Render rồi restart/deploy làm đường
 dẫn cũ hết hiệu lực; xóa biến để tắt tính năng. Không đặt khóa trong biến VITE_*.
Ai có URL đều có quyền tạo superuser; giữ kín URL như mật khẩu.

Deploy cả frontend và backend; chạy `python manage.py migrate --noinput` để
xóa bảng bootstrap cũ bằng migration 0006. Giữ migration 0005 để tương thích
các database đã áp dụng trước đó. Không còn Django admin `/admin/`; quản trị
người dùng bằng giao diện React `/manage`.

Không còn tác vụ ping định kỳ từ frontend, Netlify, Vite hoặc Docker. Có thể
xóa `BACKEND_PING_ENABLED` khỏi Netlify. `BACKEND_ORIGIN` vẫn cần cho scope Builds
để sinh proxy API. Dịch vụ giám sát bên ngoài có thể gọi `/api/health/check/`.

Repository có `netlify.toml`: base directory `frontend-react`, build command
`npm run build:netlify`, publish directory `dist`, Node 22. Kết nối repository
với Netlify và dùng cấu hình này. Không chọn thư mục gốc làm publish directory.

Đặt `BACKEND_ORIGIN=https://domain-backend-cua-ban` trong Environment variables
của Netlify, scope **Builds**. Có thể import file theo mẫu
`frontend-react/.env.production.example`. Backend phải truy cập được từ Internet
bằng HTTPS; không dùng localhost, IP mạng riêng, đường dẫn `/api` hay thông tin
đăng nhập trong URL. Không đặt origin bằng domain frontend để tránh proxy lặp.

Để build trên máy rồi upload thủ công:

```powershell
Copy-Item frontend-react/.env.production.example frontend-react/.env.production.local
# Sửa BACKEND_ORIGIN trong file .env.production.local vừa tạo.
npm --prefix frontend-react ci
npm --prefix frontend-react run build:netlify
```

Upload **toàn bộ** `frontend-react/dist`, gồm `_redirects`. File `.env.production.local`
được gitignore; Netlify build từ Git không có file local của máy bạn, vì vậy phải
import/khai báo biến trên Netlify. Biến môi trường tiến trình ưu tiên hơn file.
Đổi backend: sửa `BACKEND_ORIGIN` rồi build/deploy lại, không sửa React.
Không dùng `VITE_*` cho secret. Build Netlify không cần secret Django, database
hoặc `BACKEND_MONITOR_SECRET`.

Trình duyệt vẫn gọi `/api/...` trên domain frontend. Build sinh proxy `/api/`,
`/admin/`, `/static/admin/`, giữ đường dẫn ảnh cũ `/static/react/` và fallback
React cho reload trực tiếp `/de/...`, `/en/...`, `/manage`. Backend giữ cookie
host-only (không ép Cookie Domain sang domain backend) và API trả
`Cache-Control: private, no-store` như middleware hiện có.

**Môi trường backend cần đối chiếu:**

```dotenv
DJANGO_ALLOWED_HOSTS=api.example.com,ten-site.netlify.app,learn.example.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://ten-site.netlify.app,https://learn.example.com
```

Thay các domain ví dụ bằng domain thực sự sử dụng. Nếu backend dùng Compose
hiện có, `compose.backend.yml` đang tự đặt allowed hosts/CSRF từ `PUBLIC_HOST`;
cần chỉnh môi trường triển khai backend tương ứng, không chỉ thêm biến vào file
mà Compose không đọc. Với proxy HTTPS phía backend, giữ cấu hình trusted proxy
phù hợp của nhà cung cấp; chỉ bật `DJANGO_TRUST_PROXY=1` khi proxy tin cậy ghi đè
`X-Forwarded-Proto`. Không bật CORS hoặc SameSite=None chỉ để dùng Netlify proxy.
Deploy Preview có domain riêng: dùng backend staging và khai báo origin chính
xác nếu cần đăng nhập, không mặc định cho mọi preview quyền dùng production.

**Giới hạn cần thử trước khi mở thật:** Netlify proxy timeout sau 26 giây;
upload audio lớn (ứng dụng cho phép tới 200 MB), tải media và API chậm cần kiểm
tra thực tế. Không thể tăng giới hạn này bằng file env. Việc giám sát định kỳ do dịch vụ bên ngoài đảm nhiệm.

Sau deploy, thử `/api/health/check/`, đăng nhập/đăng xuất, lưu dữ liệu, reload
`/de/flashcard`, ảnh nền, audio/upload lớn và `/admin/`. Khi domain/backend thay
đổi, cập nhật cả môi trường frontend lẫn allowed hosts/CSRF trên backend.

Nếu chuyển sang VPS/Docker, dùng cấu hình bên dưới với cùng tên `BACKEND_ORIGIN`
và lệnh build thường `npm run build`. React không cần đổi; từng nền tảng vẫn cần
adapter proxy/build riêng (Netlify dùng `_redirects`, Docker dùng Nginx).

Tài liệu: [Netlify proxy và giới hạn](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/),
[biến môi trường build](https://docs.netlify.com/configure-builds/environment-variables).

Bộ mẫu trong [deploy](deploy):

- Development: `.env.example`, SQLite, Vite + Django runserver.
- Staging: `deploy/.env.staging.example`, DEBUG tắt, database/volume/secret/domain riêng, frontend cổng loopback 8081.
- Production: `deploy/.env.production.example`, DEBUG tắt, PostgreSQL 17, Gunicorn, Nginx, HTTPS; frontend loopback 8080.
- Máy frontend riêng: `deploy/.env.frontend.example`, không chứa mật khẩu database hoặc secret Django.

Các bước deploy dưới đây dùng **Linux + Docker Engine/Compose v2**, chạy ở thư mục gốc repository. Đây là cấu hình chuẩn bị, không tự triển khai lên máy chủ. Máy frontend cần Nginx trên host và chứng chỉ TLS. Không dùng `runserver`, `vite dev` hoặc `vite preview` phục vụ production.

Hai kịch bản đều giữ một origin cho trình duyệt: `https://learn.example.com/api/...`. Frontend Nginx chuyển API về backend, vì vậy cookie đăng nhập và CSRF hoạt động cùng origin; không cần CORS, không đặt `SameSite=None`, không public thư mục media. Django chỉ phục vụ API JSON; mọi giao diện quản trị nằm trong React.

### Chuẩn bị domain, secret và HTTPS

1. Trỏ DNS domain về máy frontend. Cho phép TCP 80/443; cổng database 5432 không public. Dùng domain staging riêng khi thử nghiệm.
2. Sao chép mẫu, thay `PUBLIC_HOST` bằng domain không có scheme/path, sinh **ba secret khác nhau**:

```bash
cp deploy/.env.production.example deploy/.env.production.local
chmod 600 deploy/.env.production.local
python3 -c 'import secrets; print(secrets.token_urlsafe(64))'
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Dán kết quả lần lượt vào `DJANGO_SECRET_KEY`, `DJANGO_DB_PASSWORD` và `BACKEND_MONITOR_SECRET` trong file local. Không đưa kết quả vào Git. Compose sẽ từ chối chạy nếu bỏ trống. `.env.*.local` đã được gitignore. `COMPOSE_PROJECT_NAME` phải ổn định để dùng lại đúng volume; đổi tên project có thể khiến hệ thống trông như mất dữ liệu vì tạo volume mới.

3. Lấy chứng chỉ TLS theo nhà cung cấp của bạn. Ví dụ máy Linux mới dùng Certbot standalone, DNS đã trỏ đúng và cổng 80 tạm trống:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d learn.example.com
```

Lệnh yêu cầu đã cài Nginx/Certbot; nếu máy đang phục vụ website khác, dùng phương án xác thực webroot/DNS của Certbot để không dừng chúng.

4. Sao chép [edge.conf.example](deploy/nginx/edge.conf.example) vào cấu hình host Nginx, thay domain và đường dẫn certificate. Nginx host kết thúc TLS rồi chuyển vào frontend container tại `127.0.0.1:8080`. Bỏ server default bị trùng nếu máy đã có cấu hình default. Nếu staging dùng 8081, đổi `proxy_pass` của vhost staging tương ứng.

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Sau lần cấp cert standalone đầu tiên, cấu hình phương thức gia hạn phù hợp với cổng 80 đang được Nginx dùng (webroot/DNS hoặc hook stop/start có kế hoạch) và kiểm tra `certbot renew --dry-run`. Không chỉ cấp cert rồi bỏ qua gia hạn.

`DJANGO_TRUST_PROXY=1` chỉ an toàn vì cổng backend bị cô lập và frontend proxy tự ghi đè `X-Forwarded-Proto`. Không publish backend trực tiếp ra Internet. HSTS mặc định 3600 giây, không ép mọi subdomain; tăng dần sau khi HTTPS ổn định. `check --deploy` có thể khuyến nghị bật includeSubDomains và preload; chỉ bật khi toàn bộ subdomain thực sự dùng HTTPS.

### A. Frontend và backend chung một máy chủ

```bash
set -euo pipefail
# Chạy tại thư mục gốc repository; file env đã điền secret/domain.
dc() { docker compose --env-file deploy/.env.production.local -f deploy/compose.backend.yml -f deploy/compose.single.yml "$@"; }
dc config --quiet
dc build
dc up -d db
dc run --rm backend python manage.py migrate
dc run --rm backend python manage.py check --deploy
dc run --rm backend python manage.py createsuperuser
dc up -d
dc ps
curl --fail https://learn.example.com/api/health/check/
```

Nếu cần nhập dữ liệu cũ, thực hiện bước chuyển dữ liệu bên dưới **trước** createsuperuser. Giao diện quản trị được build cùng frontend React. Volume `database` giữ PostgreSQL, `media` giữ ảnh/audio riêng tư. Chỉ frontend publish cổng `127.0.0.1:8080`; API và database nằm trong mạng Compose.

### B. Frontend và backend trên hai máy chủ

Giả sử mạng riêng hoặc WireGuard: frontend `10.20.0.1`, backend `10.20.0.2`. Kênh giữa hai máy phải là mạng tin cậy/VPN mã hóa; không chuyển cookie, mật khẩu qua HTTP trên Internet công cộng.

**Máy backend:** dùng repo có backend và thư mục deploy, cấu hình `deploy/.env.production.local` như trên, `PUBLIC_HOST=learn.example.com`, `BACKEND_BIND_IP=10.20.0.2` (địa chỉ thực sự có trên máy).

```bash
set -euo pipefail
dc() { docker compose --env-file deploy/.env.production.local -f deploy/compose.backend.yml -f deploy/compose.split-backend.yml "$@"; }
dc config --quiet
dc build
dc up -d db
dc run --rm backend python manage.py migrate
dc run --rm backend python manage.py check --deploy
dc run --rm backend python manage.py createsuperuser
dc up -d
dc ps
```

Giới hạn cổng `10.20.0.2:8000` chỉ cho IP frontend bằng firewall/cloud security group. Với Docker, kiểm tra cả quy tắc firewall của Docker/DOCKER-USER; không mặc định rằng UFW một mình đã chặn port publish. PostgreSQL không publish cổng. Backend không cần public domain hay public TLS riêng khi kênh này đi qua VPN. Nếu thay cổng host, đặt `BACKEND_PORT` và sửa `BACKEND_ORIGIN` trên frontend cho khớp.

**Máy frontend:** cần source frontend, Dockerfile và deploy config. Không sao chép secret Django hoặc mật khẩu database sang frontend.

```bash
cp deploy/.env.frontend.example deploy/.env.frontend.local
# PUBLIC_HOST=learn.example.com
# BACKEND_ORIGIN=http://10.20.0.2:8000   (không có dấu / ở cuối)
dc() { docker compose --env-file deploy/.env.frontend.local -f deploy/compose.frontend.yml "$@"; }
dc config --quiet
dc up -d --build
dc ps
curl --fail https://learn.example.com/api/health/check/
```

Nginx host/TLS giống kịch bản A. `/api/` đi về máy backend. `/assets/` và route React phục vụ tại frontend. Upload MP3 200 MB đi qua hai lớp proxy với giới hạn 201 MB để chừa multipart overhead; backend vẫn kiểm tra định dạng/kích thước. Media riêng tư luôn đi qua API có xác thực, không mount thành thư mục static công khai.


### Staging độc lập

Sao chép `.env.staging.example` thành `.env.staging.local`, điền secret mới, dùng domain khác. Thay đường dẫn env trong hàm `dc`. Project `wortify-staging` có volume riêng; frontend bind 8081 nên có thể cùng host với production, Nginx staging proxy vào 8081. Không dùng chung volume/secret hoặc dữ liệu người dùng thật để test. Với hai máy, điều chỉnh IP/cổng backend staging riêng.

### Chuyển dữ liệu development sang PostgreSQL

Nếu muốn giữ dữ liệu hiện có, dừng ghi dữ liệu trên môi trường nguồn trong thời gian xuất/copy. Sao lưu database và media trước. Không copy nguyên SQLite vào volume PostgreSQL.

```powershell
New-Item -ItemType Directory -Force .development-backups | Out-Null
.\.venv\Scripts\python.exe -X utf8 manage.py dumpdata --natural-foreign --exclude contenttypes --exclude auth.permission --exclude sessions --exclude admin.logentry --output .development-backups/data.json
```

File này chứa dữ liệu cá nhân và hash mật khẩu: chuyển bằng kênh an toàn, không commit, bảo quản như database backup. Sao chép toàn bộ `backend/private_media` nguồn thành archive `media.tar` có **nội dung media tại gốc archive**, giữ nguyên đường dẫn tương đối.

Trên máy backend đích đã migrate nhưng chưa tạo tài khoản trùng:

```bash
# backup/data.json và backup/media.tar đã được chuyển riêng, không nằm trong image.
dc run --rm -T backend python manage.py loaddata --format=json - < backup/data.json
dc run --rm -T backend tar -xf - -C /app/private_media < backup/media.tar
```

Kiểm tra tài khoản, EN/DE, số bộ thẻ/bài tập, file ảnh/audio và tiến độ trước khi đổi DNS. Không mang các tài khoản demo/test công khai sang production: loại bỏ hoặc khóa chúng trước khi mở dịch vụ; giữ một superuser thực sự do bạn quản lý.

### Backup, cập nhật và rollback

Định nghĩa `dc` đúng kịch bản/máy backend. Dùng shell Bash để chuyển hướng dữ liệu nhị phân của `pg_dump`:

```bash
set -euo pipefail
mkdir -p backup
chmod 700 backup
dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup/database.dump
dc run --rm -T --no-deps backend tar -cf - -C /app/private_media . > backup/media.tar
```

Các lệnh dùng stdin/stdout để không phải mở quyền thư mục backup cho container. Với backup nhất quán DB + media, tạm dừng thao tác ghi của người dùng. Lưu thêm file env/secrets ở kho bí mật, mã release/image tag và bản frontend; giữ bản backup ngoài máy chủ và thử restore định kỳ. Không dùng `docker compose down -v` khi muốn giữ dữ liệu.

Cập nhật: backup → checkout release đã kiểm tra → `dc build` → `dc run --rm backend python manage.py migrate` → `dc up -d` → kiểm tra health/đăng nhập/ảnh/media. Máy frontend riêng chạy lại build/up tại đó. Không tự sinh migration trong production.

Rollback dùng image/release cũ; nếu migration không tương thích ngược, khôi phục cả DB và media từ cặp backup cùng thời điểm trên môi trường đã dừng ghi. Không chạy ngược migration tùy tiện. Ví dụ restore PostgreSQL trên database đích đã được chuẩn bị và bảo trì:

```bash
# Thao tác ghi đè: chỉ thực hiện sau khi xác nhận đúng môi trường và backup.
dc exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backup/database.dump
```

Xem log server: `dc logs --tail=100 backend`, `dc logs --tail=100 frontend` (trên máy frontend nếu tách), `dc logs --tail=100 db`. Log kiểm tra từ máy chủ frontend nằm trong Quản trị → Hệ thống; bảng này chỉ tải khi mở hoặc nhấn cập nhật. Chạy định kỳ `dc exec backend python manage.py clearsessions` bằng scheduler của hệ thống.

### Kiểm tra trước khi mở cho người dùng

- `dc config --quiet`, `dc run --rm backend python manage.py check --deploy`, `dc ps` và `sudo nginx -t`.
- HTTPS, đăng nhập/đăng xuất, CSRF, route React khi reload trực tiếp và quản trị React.
- Đăng nhập để tải ảnh nền đã chọn, reload/đổi ngôn ngữ phải dùng cache; cập nhật nền rồi đăng nhập lại; audio/ảnh bài tập, upload lớn, lỗi 413/502 nếu giới hạn proxy sai.
- Staff không sửa superuser; dữ liệu riêng tư không mở được bằng tài khoản khác.
- Health `/api/health/check/` trả `{"ok":true}`; backup/restore, disk space và gia hạn TLS đã được thử.

Cấu hình được chuẩn bị để kiểm thử deploy; không thể xác nhận container/Nginx/TLS chạy thực tế nếu máy kiểm tra chưa có Docker/Nginx và chưa có domain/chứng chỉ.

Tham khảo chính thức: [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [trusted proxy header](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header), [Docker Compose production](https://docs.docker.com/compose/how-tos/production/), [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Kiểm tra mã nguồn

```powershell
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Frontend CSS chỉ có một entry: `frontend-react/src/design-system/index.css`; style dùng utility Tailwind, biến theme và keyframe. Backend API tests gom trong `backend/api/tests.py`. Build/test logic không thay thế việc người dùng kiểm tra trực quan. Khi sửa CSS có chủ đích, cập nhật baseline bằng `npm --prefix frontend-react run styles:baseline`.


## Tài khoản Supeuse
```
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
```
## Tài khoản hiện có
```
Superuser: test_superuser_1 — Pb-VReCcWxiDX0QW!9
Superuser: test_superuser_2 — 6BQwxqNxAv_t1MXr!9
Staff: test_staff_1 — 9BxsP_SE_TXFo5WB!9
Staff: test_staff_2 — ethZ2bO6TzkJzRTs!9
```

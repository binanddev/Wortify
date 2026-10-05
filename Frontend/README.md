# Frontend Wortify

React19, HeroUI2, Tailwind4, Framer Motion12, Vite8; backend Django, không có backend Node riêng.

- App.jsx: auth, routing EN/DE, sidebar hai mặt.
- core.js: API/CSRF, cache, hủy request và action guard.
- ui.jsx: component dùng chung; src/design-system/index.css: entry Tailwind duy nhất. Xem src/design-system/README.md để sửa theme, utility và style theo module.
- practice-hub.jsx/practice-activity.jsx: học và lưu tiến độ cho 7 dạng bài. explore.jsx: tìm nội dung công khai. exercise-studio.jsx: Create, nhập .txt và quản lý nội dung.
- library.jsx: bộ thẻ/thư mục; flashcard-studio.jsx: Flashcards/Learn/Test; study.jsx: ôn liên bộ và luyện thêm.
- learning-sync.js: queue tự lưu server, retry/idempotence. local-learning.js/flashcard-engine.js: chấm tại trình duyệt.
- learning.jsx: cài đặt; community.jsx: hồ sơ/lớp.
- src/admin/: quản trị tích hợp; dashboard hệ thống cho superuser, quản lý người dùng thường và dữ liệu cho staff, tải riêng.

## Chạy độc lập

Yêu cầu Node.js >=22.12 và npm >=10. Thực hiện trong thư mục này (hoặc gốc repo frontend sau khi tách):

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Mở http://127.0.0.1:5173. Backend mặc định http://127.0.0.1:8000; đổi `DJANGO_DEV_ORIGIN` trong `.env` nếu backend chạy ở địa chỉ khác rồi khởi động lại Vite. `.\start.ps1` hoặc `bash start.sh` cũng cài dependency còn thiếu và chạy frontend. `npm test`, `npm run build`, `npm run preview` đều chạy ngay trong repo này. Preview dùng cổng 4173 và cùng cấu hình proxy.

Trình duyệt luôn gọi `/api/` trên origin của frontend. Vite khi local và Nginx/Netlify khi triển khai chuyển tiếp request tới backend; session cookie, CSRF và các URL media tiếp tục cùng origin. Không cần chia sẻ filesystem, database hay secret Django với frontend. Nếu backend từ xa kiểm tra Host/CSRF, cấu hình backend cho origin frontend tương ứng.

## Server frontend riêng (Docker + Nginx)

Chỉ cần repo này, Docker Compose và một backend đang chạy:

```bash
cp deploy/.env.frontend.example deploy/.env.frontend.local
# Điền PUBLIC_HOST và BACKEND_ORIGIN (ví dụ http://10.20.0.2:8000).
docker compose --env-file deploy/.env.frontend.local -f deploy/compose.frontend.yml up -d --build
```

Build context chỉ là repo frontend. `BACKEND_ORIGIN` là cấu hình runtime của Nginx, nên đổi máy backend chỉ cần tạo lại container. Nginx container lắng nghe trên loopback 8080 của máy frontend. Cấu hình HTTPS ở Nginx host theo `deploy/nginx/edge.conf.example`, thay domain/certificate và cổng nếu cần. Chỉ proxy HTTPS này được truy cập container: cấu hình hiện tại gửi `X-Forwarded-Proto: https` tới backend. Backend phải cho phép `PUBLIC_HOST`, trust proxy và tin cậy `https://PUBLIC_HOST` cho CSRF. Firewall cổng backend chỉ cho server frontend/private VPN truy cập.

Các file upload vẫn do API backend cung cấp có xác thực. Frontend chỉ chứa static asset của giao diện. Không mount media hoặc thư mục của backend.

## Netlify

`netlify.toml` ở gốc repo này: base `.`, publish `dist`, command `npm run build:netlify`. Đặt `BACKEND_ORIGIN=https://api.example.com` trong môi trường build, hoặc copy `.env.production.example` thành `.env.production.local` để build local. Upload cả `dist`, gồm `_redirects`. Backend phải truy cập được qua HTTPS và cho phép domain API trong `DJANGO_ALLOWED_HOSTS`, domain frontend trong `DJANGO_CSRF_TRUSTED_ORIGINS`. Khi deploy trực tiếp monorepo, đặt base directory thành `Frontend` trong Netlify hoặc chọn cấu hình của thư mục này.

## Tách repo

Copy nội dung thư mục này vào repo frontend mới, gồm các file ẩn mẫu và cấu hình. Bỏ `node_modules`, `dist`, `.env*` thực tế (giữ các `.example`). Cài lại bằng `npm ci`. Không cần bất kỳ file nào ở thư mục cha hay repo backend.


Giọng TTS/micro phụ thuộc thiết bị. Practice Hub yêu cầu đáp án khi tạo; không có bài viết dài hoặc chấm thủ công. Hướng dẫn kiến trúc và giới hạn hiện tại: docs/AGENTS.md.

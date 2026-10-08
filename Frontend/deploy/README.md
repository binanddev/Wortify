# Deploy trực tiếp (không Docker)

## Nginx — lựa chọn mặc định cho server Linux

Trong repo Frontend:

```sh
npm ci
npm test
npm run build
```

Chép toàn bộ `dist/` đến `/srv/wortify/frontend/dist/`. Không cần Node chạy thường trực, `.env` hoặc secret Django trên server frontend. Build Nginx không cần BACKEND_ORIGIN: địa chỉ API nằm trong cấu hình Nginx runtime.

Copy `deploy/nginx/native.conf.example` tới cấu hình site Nginx. Thay domain, đường dẫn chứng chỉ HTTPS đã cấp, root và `proxy_pass`. Cùng máy dùng 127.0.0.1; hai máy dùng private IP backend. Kiểm tra `sudo nginx -t` trước `sudo systemctl reload nginx`.

Giữ `/api/` trước SPA fallback; giữ Host và X-Forwarded-Proto. Backend phải cho phép domain frontend, trust proxy và giới hạn firewall. Không phục vụ private_media bằng Nginx. Kiểm tra đăng nhập, upload, audio và tải lại một URL sâu sau deploy.

Cập nhật bằng thư mục release mới và chuyển symlink sau khi upload xong để tránh index/assets lệch phiên bản. Chỉ assets có hash mới cache dài hạn; index.html không cache.

## Netlify — lựa chọn thay thế

Dùng `netlify.toml`: base là Frontend khi deploy monorepo, hoặc `.` khi repo riêng; publish `dist`, build `npm run build:netlify`. Đặt BACKEND_ORIGIN=https://api.example.com trong môi trường build Netlify. Backend cần public HTTPS; cho phép domain API trong ALLOWED_HOSTS và domain Netlify trong CSRF_TRUSTED_ORIGINS.

Build thử local: copy `.env.production.example` thành `.env.production.local`, điền BACKEND_ORIGIN rồi `npm run build:netlify`. Không đưa secret vào bất kỳ biến VITE_* nào.

Các file Compose/Docker và `.env.frontend.example` thuộc cấu hình Docker được giữ nguyên, không dùng trong quy trình trên.

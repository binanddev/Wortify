# Deploy trực tiếp trên Linux (không Docker)

Dùng Python 3.12+, PostgreSQL đã được tạo database/user, và user hệ thống `wortify` sở hữu `/srv/wortify/backend`. Chép repo Backend vào đường dẫn đó. Chạy các lệnh dưới bằng user `wortify`:

```sh
cd /srv/wortify/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-production.txt
test -f .env || cp .env.production.example .env
chmod 600 .env
# Điền secret ngẫu nhiên, DB password, domain và đường dẫn trong .env.
.venv/bin/python manage.py check --deploy
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser
```

Không ghi đè `.env` nếu đã triển khai trước đó. Không chạy `start.ps1`, `start.sh` hoặc Django runserver trên production.

Copy `deploy/wortify.service.example` tới `/etc/systemd/system/wortify.service`, sửa user/path nếu cần. Sau đó chạy bằng tài khoản có quyền quản trị:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now wortify
sudo systemctl status wortify
sudo journalctl -u wortify -n 100 --no-pager
```

Cùng máy: giữ bind `127.0.0.1:8000`. Hai máy: bind private IP của backend trong service; firewall chỉ cho IP frontend truy cập. `DJANGO_TRUST_PROXY=1` chỉ dùng khi request đi qua Nginx tin cậy. Domain frontend phải có trong ALLOWED_HOSTS và CSRF_TRUSTED_ORIGINS.

Nginx mẫu nằm trong repo Frontend: `deploy/nginx/native.conf.example`. Nginx phục vụ frontend và proxy `/api/`; không public `private_media`. API phục vụ tệp riêng tư có xác thực.

Cập nhật: backup DB và private_media → cài requirements → check → migrate → collectstatic → `sudo systemctl restart wortify`. Kiểm tra `/api/health/check/` và đăng nhập qua domain frontend. Không tự tạo migrations trên server.

Staging dùng máy/service, database, media, secret và domain riêng; copy cùng mẫu production rồi đặt `DJANGO_ENV=staging`.

Các file Docker/Compose và `.env.*` trong thư mục deploy là cấu hình Docker cũ, không cần dùng cho quy trình này; được giữ nguyên.

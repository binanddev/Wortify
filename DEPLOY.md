# Deploy: Render + Netlify + Neon

## Dữ liệu local và production

Local chạy `start.ps1`, dùng SQLite `Backend/db.sqlite3` và `Backend/private_media`. Production dùng `DATABASE_URL` và Object Storage. Không cần sửa code qua lại; cấu hình trên hosting quyết định dịch vụ sử dụng. Không tự chuyển dữ liệu test lên Neon.

`Backend/.env.production.local` là nơi lưu riêng thông tin kết nối trên máy, đã bị Git bỏ qua. Không upload file này lên Git. Render nhận các biến trong trang Environment. Netlify chỉ cần địa chỉ backend, không cần khóa database hoặc storage.

## 1. Tạo kho media trên Neon

Trong Neon Console, chọn đúng project và nhánh `production` → **Object storage** → **New bucket**. Đặt tên `wortify-media`, quyền **Private**, rồi Create. Bucket lưu ảnh/âm thanh; PostgreSQL lưu nội dung và đường dẫn.

Nếu chưa có endpoint/credentials, cách Neon khuyến nghị là dùng CLI trong một thư mục thiết lập riêng (không ghi đè môi trường local của ứng dụng):

```powershell
mkdir neon-storage-setup
cd neon-storage-setup
npm install @neon/config
npx neon@latest login
npx neon@latest link
npx neon@latest branches list
npx neon@latest config add bucket wortify-media
npx neon@latest deploy
```

Trong bước link chọn project của bạn và nhánh production; kiểm tra lại trước deploy. Nếu trình duyệt mở để đăng nhập, hoàn thành đăng nhập ở đó. CLI sẽ tạo/lấy cấu hình bucket và ghi thông tin vào `.env.local`. Không cần chạy `neon init` trên code ứng dụng.

Chép bốn biến `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` vào `Backend/.env.production.local` để lưu riêng và vào Render ở bước tiếp theo. `AWS_STORAGE_BUCKET_NAME=wortify-media`. Endpoint và credential phải cùng nhánh. Không dùng mật khẩu PostgreSQL làm khóa storage.

Nguồn: [Tạo bucket](https://neon.com/docs/storage/buckets), [Thiết lập storage](https://neon.com/docs/storage/get-started), [Credentials](https://neon.com/docs/storage/authentication). Nếu không thấy tab Object storage, chụp màn hình tên project/nhánh và menu; che các khóa bí mật.

## 2. Render: backend

Nếu tạo bằng **New → Web Service** thủ công, xem [các ô cần điền trong README Backend](Backend/README.md#tạo-web-service-thủ-công-trên-render). Chọn runtime Python 3, nhánh `minhtien`, Root Directory `Backend`; không dùng các lệnh yarn mặc định.

Đưa code lên Git. Trong Render chọn **New → Blueprint**, kết nối repo và chọn nhánh deploy. Render đọc `render.yaml` ở gốc repo, chọn Python và thư mục Backend tự động.

Điền các giá trị được yêu cầu:

- `DATABASE_URL`: chuỗi PostgreSQL Neon, đã lưu riêng trên máy.
- `FRONTEND_ORIGIN`: URL Netlify dự định dùng, ví dụ `https://ten-web-cua-ban.netlify.app`. Khi biết URL thật ở bước 3, cập nhật lại nếu khác.
- `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: từ bước 1.
- Kiểm tra `AWS_REGION` khớp region Neon (mẫu hiện là `ap-southeast-1`).

Blueprint đã đặt `MEDIA_STORAGE=s3`, tên bucket, DEBUG tắt và tạo secret Django. Build cài dependency + collectstatic; mỗi lần khởi động tự migrate schema rồi chạy Gunicorn. Không tự nạp dữ liệu demo.

Sau deploy ghi lại URL `https://...onrender.com`. Gói Free được chọn trong blueprint; media lưu ở Neon, không phụ thuộc ổ đĩa tạm Render.

## 3. Netlify: frontend

Chọn **Add new project → Import an existing project**, cùng repo và nhánh. `netlify.toml` tự đặt base `Frontend`, build `npm run build:netlify`, publish `dist`.

Thêm biến `BACKEND_ORIGIN=https://...onrender.com` bằng URL Render thật, rồi deploy. Không thêm dấu `/api` vào biến này. Nếu đổi backend URL, deploy lại frontend.

Lấy URL Netlify thật rồi cập nhật `FRONTEND_ORIGIN` ở Render cho khớp. API và media đi qua `/api` trên domain Netlify để đăng nhập/session hoạt động. Không cần cấu hình CORS riêng.

## 4. Tài khoản và kiểm tra

Nếu đã có tài khoản trong [README riêng](README.private.local.md), đăng nhập trực tiếp; không cần setup key. Chỉ khi chưa có tài khoản: trong Render Environment, thêm tạm `SUPERUSER_SETUP_KEY` là chuỗi ngẫu nhiên ít nhất 32 ký tự, deploy lại; mở `https://<domain-netlify>/setup-7f3c91d8/<key>/` để tạo admin đầu tiên. Xóa biến này sau khi tạo xong. Đây là chức năng thiết lập sẵn có của ứng dụng.

Kiểm tra thực tế trên domain Netlify: đăng nhập, tạo bộ thẻ, tạo bài đọc, tải một ảnh/âm thanh, mở lại và phát; deploy lại backend rồi xác nhận nội dung/media còn nguyên. `/api/health/` chỉ chứng minh server đang chạy, không thay thế kiểm tra lưu dữ liệu.

Sau lần thiết lập đầu, push vào nhánh được kết nối sẽ kích hoạt deploy ở cả Render và Netlify. Các khóa nằm trên hosting; code và migrations nằm trong Git. Khi thay schema, tạo migration trên local và commit cùng code.

## Trạng thái chuẩn bị

Code hỗ trợ PostgreSQL qua psycopg và media S3 qua django-storages. Chưa triển khai dịch vụ thực tế khi chưa điền thông tin Object Storage và kết nối repo với hai hosting. Không coi build/test local là bằng chứng upload media production thành công.

Hướng dẫn từng trường cấu hình: [Backend README](Backend/README.md), [Frontend README](Frontend/README.md).

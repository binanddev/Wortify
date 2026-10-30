# Wortify Teaching Realtime

Dịch vụ WebSocket độc lập cho bảng dạy học. Có thể deploy cả folder `Realtime/` mà không cần mã nguồn Django/React, database hay file PDF.

## Vai trò

Django giữ đăng nhập, quyền thành viên, PDF, snapshot, kiểm tra thao tác và lưu dữ liệu bền vững. Giáo viên gửi các gói nét vẽ qua API, tối đa khoảng 4 lần/giây khi đang viết; không gửi yêu cầu ghi khi bảng đứng yên. Sau khi lưu, Django trả chứng nhận HMAC cho chính gói đó. Trình duyệt chuyển chứng nhận qua WebSocket và relay phát nét vector cho các học viên trong phòng. Relay không được phép tự ghi/chỉnh dữ liệu.

Học viên nhận trực tiếp các nét đã lưu qua WebSocket; không còn vòng GET 350 ms. Client đối chiếu dữ liệu mỗi 30 giây và khi kết nối lại để bù thông báo bỏ lỡ. Nếu chưa cấu hình hoặc relay gián đoạn, bảng vẫn hoạt động bằng cập nhật HTTP mỗi 10 giây. Chỉ mở kết nối khi bảng đang mở; đóng bảng sẽ dọn kết nối và timer.

## Deploy trên Render/Railway/VPS

1. Dùng Node.js 22.12 trở lên. Chọn Root Directory `Realtime` nếu deploy từ repository hiện tại; nếu tách thành repository mới thì chọn thư mục gốc.
2. Build: `npm ci --omit=dev --ignore-scripts`. Start: `npm start`. Health check: `/healthz`. Nền tảng cần hỗ trợ WebSocket; không deploy relay bằng static hosting hay hàm serverless ngắn hạn.
3. Cấu hình biến môi trường cho dịch vụ:
   - `ALLOWED_ORIGINS=https://wortify-pro.netlify.app` — các origin được phép, ngăn cách bằng dấu phẩy; không thêm đường dẫn hoặc dấu `/` cuối.
   - `TEACHING_REALTIME_SECRET` — chuỗi ngẫu nhiên ít nhất 32 ký tự. Tạo một lần, giữ riêng tư.
   - `PORT` — do nền tảng cấp; mặc định 8787.
   - `MAX_CONNECTIONS` — mặc định 1000, là giới hạn bảo vệ tài nguyên, không phải cam kết sức tải đã đo.
4. Trên Django, đặt:

   ```dotenv
   TEACHING_REALTIME_URL=wss://your-realtime-service.example/ws
   TEACHING_REALTIME_SECRET=<cùng giá trị với dịch vụ realtime>
   ```

5. Deploy/restart backend và rebuild frontend với mã mới. Không cần thêm biến `VITE_*`: frontend lấy địa chỉ công khai/vé truy cập từ Django. Không đưa secret vào frontend. Không thay đổi cấu hình database hoặc PDF.

Có sẵn `render.yaml` nếu dùng Render Blueprint từ repository chính: chọn Blueprint Path `Realtime/render.yaml` (file `render.yaml` ở gốc vẫn dành cho backend hiện có). Docker hoạt động với context chỉ riêng thư mục này: `docker build -t wortify-realtime ./Realtime`; cấp các biến trên lúc chạy. Nếu thử ở máy bằng file `.env`, dùng `node --env-file=.env src/main.js` vì `npm start` đọc môi trường tiến trình.

Hiện thiết kế cho **một instance relay**. Khi tăng thành nhiều instance cần bổ sung Redis Pub/Sub hoặc message broker để phát xuyên instance. Snapshot vẫn ở Django nên restart relay không mất bài giảng. Chọn dịch vụ không tự ngủ khi có lớp đang học nếu cần realtime liên tục. Chưa chạy kiểm tra tải hoặc deploy thật trong lần phát triển này.

Tài liệu nền tảng: [WebSockets trên Render](https://render.com/docs/websocket), [Blueprint và đường dẫn YAML](https://render.com/docs/blueprint-spec).

## Xác thực và giới hạn

- WebSocket `/ws`; chỉ nhận upgrade từ `ALLOWED_ORIGINS`. Vé truy cập được gửi trong message đầu tiên, không nằm trong URL/log truy cập.
- Vé có hạn 60 giây, được gia hạn trước khi hết hạn qua Django để kiểm tra lại thành viên. Thành viên bị loại khỏi lớp có thể giữ kết nối cũ tối đa thời hạn này.
- Chỉ giáo viên có vé ghi mới được phát chứng nhận sự kiện. Chữ ký gắn room, user, revision, thời hạn và dữ liệu; ticket/event dùng scope riêng. Học viên không phát nét được, ngay cả khi có một chứng nhận hợp lệ.
- Lưu thành công vẫn hoạt động khi cấu hình relay lỗi; dịch vụ này không trở thành điều kiện để website khởi động.
- Giới hạn message 384 KiB, hàng đợi gửi chậm 1 MiB, handshake 5 giây, tốc độ message theo kết nối và heartbeat. Không nén WebSocket để tránh tăng RAM/CPU không cần thiết.
- Không chuyển PDF qua relay, không cần cookies/database credentials, không ghi log nội dung hoặc vé.

## Kiểm thử bằng code

`npm ci --ignore-scripts` rồi `npm test`. Unit tests dùng socket giả, không mở cổng web. Bao gồm phòng riêng, quyền ghi, hết hạn, giả chữ ký, chống phát trùng, giới hạn tài nguyên và test chữ ký tương thích Python/Node. Frontend có test kết nối lại/gia hạn/dọn kết nối, chống mất bản nháp và giới hạn byte của batch.

## Sửa lỗi web không tải được

Bản chia gói trước đã đưa PDF vào chunk được UI nhập tĩnh, khiến PDF chạy ngay trong lúc khởi động website. Cấu hình frontend mới để bundler giữ thư viện PDF sau dynamic import. Plugin `teaching-lazy-boundary` làm build thất bại nếu PDF lọt vào đồ thị import ban đầu, kể cả qua thư viện UI trung gian. Điều này sửa hồi quy đóng gói đã xác nhận; chưa có log lỗi trình duyệt/hosting thực tế để kết luận đây là nguyên nhân duy nhất của lỗi người dùng gặp.


## Local qua start.ps1

Ở gốc dự án, chỉ cần `.\start.ps1`. Launcher chạy migration và khởi động Django/Vite. Realtime và dependency riêng của nó chỉ được chuẩn bị khi truy cập bảng với vé hợp lệ lần đầu. Mở trang chủ, Settings, Profile hoặc danh sách lớp không bật Node relay. WebSocket local ở `ws://127.0.0.1:8787/ws`, dùng khóa riêng trong `.venv/wortify-realtime.secret`; cấu hình production trong shell hoặc Backend/.env không được dùng cho relay local. Các origin 127.0.0.1/localhost đúng cổng frontend được cho phép tự động. Phiên Node local theo dõi mã nguồn để khởi động lại khi sửa file.

## Khách công khai

Giáo viên bật riêng trên từng bài giảng bằng modal Chia sẻ bài giảng. URL có token ngẫu nhiên, mặc định không bật. Khách nhận vé 60 giây với user=0, write=false, public=true và access=phiên chia sẻ. Relay chỉ phát cho khách nếu phiên này khớp `public_access` do Django ký. Khi tắt/đổi link, relay ngắt khách trước khi phát lần cập nhật tiếp theo; API từ chối link cũ ngay. Khách không có quyền ghi, xem thông tin lớp, thành viên hoặc bài tập. Tắt tính năng không thể thu hồi những nội dung người xem đã tải trước đó.


## Cô lập và khởi động theo nhu cầu

Ở local, `tools/lazy_relay.py` thuộc launcher quản lý relay qua một cổng loopback có khóa ngẫu nhiên. Django chỉ gửi yêu cầu bật sau khi kiểm tra quyền truy cập bài giảng; request trả nhanh trong khi relay chuẩn bị nền. Nếu relay lỗi, lưu bảng và phần web khác tiếp tục hoạt động, Class dùng HTTP dự phòng. Ctrl+C ở launcher dừng các process do phiên đó tạo. Production vẫn deploy `Realtime/` như dịch vụ riêng, Django không sinh process hoặc dùng bộ điều phối local.

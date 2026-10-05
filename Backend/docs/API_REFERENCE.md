# Wortify API

Tài liệu từ URLconf và ví dụ đã khai báo. Không chứa thông tin xác thực thực tế.

## 1. Chọn địa chỉ API

Local mặc định: http://127.0.0.1:8000. Nếu dùng proxy frontend: http://127.0.0.1:5173. Production dùng HTTPS, ví dụ https://learn.example.com. baseUrl không có dấu / cuối và chưa gồm /api. Dùng cùng một origin trong suốt phiên; localhost và 127.0.0.1 là hai host khác nhau. Trang này chỉ đọc tài liệu, không tự gửi thử request.

## 2. Xác thực bằng session cookie

API hiện dùng session Django, không có Bearer token/API key cho người dùng. Trong Postman chọn No Auth và bật cookie jar. Gửi GET /api/session/ để nhận csrftoken, sau đó POST /api/session/ với username/password. Postman giữ sessionid tự động. Đăng nhập làm đổi CSRF token, vì vậy phải lấy lại csrftoken từ response đăng nhập. Không copy sessionid hay mật khẩu vào Git hoặc collection được chia sẻ.

## 3. CSRF cho request ghi

POST, PATCH và DELETE cần X-CSRFToken khớp cookie csrftoken, cùng cookie sessionid khi đã đăng nhập. Collection tải xuống tự lấy CSRF từ Set-Cookie sau mỗi response và đặt header cho request tiếp theo. Origin đặt bằng {{baseUrl}}; với HTTPS, Referer là {{baseUrl}}/. Production phải cho phép hostname qua DJANGO_ALLOWED_HOSTS và origin frontend qua DJANGO_CSRF_TRUSTED_ORIGINS. POST /api/monitor/ là ngoại lệ, dùng khóa máy chủ riêng và được miễn CSRF.

## 4. Nhập và dùng Postman

Tải Collection v2.1 rồi chọn Import trong Postman. Tạo Environment riêng với baseUrl, username, password; giữ password ở giá trị local hoặc Vault, không chia sẻ giá trị thật. Chạy thư mục 00 theo thứ tự: nhận CSRF → đăng nhập → kiểm tra phiên. Chọn từng request trong danh mục, thay pk/deck_id/token/item_id bằng ID thật. Các ID số mặc định 1 chỉ là ví dụ. Không chạy toàn bộ collection tự động vì có request thay đổi quyền và xóa dữ liệu. Collection không chứa credential thực tế. Không tạo biến Environment csrfToken/contentVersion/contentTitle vì sẽ che giá trị Collection tự cập nhật. eventToken cần UUID mới cho mỗi sự kiện (giữ nguyên khi retry), checkedAt dùng ISO8601 hiện tại có múi giờ, ví dụ 2026-10-05T10:00:00Z.

## 5. Luồng thử bộ thẻ

POST /api/en/decks/ với title, level=A1; lấy id trả về làm deck_id và pk. POST /api/en/decks/{deck_id}/cards/ với german_text và vietnamese_meaning. GET /api/en/decks/{pk}/ để kiểm tra thẻ vừa thêm. PATCH cùng URL để đổi tiêu đề. Các endpoint học chỉ truy cập dữ liệu của tài khoản đang đăng nhập, kể cả khi tài khoản đó là Admin.

## 6. Luồng biên tập và công bố

Dùng tài khoản Staff/Admin. POST /api/manage/content/ để tạo folder riêng tư, sau đó tạo theory/exercise có parent là thư mục cùng chủ sở hữu và ngôn ngữ. GET /api/manage/content/{pk}/ lấy version hiện tại trước PATCH/DELETE. PATCH công bố/ẩn cần visibility và reason; cascade=true áp dụng cho cả cây thư mục. HTTP 409 yêu cầu đọc lại bản mới rồi hợp nhất thay đổi; không tự ghi đè. DELETE yêu cầu version, confirm đúng tiêu đề và reason.

## 7. Phân quyền

Người dùng: dữ liệu học của mình, nội dung công khai hoặc lớp được giao. Staff: quản lý tài khoản thường, hỗ trợ dữ liệu của họ, biên tập nội dung học tập và media toàn hệ thống; không cấp quyền, quản lý tài khoản Staff/Admin hoặc cấu hình hệ thống. Admin: toàn bộ chức năng quản trị và phân quyền. API tài liệu, tình trạng hệ thống, nhật ký giám sát và giao diện chung chỉ dành Admin. Nhật ký workspace của Staff chỉ hiển thị thao tác của chính họ.

## 8. Định dạng và giới hạn

Giữ dấu / cuối URL. JSON dùng Content-Type: application/json; upload dùng form-data và để Postman tự đặt boundary. language chỉ en/de. Danh sách người dùng: 50/trang; nội dung, nhật ký workspace, dữ liệu người dùng: 25/trang. Media bài tập tối đa 200 MB, ảnh nền/theme 30 MB. Đồng bộ 1–100 sự kiện, token UUID ổn định khi retry; cần kiểm tra cả accepted và errors dù HTTP 200. File và audio trả binary, không parse như JSON.

## 9. Xử lý lỗi

400: dữ liệu/đăng nhập không hợp lệ; 401: thiếu phiên; 403: thiếu quyền hoặc CSRF; 404: không tồn tại hoặc ngoài phạm vi được phép; 405: sai method; 409: phiên bản/trạng thái xung đột; 413: proxy từ chối file lớn; 429: giới hạn báo cáo monitor; 503: probe database lỗi. Lỗi API thường có {"error":"…"}; lỗi proxy hoặc 405 có thể không phải JSON. Đọc status và Content-Type trước khi parse.

## Ví dụ: Tạo bài tập trong thư mục

POST /api/manage/content/

Staff/Admin: tạo folder trước và thay parent=1 bằng ID folder của chính tài khoản. Lưu riêng tư, xem trước rồi công bố. Đây là body bài viết lại câu tối thiểu.

```json
{
  "kind": "exercise",
  "title": "Chào hỏi",
  "language": "en",
  "parent": 1,
  "visibility": "private",
  "payload": {
    "title": "Chào hỏi",
    "kind": "text",
    "presentation": {
      "interaction": "short_answer"
    },
    "questions": [
      {
        "prompt": "Viết hello bằng tiếng Anh",
        "accepted_answers": [
          "hello"
        ],
        "options": [],
        "blanks": [],
        "presentation": {}
      }
    ]
  }
}
```

## Ví dụ: Cấp quyền Staff

PATCH /api/manage/users/{pk}/

Chỉ Admin. pk là ID tài khoản đích; đổi quyền đăng xuất các phiên hiện tại. Không được tự hạ quyền Admin đang sử dụng.

```json
{
  "role": "staff",
  "reason": "Bổ nhiệm nhân viên quản lý nội dung"
}
```

## Ví dụ: Khóa tài khoản

PATCH /api/manage/users/{pk}/

Staff chỉ nhắm tài khoản thường. is_active=false khóa đăng nhập và thu hồi phiên, không xóa dữ liệu. Mở lại bằng true.

```json
{
  "is_active": false,
  "reason": "Yêu cầu tạm khóa từ người dùng"
}
```

## Ví dụ: Đặt lại mật khẩu

PATCH /api/manage/users/{pk}/

Dùng biến Environment local newPassword, không ghi mật khẩu thật trong collection. Server áp dụng kiểm tra độ mạnh mật khẩu.

```json
{
  "password": "{{newPassword}}"
}
```

## Ví dụ: Công bố cả cây nội dung

PATCH /api/manage/content/{pk}/

GET chi tiết trước để lấy version. Collection cập nhật contentVersion từ response. Chọn pk của folder; cascade=true đổi trạng thái của toàn bộ mục con.

```json
{
  "version": "{{contentVersion}}",
  "visibility": "public",
  "cascade": true,
  "reason": "Đã duyệt bài và media"
}
```

## GET, POST /api/superuser-registration/{setup_key}/

**Quyền:** Public / session

Chỉ hoạt động khi setup_key khớp cấu hình SUPERUSER_SETUP_KEY (ít nhất 32 ký tự). Không nhúng khóa thật vào tài liệu. POST tạo Admin; dùng công cụ triển khai để tạo Admin nếu tính năng này tắt.

Body POST:

```json
{
  "username": "new-admin",
  "password1": "{{password}}",
  "password2": "{{password}}"
}
```

## GET /api/health/

**Quyền:** Public / session

Public GET, trả app=Wortify và workspace fingerprint để nhận diện instance local; không phải phép kiểm tra database. Dùng /api/health/check/ để kiểm tra database.

## GET, POST, DELETE /api/session/

**Quyền:** Public / session

GET cấp cookie CSRF và trả user/null. POST đăng nhập; đăng ký thường dùng register=true, username, password1, password2. DELETE đăng xuất phiên hiện tại. Đăng nhập sai trả 400, không phải 401.

Body POST:

```json
{
  "username": "{{username}}",
  "password": "{{password}}"
}
```

## GET /api/health/check/

**Quyền:** Public / session

Public, kiểm tra kết nối database; {ok:true} hoặc 503 {ok:false}.

## POST /api/monitor/

**Quyền:** Monitor key

Server-to-server: X-Wortify-Monitor-Key, không dùng session và không cần CSRF. checks 1–50; token UUID, at ISO8601 có timezone, ok boolean, latency_ms 0–60000, error rỗng/timeout/network/http/invalid-response. at trong 7 ngày gần đây, không quá 5 phút tương lai. Không đưa monitor secret vào frontend.

Body POST:

```json
{
  "checks": [
    {
      "token": "{{eventToken}}",
      "at": "{{checkedAt}}",
      "ok": true,
      "latency_ms": 50,
      "error": ""
    }
  ]
}
```

## GET /api/manage/monitor/

**Quyền:** Admin

Chỉ Admin. page 50/trang; failures=1 chỉ xem lỗi.

## GET, POST /api/themes/

**Quyền:** Người dùng đăng nhập

GET các theme truy cập được. POST multipart name, preferences (chuỗi JSON), shared=true/false; image tùy chọn. URL có pk để sửa theme. Mỗi tài khoản tối đa 5 theme, chỉ Staff/Admin tạo shared.

Multipart: name (text), preferences (text), shared (text)

## POST /api/themes/select/

**Quyền:** Người dùng đăng nhập

scope=en/de/both; theme_id=null trở về mặc định.

Body POST:

```json
{
  "scope": "both",
  "theme_id": null
}
```

## GET, POST /api/themes/{pk}/

**Quyền:** Người dùng đăng nhập

GET các theme truy cập được. POST multipart name, preferences (chuỗi JSON), shared=true/false; image tùy chọn. URL có pk để sửa theme. Mỗi tài khoản tối đa 5 theme, chỉ Staff/Admin tạo shared.

Multipart: name (text), preferences (text), shared (text)

## DELETE /api/themes/{pk}/delete/

**Quyền:** Người dùng đăng nhập

Chỉ người có quyền sửa theme. Xóa theme gỡ lựa chọn của các tài khoản liên quan.

## GET, HEAD /api/themes/{pk}/image/

**Quyền:** Người dùng đăng nhập

GET/HEAD trả ảnh binary của theme mà người dùng được truy cập. 404 khi không tồn tại/không có quyền/không có ảnh.

## GET /api/me/appearance/

**Quyền:** Người dùng đăng nhập

GET manifest ảnh/theme của phiên hiện tại cho cả tiếng Anh và tiếng Đức; dùng các URL trả về thay vì tự ghép đường dẫn tệp.

## GET, POST, DELETE /api/me/background/

**Quyền:** Người dùng đăng nhập

GET trạng thái; POST multipart image (PNG/JPG/WebP tối đa 30 MB); DELETE gỡ nền cá nhân.

Multipart: image (file)

## GET, HEAD /api/me/background/image/

**Quyền:** Người dùng đăng nhập

GET/HEAD ảnh nền riêng của tài khoản đang đăng nhập; trả binary và Cache-Control private,no-store.

## GET /api/manage/summary/

**Quyền:** Admin / Staff

Tổng quan công việc. Số tài khoản của Staff chỉ tính tài khoản thường; thống kê nội dung gồm nội dung học tập hệ thống.

## GET /api/manage/api-docs/

**Quyền:** Admin

Chỉ Admin. GET JSON để hiển thị trang; format=postman tải collection v2.1; format=markdown tải tài liệu. Chỉ chứa ví dụ và placeholder, không xuất secret hay dữ liệu tài khoản.

## GET /api/manage/activity/

**Quyền:** Admin / Staff

q và page, 25/trang. Admin xem toàn bộ; Staff chỉ xem nhật ký của chính mình. Không có API sửa/xóa audit.

## GET, POST /api/manage/content/

**Quyền:** Admin / Staff

GET q,language,kind,visibility,source=system/users/mine,owner,page (25/trang). GET options=folders trả thư mục của người đang đăng nhập. POST tạo nội dung của người thao tác; không chấp nhận owner từ client.

Body POST:

```json
{
  "kind": "folder",
  "title": "Thư mục hệ thống",
  "language": "en",
  "visibility": "private"
}
```

## GET, PATCH, DELETE /api/manage/content/{pk}/

**Quyền:** Admin / Staff

GET trả payload, folders, children, version. PATCH chỉ title,parent,payload,visibility,position,links; không đổi owner/language/kind. Bắt buộc version đọc gần nhất. Thay đổi công khai cần reason; cascade=true chỉ cho thư mục. DELETE cần version, confirm đúng tiêu đề, reason; xóa cả cây và dữ liệu liên quan.

Body PATCH:

```json
{
  "version": "{{contentVersion}}",
  "visibility": "public",
  "cascade": false,
  "reason": "Đã kiểm tra nội dung"
}
```

Body DELETE:

```json
{
  "version": "{{contentVersion}}",
  "confirm": "{{contentTitle}}",
  "reason": "Xóa bản thử nghiệm"
}
```

## POST /api/manage/content/{pk}/media/

**Quyền:** Admin / Staff

Multipart file; chỉ bài exercise. File được lưu dưới chủ sở hữu nội dung, kiểm tra định dạng như upload thông thường. Gắn media trả về vào payload.attachments khi lưu bài.

Multipart: file (file)

## GET /api/manage/overview/

**Quyền:** Admin

Chỉ Admin: thống kê tài khoản/nội dung, kết nối database, migration, runtime và nhật ký. Không trả cấu hình chứa secret.

## GET, DELETE /api/manage/users/{pk}/data/

**Quyền:** Admin / Staff

GET danh sách collections và số lượng. DELETE xóa dữ liệu học/hồ sơ nhưng giữ tài khoản; confirm phải khớp username. Chỉ nhắm tài khoản thường khác.

Body DELETE:

```json
{
  "confirm": "{{targetUsername}}"
}
```

## GET, PATCH, DELETE /api/manage/users/{pk}/data/{kind}/

**Quyền:** Admin / Staff

kind là collection trong GET data/: decks,cards,folders,practice,classes,... GET danh sách trả fields và can_create để dựng biểu mẫu. POST vào danh sách, PATCH/DELETE vào item_id. Ví dụ body bên dưới áp dụng kind=decks; các collection khác theo fields. Quan hệ phải cùng chủ sở hữu/ngôn ngữ; không được sửa auth hoặc đường dẫn tệp.

Body PATCH:

```json
{
  "title": "Tiêu đề mới"
}
```

## GET, PATCH, DELETE /api/manage/users/{pk}/data/{kind}/{item_id}/

**Quyền:** Admin / Staff

kind là collection trong GET data/: decks,cards,folders,practice,classes,... GET danh sách trả fields và can_create để dựng biểu mẫu. POST vào danh sách, PATCH/DELETE vào item_id. Ví dụ body bên dưới áp dụng kind=decks; các collection khác theo fields. Quan hệ phải cùng chủ sở hữu/ngôn ngữ; không được sửa auth hoặc đường dẫn tệp.

Body PATCH:

```json
{
  "title": "Tiêu đề mới"
}
```

## GET, POST /api/manage/users/

**Quyền:** Admin / Staff

GET q, role=user/staff/superuser, status=active/inactive, sort=username/newest/recent, page. 50/trang. POST cần username,password; email,first_name,last_name tùy chọn. Staff chỉ tạo user, Admin mới cấp staff/superuser.

Body POST:

```json
{
  "username": "postman-user",
  "email": "example@example.com",
  "password": "{{newPassword}}",
  "role": "user"
}
```

## GET, PATCH, DELETE /api/manage/users/{pk}/

**Quyền:** Admin / Staff

GET nhật ký tài khoản. PATCH username,email,first_name,last_name,password,role,is_active,revoke_sessions,reason. Staff chỉ nhắm tài khoản thường. Không tự khóa/xóa/hạ quyền và phải giữ Admin hoạt động. Đổi quyền/mật khẩu thu hồi phiên; mật khẩu không ghi vào nhật ký. DELETE cần confirm tên và reason 3–500 ký tự.

Body PATCH:

```json
{
  "role": "staff"
}
```

Body DELETE:

```json
{
  "confirm": "{{targetUsername}}",
  "reason": "Xóa tài khoản thử nghiệm"
}
```

## GET, POST, DELETE /api/manage/appearance/

**Quyền:** Admin

Chỉ Admin. GET trạng thái, POST multipart background_image (PNG/JPG/WebP tối đa 30 MB), DELETE gỡ ảnh chung.

Multipart: background_image (file)

## GET /api/site/appearance/

**Quyền:** Người dùng đăng nhập

GET thông tin ảnh nền dùng chung, vẫn yêu cầu đăng nhập; trả background_image và background_url nếu có.

## GET /api/site/appearance/image/

**Quyền:** Người dùng đăng nhập

GET ảnh nền chung dưới dạng binary, cần đăng nhập. Không có quyền sửa ảnh qua endpoint này.

## GET, PATCH /api/{language}/profile/

**Quyền:** Người dùng đăng nhập

GET hồ sơ/thống kê học tập theo language. PATCH display_name (tối đa 100 ký tự), bio (2000 ký tự), daily_goal (số nguyên 1–500). Không dùng để sửa quyền hoặc mật khẩu.

Body PATCH:

```json
{
  "display_name": "Người học",
  "bio": "Giới thiệu",
  "daily_goal": 20
}
```

## GET, POST /api/{language}/classes/

**Quyền:** Người dùng đăng nhập

POST title tạo lớp; POST invite tham gia lớp. GET chỉ các lớp sở hữu hoặc tham gia.

Body POST:

```json
{
  "title": "Lớp tiếng Anh"
}
```

## GET, PATCH, DELETE /api/{language}/classes/{pk}/

**Quyền:** Người dùng đăng nhập

GET cho chủ lớp/thành viên; PATCH/DELETE chỉ chủ lớp. PATCH remove_member với ID để bỏ thành viên.

Body PATCH:

```json
{
  "title": "Lớp A1"
}
```

## POST, DELETE /api/{language}/classes/{pk}/assignments/

**Quyền:** Người dùng đăng nhập

Chỉ chủ lớp. POST node + due_at (ISO8601 hoặc null). DELETE {id} là ID bài giao, không phải ID node.

Body POST:

```json
{
  "node": 1,
  "due_at": null
}
```

Body DELETE:

```json
{
  "id": 1
}
```

## POST /api/{language}/practice-hub/nodes/{pk}/copy/

**Quyền:** Người dùng đăng nhập

Sao chép bộ nội dung được phép truy cập thành bản thuộc tài khoản hiện tại. Nội dung/mối liên kết được kiểm tra tại API.

## GET, PATCH /api/{language}/decks/{pk}/review/

**Quyền:** Người dùng đăng nhập

GET hàng đợi ôn, config, due,new,reviewed_today,next_due,forecast,cards,difficult. PATCH retention=0.8–0.97, new_limit/review_limit=0–500 và adapt_time boolean; chỉ bộ thẻ thuộc tài khoản.

Body PATCH:

```json
{
  "retention": 0.9,
  "new_limit": 20,
  "review_limit": 100,
  "adapt_time": true
}
```

## POST /api/{language}/practice-hub/media/

**Quyền:** Người dùng đăng nhập

Multipart: file, tối đa 200 MB; MP3/PNG/JPG/JPEG/WebP/GIF. Response media có id/name/size/type/url. Đưa media vào payload.attachments để gắn với bài.

Multipart: file (file)

## GET, HEAD /api/{language}/practice-hub/media/{pk}/

**Quyền:** Người dùng đăng nhập

Trả binary có kiểm tra quyền. Hỗ trợ GET/HEAD và Range bytes; 206 khi đọc một phần. Staff/Admin được đọc media cho công việc biên tập.

## GET /api/{language}/practice-hub/explore/

**Quyền:** Người dùng đăng nhập

Danh mục nội dung công khai có lọc/tìm kiếm; vẫn cần đăng nhập.

## GET, POST /api/{language}/practice-hub/nodes/

**Quyền:** Người dùng đăng nhập

GET metadata; full=1 thêm payload. POST kind=folder/exercise/theory, title, parent, payload, visibility. Exercise bắt buộc nằm trong folder cùng chủ sở hữu/ngôn ngữ. Xem Backend/sample_data để xem các mẫu dạng bài.

Body POST:

```json
{
  "kind": "folder",
  "title": "Bài học mới",
  "visibility": "private"
}
```

## GET, PATCH, DELETE /api/{language}/practice-hub/nodes/{pk}/

**Quyền:** Người dùng đăng nhập

Đọc theo quyền sở hữu/công khai/lớp được giao. PATCH/DELETE của API học chỉ dành chủ sở hữu. Nhân viên biên tập dùng /api/manage/content/{pk}/.

Body PATCH:

```json
{
  "title": "Tên bài mới"
}
```

## POST /api/{language}/practice-hub/import/

**Quyền:** Người dùng đăng nhập

Tối đa 100 mục gốc, 500 mục tổng; lỗi hoàn tác toàn bộ. links dùng các ID nội dung mà người dùng được truy cập.

Body POST:

```json
{
  "nodes": [
    {
      "kind": "folder",
      "title": "Bài nhập",
      "children": [
        {
          "kind": "theory",
          "title": "Chào hỏi",
          "payload": {
            "format": "markdown",
            "content": "# Hello"
          }
        }
      ]
    }
  ]
}
```

## POST /api/{language}/practice-hub/organize/

**Quyền:** Người dùng đăng nhập

Thao tác sắp xếp/di chuyển cây của chính người dùng. parent=null là gốc; không được tạo chu trình hoặc trộn ngôn ngữ.

Body POST:

```json
{
  "ids": [
    1
  ],
  "parent": null
}
```

## POST /api/{language}/learning/sync/

**Quyền:** Người dùng đăng nhập

1–100 events; mỗi event có UUID token, kind, payload. kind gồm preferences, study_settings, practice_progress, practice, review, test, star, options. preferences cần at dạng ISO8601 có múi giờ. payload hỗ trợ navScale=50–150, ambient boolean, volume=0–1 và ambientTrack=morning/marimba/picnic/bubbles/cafe/garden/puzzle/clouds/starlight/steps. Retry cùng token giữ tính idempotent; HTTP 200 có thể chứa errors từng mục.

Body POST:

```json
{
  "events": [
    {
      "token": "{{eventToken}}",
      "kind": "study_settings",
      "payload": {
        "new_cards_per_day": 20
      }
    }
  ]
}
```

## GET /api/{language}/decks/{pk}/learning/

**Quyền:** Người dùng đăng nhập

GET trạng thái học đã đồng bộ của bộ thẻ đang sở hữu; dùng /learning/sync/ để gửi thay đổi thay vì PATCH endpoint này.

## GET, PATCH /api/{language}/settings/

**Quyền:** Người dùng đăng nhập

GET/PATCH cài đặt học theo ngôn ngữ. Các trường gồm autoplay,ignore_case,ignore_punctuation,transliteration,new_cards_per_day,session_minutes. Giá trị boolean phải là JSON boolean.

Body PATCH:

```json
{
  "new_cards_per_day": 20,
  "session_minutes": 15
}
```

## GET, POST /api/{language}/decks/

**Quyền:** Người dùng đăng nhập

GET trả decks, folders, due, resume. POST cần title; level mặc định A1, folder tùy chọn phải thuộc cùng người dùng/ngôn ngữ. ID tạo mới nằm ở trường id.

Body POST:

```json
{
  "title": "Postman demo",
  "level": "A1",
  "description": "Bộ thẻ thử nghiệm"
}
```

## GET, PATCH, DELETE /api/{language}/decks/{pk}/

**Quyền:** Người dùng đăng nhập

GET trả deck, cards, folders, learning và study_defaults. PATCH giữ ngôn ngữ. DELETE xóa bộ thẻ và dữ liệu phụ thuộc.

Body PATCH:

```json
{
  "title": "Tiêu đề mới"
}
```

## GET /api/{language}/study-pack/

**Quyền:** Người dùng đăng nhập

Query deck tùy chọn và filter; chỉ trả các thẻ người dùng sở hữu.

## POST /api/{language}/decks/{pk}/reorder/

**Quyền:** Người dùng đăng nhập

ids phải chứa mọi ID thẻ của bộ đúng một lần.

Body POST:

```json
{
  "ids": [
    1,
    2
  ]
}
```

## POST /api/{language}/decks/{pk}/import/

**Quyền:** Người dùng đăng nhập

Hai bước: gửi text+separator nhận token/count/preview, sau đó POST {"token":"UUID nhận được"} để xác nhận. Preview hết hạn sau 30 phút; gửi lại token đã xác nhận không nhân bản.

Body POST:

```json
{
  "text": "hello,xin chào\nbook,quyển sách",
  "separator": ","
}
```

## POST /api/{language}/decks/{deck_id}/cards/

**Quyền:** Người dùng đăng nhập

Tạo thẻ ở URL danh sách; sửa/xóa ở URL có pk. german_text là từ cần học cho cả EN/DE. Bắt buộc german_text và vietnamese_meaning. Danh sách thẻ được đọc từ chi tiết bộ thẻ.

Body POST:

```json
{
  "german_text": "hello",
  "vietnamese_meaning": "xin chào"
}
```

## PATCH, DELETE /api/{language}/decks/{deck_id}/cards/{pk}/

**Quyền:** Người dùng đăng nhập

Tạo thẻ ở URL danh sách; sửa/xóa ở URL có pk. german_text là từ cần học cho cả EN/DE. Bắt buộc german_text và vietnamese_meaning. Danh sách thẻ được đọc từ chi tiết bộ thẻ.

Body PATCH:

```json
{
  "vietnamese_meaning": "chào bạn"
}
```

## POST /api/{language}/folders/

**Quyền:** Người dùng đăng nhập

Tạo ở URL danh sách; sửa/xóa ở URL có pk. Không có GET danh sách folder riêng; đọc folders trong GET /api/{language}/decks/. parent thuộc cùng chủ sở hữu/ngôn ngữ.

Body POST:

```json
{
  "name": "Từ vựng",
  "parent": null
}
```

## PATCH, DELETE /api/{language}/folders/{pk}/

**Quyền:** Người dùng đăng nhập

Tạo ở URL danh sách; sửa/xóa ở URL có pk. Không có GET danh sách folder riêng; đọc folders trong GET /api/{language}/decks/. parent thuộc cùng chủ sở hữu/ngôn ngữ.

Body PATCH:

```json
{
  "name": "Từ vựng A1"
}
```

## POST /api/{language}/sessions/

**Quyền:** Người dùng đăng nhập

kind=flash/learn/test; count 1–100; deck tùy chọn. Cần có thẻ phù hợp. Response chứa token phiên và các câu hỏi.

Body POST:

```json
{
  "kind": "learn",
  "deck": 1,
  "count": 10
}
```

## GET /api/{language}/sessions/{token}/

**Quyền:** Người dùng đăng nhập

GET phiên học bằng UUID token của chính tài khoản/ngôn ngữ. Không dùng ID số. Phiên test chưa nộp không trả đáp án.

## POST /api/{language}/sessions/{token}/answer/

**Quyền:** Người dùng đăng nhập

question phải là token câu hiện tại trong phiên; chỉ dùng cho flash/learn. Test nộp qua finish. response_ms tùy chọn.

Body POST:

```json
{
  "question": "{{questionToken}}",
  "answer": "hello",
  "response_ms": 1500
}
```

## POST /api/{language}/sessions/{token}/finish/

**Quyền:** Người dùng đăng nhập

Nộp answers ánh xạ question token sang đáp án; không dùng ID thẻ. Gửi lại phiên đã chấm trả kết quả cũ.

Body POST:

```json
{
  "answers": {
    "{{questionToken}}": "hello"
  }
}
```

## GET /api/{language}/decks/{pk}/export/{fmt}/

**Quyền:** Người dùng đăng nhập

fmt=json hoặc csv; response là tệp tải xuống của bộ thẻ thuộc người dùng.

## POST /api/{language}/next/

**Quyền:** Người dùng đăng nhập

deck, mode, filter tùy chọn; JSON được adapter chuyển sang form. Trả câu/token để submit.

Body POST:

```json
{
  "deck": 1,
  "mode": "write",
  "filter": "all"
}
```

## GET /api/{language}/question/{token}/

**Quyền:** Người dùng đăng nhập

GET câu hỏi theo UUID token thuộc tài khoản và ngôn ngữ hiện tại. Không truy cập token của tài khoản khác hoặc token thuộc phiên test chưa nộp.

## POST /api/{language}/submit/{token}/

**Quyền:** Người dùng đăng nhập

POST answer là đáp án văn bản cho token câu hỏi, response_ms tùy chọn. Server chấm và lưu tiến độ; gửi lại token hoàn thành không chấm trùng.

Body POST:

```json
{
  "answer": "hello"
}
```

## POST /api/{language}/audio/{token}/

**Quyền:** Người dùng đăng nhập

Tạo/lấy TTS cho câu hỏi; phụ thuộc cấu hình speech ở backend. type=term/example, slow=1 tùy chọn.

Body POST:

```json
{
  "type": "term",
  "slow": "0"
}
```

## GET /api/{language}/audio-file/{pk}/

**Quyền:** Người dùng đăng nhập

GET audio binary theo ID bản âm thanh đã tạo; chỉ tài khoản sở hữu thẻ. URL thường nhận từ response tạo TTS.

## POST /api/{language}/cards/{pk}/audio/

**Quyền:** Người dùng đăng nhập

TTS cho thẻ của người dùng; type=term/example.

Body POST:

```json
{
  "type": "term"
}
```

## POST /api/{language}/speaking/{token}/

**Quyền:** Người dùng đăng nhập

Multipart audio + consent=yes. Bản ghi tối đa 10 MB/60 giây; nhà cung cấp speech phải được cấu hình ở backend. Không tự gửi ghi âm khi chưa có đồng ý.

Multipart: audio (file), consent (text)

## POST /api/{language}/retry/{token}/

**Quyền:** Người dùng đăng nhập

POST thử lại câu hỏi bằng token hợp lệ; token phải thuộc tài khoản/ngôn ngữ. Không cần body ngoài JSON rỗng.

## POST /api/{language}/match/{pk}/new/

**Quyền:** Người dùng đăng nhập

POST tạo lượt ghép từ bộ thẻ pk của mình. weak=1 lọc thẻ yếu; resume là UUID để tiếp tục lượt ghép hiện có. Gửi pairs tới /match/{token}/submit/ để chấm.

Body POST:

```json
{
  "weak": "0"
}
```

## POST /api/{language}/match/{token}/submit/

**Quyền:** Người dùng đăng nhập

pairs ánh xạ ID/token của lượt ghép theo dữ liệu match/new. JSON được adapter chuyển đổi.

Body POST:

```json
{
  "pairs": {
    "1": "2"
  }
}
```

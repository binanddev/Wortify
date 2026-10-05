"""Admin-only API reference and portable Postman collection, derived from URLconf."""
import ast
import inspect
import json
import re
import textwrap
from django.http import HttpResponse, JsonResponse
from django.urls import get_resolver
from django.views.decorators.http import require_http_methods
from .management import management

GUIDE = [
    {'title': '1. Chọn địa chỉ API', 'text': 'Local mặc định: http://127.0.0.1:8000. Nếu dùng proxy frontend: http://127.0.0.1:5173. Production dùng HTTPS, ví dụ https://learn.example.com. baseUrl không có dấu / cuối và chưa gồm /api. Dùng cùng một origin trong suốt phiên; localhost và 127.0.0.1 là hai host khác nhau. Trang này chỉ đọc tài liệu, không tự gửi thử request.'},
    {'title': '2. Xác thực bằng session cookie', 'text': 'API hiện dùng session Django, không có Bearer token/API key cho người dùng. Trong Postman chọn No Auth và bật cookie jar. Gửi GET /api/session/ để nhận csrftoken, sau đó POST /api/session/ với username/password. Postman giữ sessionid tự động. Đăng nhập làm đổi CSRF token, vì vậy phải lấy lại csrftoken từ response đăng nhập. Không copy sessionid hay mật khẩu vào Git hoặc collection được chia sẻ.'},
    {'title': '3. CSRF cho request ghi', 'text': 'POST, PATCH và DELETE cần X-CSRFToken khớp cookie csrftoken, cùng cookie sessionid khi đã đăng nhập. Collection tải xuống tự lấy CSRF từ Set-Cookie sau mỗi response và đặt header cho request tiếp theo. Origin đặt bằng {{baseUrl}}; với HTTPS, Referer là {{baseUrl}}/. Production phải cho phép hostname qua DJANGO_ALLOWED_HOSTS và origin frontend qua DJANGO_CSRF_TRUSTED_ORIGINS. POST /api/monitor/ là ngoại lệ, dùng khóa máy chủ riêng và được miễn CSRF.'},
    {'title': '4. Nhập và dùng Postman', 'text': 'Tải Collection v2.1 rồi chọn Import trong Postman. Tạo Environment riêng với baseUrl, username, password; giữ password ở giá trị local hoặc Vault, không chia sẻ giá trị thật. Chạy thư mục 00 theo thứ tự: nhận CSRF → đăng nhập → kiểm tra phiên. Chọn từng request trong danh mục, thay pk/deck_id/token/item_id bằng ID thật. Các ID số mặc định 1 chỉ là ví dụ. Không chạy toàn bộ collection tự động vì có request thay đổi quyền và xóa dữ liệu. Collection không chứa credential thực tế. Không tạo biến Environment csrfToken/contentVersion/contentTitle vì sẽ che giá trị Collection tự cập nhật. eventToken cần UUID mới cho mỗi sự kiện (giữ nguyên khi retry), checkedAt dùng ISO8601 hiện tại có múi giờ, ví dụ 2026-10-05T10:00:00Z.'},
    {'title': '5. Luồng thử bộ thẻ', 'text': 'POST /api/en/decks/ với title, level=A1; lấy id trả về làm deck_id và pk. POST /api/en/decks/{deck_id}/cards/ với german_text và vietnamese_meaning. GET /api/en/decks/{pk}/ để kiểm tra thẻ vừa thêm. PATCH cùng URL để đổi tiêu đề. Các endpoint học chỉ truy cập dữ liệu của tài khoản đang đăng nhập, kể cả khi tài khoản đó là Admin.'},
    {'title': '6. Luồng biên tập và công bố', 'text': 'Dùng tài khoản Staff/Admin. POST /api/manage/content/ để tạo folder riêng tư, sau đó tạo theory/exercise có parent là thư mục cùng chủ sở hữu và ngôn ngữ. GET /api/manage/content/{pk}/ lấy version hiện tại trước PATCH/DELETE. PATCH công bố/ẩn cần visibility và reason; cascade=true áp dụng cho cả cây thư mục. HTTP 409 yêu cầu đọc lại bản mới rồi hợp nhất thay đổi; không tự ghi đè. DELETE yêu cầu version, confirm đúng tiêu đề và reason.'},
    {'title': '7. Phân quyền', 'text': 'Người dùng: dữ liệu học của mình, nội dung công khai hoặc lớp được giao. Staff: quản lý tài khoản thường, hỗ trợ dữ liệu của họ, biên tập nội dung học tập và media toàn hệ thống; không cấp quyền, quản lý tài khoản Staff/Admin hoặc cấu hình hệ thống. Admin: toàn bộ chức năng quản trị và phân quyền. API tài liệu, tình trạng hệ thống, nhật ký giám sát và giao diện chung chỉ dành Admin. Nhật ký workspace của Staff chỉ hiển thị thao tác của chính họ.'},
    {'title': '8. Định dạng và giới hạn', 'text': 'Giữ dấu / cuối URL. JSON dùng Content-Type: application/json; upload dùng form-data và để Postman tự đặt boundary. language chỉ en/de. Danh sách người dùng: 50/trang; nội dung, nhật ký workspace, dữ liệu người dùng: 25/trang. Media bài tập tối đa 200 MB, ảnh nền/theme 30 MB. Đồng bộ 1–100 sự kiện, token UUID ổn định khi retry; cần kiểm tra cả accepted và errors dù HTTP 200. File và audio trả binary, không parse như JSON.'},
    {'title': '9. Xử lý lỗi', 'text': '400: dữ liệu/đăng nhập không hợp lệ; 401: thiếu phiên; 403: thiếu quyền hoặc CSRF; 404: không tồn tại hoặc ngoài phạm vi được phép; 405: sai method; 409: phiên bản/trạng thái xung đột; 413: proxy từ chối file lớn; 429: giới hạn báo cáo monitor; 503: probe database lỗi. Lỗi API thường có {"error":"…"}; lỗi proxy hoặc 405 có thể không phải JSON. Đọc status và Content-Type trước khi parse.'},
]

# Examples are deliberately inert: placeholders and illustrative IDs, no secrets.
EXAMPLES = {
    'users.views.session': {'POST': {'username':'{{username}}','password':'{{password}}'}, 'response': {'user':{'id':1,'username':'example','staff':False,'superuser':False,'preferences':{},'appearance_session':'opaque-session-value'}}},
    'users.views.superuser_registration': {'POST':{'username':'new-admin','password1':'{{password}}','password2':'{{password}}'}},
    'api.views.decks': {'POST':{'title':'Postman demo','level':'A1','description':'Bộ thẻ thử nghiệm'}, 'response':{'id':1}},
    'api.views.deck': {'PATCH':{'title':'Tiêu đề mới'}},
    'api.views.card': {'POST':{'german_text':'hello','vietnamese_meaning':'xin chào'}, 'PATCH':{'vietnamese_meaning':'chào bạn'}},
    'api.views.folder': {'POST':{'name':'Từ vựng','parent':None},'PATCH':{'name':'Từ vựng A1'}},
    'api.views.preferences': {'PATCH':{'new_cards_per_day':20,'session_minutes':15}},
    'api.spaced_review.review_queue': {'PATCH':{'retention':0.9,'new_limit':20,'review_limit':100,'adapt_time':True}},
    'api.views.import_cards': {'POST':{'text':'hello,xin chào\nbook,quyển sách','separator':','}},
    'api.views.reorder_cards': {'POST':{'ids':[1,2]}},
    'api.community.profile': {'PATCH':{'display_name':'Người học','bio':'Giới thiệu','daily_goal':20}},
    'api.community.classes': {'POST':{'title':'Lớp tiếng Anh'}},
    'api.community.classroom': {'PATCH':{'title':'Lớp A1'}},
    'api.community.classroom_assignments': {'POST':{'node':1,'due_at':None},'DELETE':{'id':1}},
    'api.practice_hub.nodes': {'POST':{'kind':'folder','title':'Bài học mới','visibility':'private'}},
    'api.practice_hub.node': {'PATCH':{'title':'Tên bài mới'}},
    'api.practice_hub.import_nodes': {'POST':{'nodes':[{'kind':'folder','title':'Bài nhập','children':[{'kind':'theory','title':'Chào hỏi','payload':{'format':'markdown','content':'# Hello'}}]}]}},
    'api.practice_hub.organize': {'POST':{'ids':[1],'parent':None}},
    'api.sessions.create': {'POST':{'kind':'learn','deck':1,'count':10}},
    'api.sessions.answer': {'POST':{'question':'{{questionToken}}','answer':'hello','response_ms':1500}},
    'api.sessions.finish_test': {'POST':{'answers':{'{{questionToken}}':'hello'}}},
    'api.learning_sync.sync': {'POST':{'events':[{'token':'{{eventToken}}','kind':'study_settings','payload':{'new_cards_per_day':20}}]}, 'response':{'accepted':[{'token':'example-uuid','result':{'saved':True}}],'errors':[]}},
    'api.management.users': {'POST':{'username':'postman-user','email':'example@example.com','password':'{{newPassword}}','role':'user'}},
    'api.management.user_detail': {'PATCH':{'role':'staff'},'DELETE':{'confirm':'{{targetUsername}}','reason':'Xóa tài khoản thử nghiệm'}},
    'api.management_data.user_data': {'DELETE':{'confirm':'{{targetUsername}}'}},
    'api.management_data.records': {'POST':{'title':'Bộ thẻ hỗ trợ','language':'en','level':'A1'},'PATCH':{'title':'Tiêu đề mới'}},
    'api.management_center.content': {'POST':{'kind':'folder','title':'Thư mục hệ thống','language':'en','visibility':'private'}},
    'api.management_center.content_detail': {'PATCH':{'version':'{{contentVersion}}','visibility':'public','cascade':False,'reason':'Đã kiểm tra nội dung'},'DELETE':{'version':'{{contentVersion}}','confirm':'{{contentTitle}}','reason':'Xóa bản thử nghiệm'}},
    'api.themes.select_theme': {'POST':{'scope':'both','theme_id':None}},
    'api.card_learning.next_question': {'POST':{'deck':1,'mode':'write','filter':'all'}},
    'api.card_learning.submit': {'POST':{'answer':'hello'}},
    'api.card_learning.audio': {'POST':{'type':'term','slow':'0'}},
    'api.card_learning.card_audio': {'POST':{'type':'term'}},
    'api.card_learning.match_new': {'POST':{'weak':'0'}},
    'api.card_learning.match_submit': {'POST':{'pairs':{'1':'2'}}},
    'api.monitoring.report': {'POST':{'checks':[{'token':'{{eventToken}}','at':'{{checkedAt}}','ok':True,'latency_ms':50,'error':''}]}},
}

NOTES = {
    'config.urls.health': 'Public GET, trả app=Wortify và workspace fingerprint để nhận diện instance local; không phải phép kiểm tra database. Dùng /api/health/check/ để kiểm tra database.',
    'api.themes.theme_image': 'GET/HEAD trả ảnh binary của theme mà người dùng được truy cập. 404 khi không tồn tại/không có quyền/không có ảnh.',
    'api.themes.manifest': 'GET manifest ảnh/theme của phiên hiện tại cho cả tiếng Anh và tiếng Đức; dùng các URL trả về thay vì tự ghép đường dẫn tệp.',
    'api.personal_appearance.image': 'GET/HEAD ảnh nền riêng của tài khoản đang đăng nhập; trả binary và Cache-Control private,no-store.',
    'api.management.public_appearance': 'GET thông tin ảnh nền dùng chung, vẫn yêu cầu đăng nhập; trả background_image và background_url nếu có.',
    'api.management.site_appearance_image': 'GET ảnh nền chung dưới dạng binary, cần đăng nhập. Không có quyền sửa ảnh qua endpoint này.',
    'api.community.profile': 'GET hồ sơ/thống kê học tập theo language. PATCH display_name (tối đa 100 ký tự), bio (2000 ký tự), daily_goal (số nguyên 1–500). Không dùng để sửa quyền hoặc mật khẩu.',
    'api.spaced_review.review_queue': 'GET hàng đợi ôn, config, due,new,reviewed_today,next_due,forecast,cards,difficult. PATCH retention=0.8–0.97, new_limit/review_limit=0–500 và adapt_time boolean; chỉ bộ thẻ thuộc tài khoản.',
    'api.learning_sync.deck_state': 'GET trạng thái học đã đồng bộ của bộ thẻ đang sở hữu; dùng /learning/sync/ để gửi thay đổi thay vì PATCH endpoint này.',
    'api.views.preferences': 'GET/PATCH cài đặt học theo ngôn ngữ. Các trường gồm autoplay,ignore_case,ignore_punctuation,transliteration,new_cards_per_day,session_minutes. Giá trị boolean phải là JSON boolean.',
    'api.sessions.detail': 'GET phiên học bằng UUID token của chính tài khoản/ngôn ngữ. Không dùng ID số. Phiên test chưa nộp không trả đáp án.',
    'api.card_learning.resume_question': 'GET câu hỏi theo UUID token thuộc tài khoản và ngôn ngữ hiện tại. Không truy cập token của tài khoản khác hoặc token thuộc phiên test chưa nộp.',
    'api.card_learning.submit': 'POST answer là đáp án văn bản cho token câu hỏi, response_ms tùy chọn. Server chấm và lưu tiến độ; gửi lại token hoàn thành không chấm trùng.',
    'api.card_learning.tts_file': 'GET audio binary theo ID bản âm thanh đã tạo; chỉ tài khoản sở hữu thẻ. URL thường nhận từ response tạo TTS.',
    'api.card_learning.retry': 'POST thử lại câu hỏi bằng token hợp lệ; token phải thuộc tài khoản/ngôn ngữ. Không cần body ngoài JSON rỗng.',
    'api.card_learning.match_new': 'POST tạo lượt ghép từ bộ thẻ pk của mình. weak=1 lọc thẻ yếu; resume là UUID để tiếp tục lượt ghép hiện có. Gửi pairs tới /match/{token}/submit/ để chấm.',
    'users.views.session': 'GET cấp cookie CSRF và trả user/null. POST đăng nhập; đăng ký thường dùng register=true, username, password1, password2. DELETE đăng xuất phiên hiện tại. Đăng nhập sai trả 400, không phải 401.',
    'users.views.superuser_registration': 'Chỉ hoạt động khi setup_key khớp cấu hình SUPERUSER_SETUP_KEY (ít nhất 32 ký tự). Không nhúng khóa thật vào tài liệu. POST tạo Admin; dùng công cụ triển khai để tạo Admin nếu tính năng này tắt.',
    'api.views.decks': 'GET trả decks, folders, due, resume. POST cần title; level mặc định A1, folder tùy chọn phải thuộc cùng người dùng/ngôn ngữ. ID tạo mới nằm ở trường id.',
    'api.views.deck': 'GET trả deck, cards, folders, learning và study_defaults. PATCH giữ ngôn ngữ. DELETE xóa bộ thẻ và dữ liệu phụ thuộc.',
    'api.views.card': 'Tạo thẻ ở URL danh sách; sửa/xóa ở URL có pk. german_text là từ cần học cho cả EN/DE. Bắt buộc german_text và vietnamese_meaning. Danh sách thẻ được đọc từ chi tiết bộ thẻ.',
    'api.views.folder': 'Tạo ở URL danh sách; sửa/xóa ở URL có pk. Không có GET danh sách folder riêng; đọc folders trong GET /api/{language}/decks/. parent thuộc cùng chủ sở hữu/ngôn ngữ.',
    'api.views.import_cards': 'Hai bước: gửi text+separator nhận token/count/preview, sau đó POST {"token":"UUID nhận được"} để xác nhận. Preview hết hạn sau 30 phút; gửi lại token đã xác nhận không nhân bản.',
    'api.views.reorder_cards': 'ids phải chứa mọi ID thẻ của bộ đúng một lần.',
    'api.views.study_pack': 'Query deck tùy chọn và filter; chỉ trả các thẻ người dùng sở hữu.',
    'api.practice_hub.nodes': 'GET metadata; full=1 thêm payload. POST kind=folder/exercise/theory, title, parent, payload, visibility. Exercise bắt buộc nằm trong folder cùng chủ sở hữu/ngôn ngữ. Xem Backend/sample_data để xem các mẫu dạng bài.',
    'api.practice_hub.node': 'Đọc theo quyền sở hữu/công khai/lớp được giao. PATCH/DELETE của API học chỉ dành chủ sở hữu. Nhân viên biên tập dùng /api/manage/content/{pk}/.',
    'api.practice_hub.import_nodes': 'Tối đa 100 mục gốc, 500 mục tổng; lỗi hoàn tác toàn bộ. links dùng các ID nội dung mà người dùng được truy cập.',
    'api.practice_hub.organize': 'Thao tác sắp xếp/di chuyển cây của chính người dùng. parent=null là gốc; không được tạo chu trình hoặc trộn ngôn ngữ.',
    'api.practice_copy.copy_collection': 'Sao chép bộ nội dung được phép truy cập thành bản thuộc tài khoản hiện tại. Nội dung/mối liên kết được kiểm tra tại API.',
    'api.practice_hub.explore': 'Danh mục nội dung công khai có lọc/tìm kiếm; vẫn cần đăng nhập.',
    'api.practice_media.upload': 'Multipart: file, tối đa 200 MB; MP3/PNG/JPG/JPEG/WebP/GIF. Response media có id/name/size/type/url. Đưa media vào payload.attachments để gắn với bài.',
    'api.practice_media.content': 'Trả binary có kiểm tra quyền. Hỗ trợ GET/HEAD và Range bytes; 206 khi đọc một phần. Staff/Admin được đọc media cho công việc biên tập.',
    'api.learning_sync.sync': '1–100 events; mỗi event có UUID token, kind, payload. kind gồm preferences, study_settings, practice_progress, practice, review, test, star, options. preferences cần at dạng ISO8601 có múi giờ. payload hỗ trợ interface=studio/glass (Studio mặc định), navScale=50–150, ambient boolean, volume=0–1 và ambientTrack=morning/marimba/picnic/bubbles/cafe/garden/puzzle/clouds/starlight/steps. Retry cùng token giữ tính idempotent; HTTP 200 có thể chứa errors từng mục.',
    'api.sessions.create': 'kind=flash/learn/test; count 1–100; deck tùy chọn. Cần có thẻ phù hợp. Response chứa token phiên và các câu hỏi.',
    'api.sessions.answer': 'question phải là token câu hiện tại trong phiên; chỉ dùng cho flash/learn. Test nộp qua finish. response_ms tùy chọn.',
    'api.sessions.finish_test': 'Nộp answers ánh xạ question token sang đáp án; không dùng ID thẻ. Gửi lại phiên đã chấm trả kết quả cũ.',
    'api.community.classes': 'POST title tạo lớp; POST invite tham gia lớp. GET chỉ các lớp sở hữu hoặc tham gia.',
    'api.community.classroom': 'GET cho chủ lớp/thành viên; PATCH/DELETE chỉ chủ lớp. PATCH remove_member với ID để bỏ thành viên.',
    'api.community.classroom_assignments': 'Chỉ chủ lớp. POST node + due_at (ISO8601 hoặc null). DELETE {id} là ID bài giao, không phải ID node.',
    'api.management.users': 'GET q, role=user/staff/superuser, status=active/inactive, sort=username/newest/recent, page. 50/trang. POST cần username,password; email,first_name,last_name tùy chọn. Staff chỉ tạo user, Admin mới cấp staff/superuser.',
    'api.management.user_detail': 'GET nhật ký tài khoản. PATCH username,email,first_name,last_name,password,role,is_active,revoke_sessions,reason. Staff chỉ nhắm tài khoản thường. Không tự khóa/xóa/hạ quyền và phải giữ Admin hoạt động. Đổi quyền/mật khẩu thu hồi phiên; mật khẩu không ghi vào nhật ký. DELETE cần confirm tên và reason 3–500 ký tự.',
    'api.management_data.user_data': 'GET danh sách collections và số lượng. DELETE xóa dữ liệu học/hồ sơ nhưng giữ tài khoản; confirm phải khớp username. Chỉ nhắm tài khoản thường khác.',
    'api.management_data.records': 'kind là collection trong GET data/: decks,cards,folders,practice,classes,... GET danh sách trả fields và can_create để dựng biểu mẫu. POST vào danh sách, PATCH/DELETE vào item_id. Ví dụ body bên dưới áp dụng kind=decks; các collection khác theo fields. Quan hệ phải cùng chủ sở hữu/ngôn ngữ; không được sửa auth hoặc đường dẫn tệp.',
    'api.management_center.content': 'GET q,language,kind,visibility,source=system/users/mine,owner,page (25/trang). GET options=folders trả thư mục của người đang đăng nhập. POST tạo nội dung của người thao tác; không chấp nhận owner từ client.',
    'api.management_center.content_detail': 'GET trả payload, folders, children, version. PATCH chỉ title,parent,payload,visibility,position,links; không đổi owner/language/kind. Bắt buộc version đọc gần nhất. Thay đổi công khai cần reason; cascade=true chỉ cho thư mục. DELETE cần version, confirm đúng tiêu đề, reason; xóa cả cây và dữ liệu liên quan.',
    'api.management_center.content_upload': 'Multipart file; chỉ bài exercise. File được lưu dưới chủ sở hữu nội dung, kiểm tra định dạng như upload thông thường. Gắn media trả về vào payload.attachments khi lưu bài.',
    'api.management_center.activity': 'q và page, 25/trang. Admin xem toàn bộ; Staff chỉ xem nhật ký của chính mình. Không có API sửa/xóa audit.',
    'api.management_center.summary': 'Tổng quan công việc. Số tài khoản của Staff chỉ tính tài khoản thường; thống kê nội dung gồm nội dung học tập hệ thống.',
    'api.management_data.overview': 'Chỉ Admin: thống kê tài khoản/nội dung, kết nối database, migration, runtime và nhật ký. Không trả cấu hình chứa secret.',
    'api.management.site_appearance': 'Chỉ Admin. GET trạng thái, POST multipart background_image (PNG/JPG/WebP tối đa 30 MB), DELETE gỡ ảnh chung.',
    'api.themes.themes': 'GET các theme truy cập được. POST multipart name, preferences (chuỗi JSON), shared=true/false; image tùy chọn. URL có pk để sửa theme. Mỗi tài khoản tối đa 5 theme, chỉ Staff/Admin tạo shared.',
    'api.themes.select_theme': 'scope=en/de/both; theme_id=null trở về mặc định.',
    'api.themes.delete_theme': 'Chỉ người có quyền sửa theme. Xóa theme gỡ lựa chọn của các tài khoản liên quan.',
    'api.personal_appearance.background': 'GET trạng thái; POST multipart image (PNG/JPG/WebP tối đa 30 MB); DELETE gỡ nền cá nhân.',
    'api.monitoring.report': 'Server-to-server: X-Wortify-Monitor-Key, không dùng session và không cần CSRF. checks 1–50; token UUID, at ISO8601 có timezone, ok boolean, latency_ms 0–60000, error rỗng/timeout/network/http/invalid-response. at trong 7 ngày gần đây, không quá 5 phút tương lai. Không đưa monitor secret vào frontend.',
    'api.monitoring.logs': 'Chỉ Admin. page 50/trang; failures=1 chỉ xem lỗi.',
    'api.monitoring.probe': 'Public, kiểm tra kết nối database; {ok:true} hoặc 503 {ok:false}.',
    'api.card_learning.export_deck': 'fmt=json hoặc csv; response là tệp tải xuống của bộ thẻ thuộc người dùng.',
    'api.card_learning.speaking_check': 'Multipart audio + consent=yes. Bản ghi tối đa 10 MB/60 giây; nhà cung cấp speech phải được cấu hình ở backend. Không tự gửi ghi âm khi chưa có đồng ý.',
    'api.card_learning.audio': 'Tạo/lấy TTS cho câu hỏi; phụ thuộc cấu hình speech ở backend. type=term/example, slow=1 tùy chọn.',
    'api.card_learning.card_audio': 'TTS cho thẻ của người dùng; type=term/example.',
    'api.card_learning.next_question': 'deck, mode, filter tùy chọn; JSON được adapter chuyển sang form. Trả câu/token để submit.',
    'api.card_learning.match_submit': 'pairs ánh xạ ID/token của lượt ghép theo dữ liệu match/new. JSON được adapter chuyển đổi.',
    'api.api_reference.reference': 'Chỉ Admin. GET JSON để hiển thị trang; format=postman tải collection v2.1; format=markdown tải tài liệu. Chỉ chứa ví dụ và placeholder, không xuất secret hay dữ liệu tài khoản.',
}

MULTIPART = {
    'api.practice_media.upload': [('file','file','')],
    'api.management_center.content_upload': [('file','file','')],
    'api.management.site_appearance': [('background_image','file','')],
    'api.personal_appearance.background': [('image','file','')],
    'api.themes.themes': [('name','text','Theme mẫu'),('preferences','text','{}'),('shared','text','false')],
    'api.card_learning.speaking_check': [('audio','file',''),('consent','text','yes')],
}

RECIPES = [
    {'title':'Tạo bài tập trong thư mục', 'method':'POST', 'path':'/api/manage/content/',
     'description':'Staff/Admin: tạo folder trước và thay parent=1 bằng ID folder của chính tài khoản. Lưu riêng tư, xem trước rồi công bố. Đây là body bài viết lại câu tối thiểu.',
     'body':{'kind':'exercise','title':'Chào hỏi','language':'en','parent':1,'visibility':'private',
             'payload':{'title':'Chào hỏi','kind':'text','presentation':{'interaction':'short_answer'},
                        'questions':[{'prompt':'Viết hello bằng tiếng Anh','accepted_answers':['hello'],'options':[],'blanks':[],'presentation':{}}]}}},
    {'title':'Cấp quyền Staff', 'method':'PATCH', 'path':'/api/manage/users/{pk}/',
     'description':'Chỉ Admin. pk là ID tài khoản đích; đổi quyền đăng xuất các phiên hiện tại. Không được tự hạ quyền Admin đang sử dụng.',
     'body':{'role':'staff','reason':'Bổ nhiệm nhân viên quản lý nội dung'}},
    {'title':'Khóa tài khoản', 'method':'PATCH', 'path':'/api/manage/users/{pk}/',
     'description':'Staff chỉ nhắm tài khoản thường. is_active=false khóa đăng nhập và thu hồi phiên, không xóa dữ liệu. Mở lại bằng true.',
     'body':{'is_active':False,'reason':'Yêu cầu tạm khóa từ người dùng'}},
    {'title':'Đặt lại mật khẩu', 'method':'PATCH', 'path':'/api/manage/users/{pk}/',
     'description':'Dùng biến Environment local newPassword, không ghi mật khẩu thật trong collection. Server áp dụng kiểm tra độ mạnh mật khẩu.',
     'body':{'password':'{{newPassword}}'}},
    {'title':'Công bố cả cây nội dung', 'method':'PATCH', 'path':'/api/manage/content/{pk}/',
     'description':'GET chi tiết trước để lấy version. Collection cập nhật contentVersion từ response. Chọn pk của folder; cascade=true đổi trạng thái của toàn bộ mục con.',
     'body':{'version':'{{contentVersion}}','visibility':'public','cascade':True,'reason':'Đã duyệt bài và media'}}
]


def reference_data():
    rows = []
    for pattern in get_resolver().url_patterns:
        route = getattr(pattern.pattern, '_route', '')
        if not route.startswith('api/'):
            continue
        view = inspect.unwrap(pattern.callback)
        key = f'{view.__module__}.{view.__name__}'
        methods = ['GET']
        source = ast.parse(textwrap.dedent(inspect.getsource(view)))
        for decorator in source.body[0].decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name) and decorator.func.id == 'require_http_methods':
                methods = ast.literal_eval(decorator.args[0])
            elif isinstance(decorator, ast.Name) and decorator.id in ('require_POST','require_GET'):
                methods = [decorator.id.removeprefix('require_')]
        # Document the intended item/list operations rather than aliases in a
        # shared view which also accepts PATCH on the list URL.
        if key in ('api.views.card', 'api.views.folder', 'api.management_data.records'):
            item = '<int:pk>' in route or '<str:item_id>' in route
            methods = (['GET','PATCH','DELETE'] if item else ['GET','POST']) if key.endswith('.records') else (['PATCH','DELETE'] if item else ['POST'])
        path = '/' + re.sub(r'<\w+:(\w+)>', r'{\1}', route)
        public = key in ('config.urls.health','api.monitoring.probe','users.views.session','users.views.superuser_registration')
        role = 'Public / session' if public else 'Người dùng đăng nhập'
        group = 'Học tập & nội dung'
        if '/manage/' in path:
            group = 'Quản trị'
            role = 'Admin' if key in ('api.management_data.overview','api.monitoring.logs','api.management.site_appearance','api.api_reference.reference') else 'Admin / Staff'
        elif key.startswith('api.themes.') or '/me/' in path or '/site/' in path: group = 'Giao diện & media'
        elif public: group = 'Phiên & sức khỏe'
        elif key == 'api.monitoring.report': group, role = 'Giám sát máy chủ', 'Monitor key'
        examples = EXAMPLES.get(key, {})
        rows.append({'path':path, 'methods':methods, 'group':group, 'role':role,
                     'description':NOTES.get(key, f'{view.__name__}: tài nguyên trong phạm vi tài khoản/ngôn ngữ. Xem mã xử lý {key} để mở rộng tích hợp.'),
                     'source':key, 'examples':{m:examples[m] for m in methods if m in examples},
                     'response_example':examples.get('response'),
                     'multipart':MULTIPART.get(key, []),
                     'parameters':re.findall(r'{(\w+)}', path)})
    return {'title':'Wortify API', 'version':'1', 'guide':GUIDE, 'recipes':RECIPES, 'endpoints':rows}


def postman_collection(data):
    def item(row, method, name=None):
        url = '{{baseUrl}}' + re.sub(r'{(\w+)}', r'{{\1}}', row['path'])
        headers = [{'key':'Accept','value':'application/json'}]
        if method not in ('GET','HEAD'):
            if row['role'] == 'Monitor key':
                headers.append({'key':'X-Wortify-Monitor-Key','value':'{{monitorKey}}'})
            else:
                headers.extend([{'key':'X-CSRFToken','value':'{{csrfToken}}'}, {'key':'Origin','value':'{{baseUrl}}'}, {'key':'Referer','value':'{{baseUrl}}/'}])
        request = {'method':method,'header':headers,'url':url,'description':f"Quyền: {row['role']}\n\n{row['description']}"}
        if method in ('POST','PATCH','DELETE'):
            if method == 'POST' and row['multipart']:
                request['body']={'mode':'formdata','formdata':[{'key':k,'type':t,**({'src':[]} if t=='file' else {'value':v})} for k,t,v in row['multipart']]}
            else:
                headers.append({'key':'Content-Type','value':'application/json'})
                request['body']={'mode':'raw','raw':json.dumps(row['examples'].get(method,{}),ensure_ascii=False,indent=2),'options':{'raw':{'language':'json'}}}
        return {'name':name or f'{method} {row["path"]}', 'request':request, 'response':[]}
    session = next(row for row in data['endpoints'] if row['path']=='/api/session/')
    folders = [{'name':'00 · Bắt đầu — chạy theo thứ tự','item':[item(session,'GET','01 · Nhận CSRF cookie'),item(session,'POST','02 · Đăng nhập'),item(session,'GET','03 · Kiểm tra phiên')]}]
    recipes = []
    for recipe in RECIPES:
        row = next(row for row in data['endpoints'] if row['path'] == recipe['path'])
        recipe_row = {**row, 'description':recipe['description'], 'examples':{recipe['method']:recipe['body']}}
        recipes.append(item(recipe_row, recipe['method'], recipe['title']))
    folders.append({'name':'01 · Ví dụ nghiệp vụ — gửi từng request', 'item':recipes})
    for group in dict.fromkeys(row['group'] for row in data['endpoints']):
        folders.append({'name':group,'item':[item(row,method) for row in data['endpoints'] if row['group']==group for method in row['methods']]})
    variables={'baseUrl':'http://127.0.0.1:8000','username':'','password':'','newPassword':'','csrfToken':'','language':'en','pk':'1','deck_id':'1','item_id':'1','kind':'decks','fmt':'json','token':'','questionToken':'','eventToken':'','checkedAt':'','setup_key':'','monitorKey':'','contentVersion':'','contentTitle':'','targetUsername':''}
    return {'info':{'name':'Wortify API · Developer reference','schema':'https://schema.getpostman.com/json/collection/v2.1.0/collection.json','description':'\n\n'.join(g['title']+'\n'+g['text'] for g in GUIDE)},
            'auth':{'type':'noauth'},'variable':[{'key':k,'value':v,'type':'string'} for k,v in variables.items()], 'item':folders,
            'event':[{'listen':'test','script':{'type':'text/javascript','exec':[
                "const cookieHeaders = pm.response.headers.all().filter(h => h.key.toLowerCase() === 'set-cookie');",
                "for (const h of cookieHeaders) { const match = h.value.match(/(?:^|[,;]\\s*)csrftoken=([^;]+)/); if (match) pm.collectionVariables.set('csrfToken', decodeURIComponent(match[1])); }",
                "if (pm.response.headers.get('Content-Type')?.includes('application/json')) { const data = pm.response.json(); if (data.version) pm.collectionVariables.set('contentVersion', data.version); if (data.title) pm.collectionVariables.set('contentTitle', data.title); }",
            ]}}]}


def markdown_reference(data):
    lines = ['# '+data['title'], '', 'Tài liệu từ URLconf và ví dụ đã khai báo. Không chứa thông tin xác thực thực tế.', '']
    for guide in data['guide']:
        lines.extend(['## '+guide['title'], '', guide['text'], ''])
    for recipe in data['recipes']:
        lines.extend(['## Ví dụ: '+recipe['title'], '', recipe['method']+' '+recipe['path'], '', recipe['description'], '', '```json', json.dumps(recipe['body'],ensure_ascii=False,indent=2), '```', ''])
    for row in data['endpoints']:
        lines.extend(['## '+', '.join(row['methods'])+' '+row['path'], '', '**Quyền:** '+row['role'], '', row['description'], ''])
        for method, example in row['examples'].items():
            lines.extend([f'Body {method}:', '', '```json', json.dumps(example,ensure_ascii=False,indent=2), '```', ''])
        if row['multipart']:
            lines.extend(['Multipart: '+', '.join(f'{k} ({t})' for k,t,_ in row['multipart']), ''])
    return '\n'.join(lines)


@management('system.view')
@require_http_methods(['GET'])
def reference(request):
    data = reference_data()
    format = request.GET.get('format','json')
    if format == 'json': return JsonResponse(data)
    if format == 'postman':
        response = JsonResponse(postman_collection(data),json_dumps_params={'ensure_ascii':False,'indent':2})
        filename = 'wortify.postman_collection.json'
    elif format == 'markdown':
        response = HttpResponse(markdown_reference(data),content_type='text/markdown; charset=utf-8')
        filename = 'API_REFERENCE.md'
    else: raise ValueError('Định dạng không hợp lệ.')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response

# AGENTS.md — Wortify

Tài liệu kiến trúc hiện tại. Yêu cầu trực tiếp của người dùng có ưu tiên cao hơn tài liệu này.

## Domain và quyền

- Practice Hub dùng `practice.PracticeNode`: owner/language, parent, kind folder/exercise/theory, payload JSON, links có hướng, visibility và position. Folder tối đa ba cấp; bài/lý thuyết đứng riêng hoặc nằm trong folder. Chặn chu trình và kiểm tra cả chiều cao cây khi di chuyển.
- Chín dạng bài bắt buộc đáp án, tự chấm: trắc nghiệm, đúng/sai/không có, trả lời ngắn, điền chỗ trống, phân loại, nối cặp, sắp xếp, tìm lỗi, nghe–chép. Lý thuyết HTML/Markdown là loại nội dung thứ mười, không chấm điểm. Không có writing dài hoặc chấm thủ công.
- `practice.PracticeAttempt` lưu bài làm/kết quả server. `practice/schema.py` kiểm tra payload, `learning/grading.py` chấm lại khi lưu.
- `cards`: Deck/Card/Folder, StudySettings, StudyProgress, StudySession; DeckLearningState lưu options/progress/stars; LearningEvent ghi batch idempotent bằng UUID.
- `users.Profile` lưu preferences giao diện/âm thanh và timestamp theo từng trường. StudySettings lưu cài đặt học theo ngôn ngữ. Classroom/ClassroomAssignment giao PracticeNode cho thành viên, cho phép truy cập cây con được giao.
- User, staff và superuser đều có tính năng học/tạo nội dung cá nhân. Staff quản lý tài khoản thường và dữ liệu của họ; không quản lý staff/superuser, không nâng quyền, không vào Django admin hoặc sửa nền hệ thống. Superuser có dashboard hệ thống và toàn bộ quản trị.
- `content` chỉ còn SiteAppearance. Không còn Book, Chapter, Review, import sách hoặc API tương thích.

## Runtime và mã nguồn

- Django backend cổng8000; Vite frontend5173. Vite proxy `/api` sang backend; frontend tự phục vụ static asset.
- `tools/run_local.py` kiểm tra cổng trước khi khởi động; nhận diện đúng Wortify qua health + workspace fingerprint. Dùng lại dịch vụ đúng, không tắt dịch vụ lạ. Có biến WORTIFY_BACKEND_PORT/WORTIFY_FRONTEND_PORT.
- `start.ps1`/`start.sh`: kiểm tra, cài thư viện, migrate, build, chạy dịch vụ. Không tự sinh migrations.
- `Frontend/src/App.jsx`: tài khoản, routing EN/DE, shell. `ui.jsx`: primitives/form một lớp focus. `glass.css`: lớp theme cuối cùng.
- Sidebar trước điều hướng chính, sau công cụ theo trang. Header cố định có Brand, icon xoay và thu gọn/ghim. Sidebar liền khối352px, hỗ trợ vuốt ngang (ngưỡng65px, bỏ cử chỉ cuộn dọc) và hover mép trái khi thu gọn. navPinned lưu vào preferences server. `SidebarTools` portal vào mặt sau. Không có topbar, chữ quảng bá hoặc hướng dẫn thường trực. Practice Hub tự mở mặt cây: ＋ ở root/folder, folder tạo inline chỉ nhập tên, bài/theory nhận parent hiện tại. Di chuyển dùng hộp thoại riêng; cây hiển thị icon, nhánh và đường nối.
- `practice-hub.jsx`: cây, CRUD, JSON, đọc lý thuyết; `exercise-authoring.jsx`: tạo câu; `practice-activity.jsx`: luyện và chấm tại máy; `exercise-interactions.jsx`: chín dạng tương tác.
- `flashcard-studio.jsx` + `flashcard-engine.js`: Flashcards/Learn/Test cho bộ thẻ; chọn choice/truefalse chấm ngay, written dùng Enter/↵, matching chấm khi đủ. Test tự lưu khi mọi câu được trả lời. Phản hồi có vùng giữ sẵn, xanh/đỏ và ký hiệu đúng/sai. Gắn sao không reset thứ tự/index; `study.jsx`: ôn liên bộ bằng StudySession và luyện thêm. Luyện nói thu âm/nghe lại tại máy, không chấm phát âm tự động.
- `learning.jsx`: Settings; `community.jsx`: hồ sơ/lớp. `Frontend/src/admin/`: Admin.jsx quản trị người dùng/dashboard hệ thống, UserData.jsx quản lý dữ liệu từng người dùng, Appearance.jsx nền hệ thống dành superuser.
- `Soundscape.jsx`: Web Audio sinh âm nền/tương tác, không tải âm khi bấm. TTS phụ thuộc giọng trình duyệt.

## API

- `/api/session/`: tài khoản + preferences; auth/CSRF vẫn bắt buộc.
- `/api/{en|de}/practice-hub/nodes/`: GET metadata, `?full=1` cả payload, POST tạo; `nodes/{id}/` GET/PATCH/DELETE; `practice-hub/import/` nhập cây nguyên tử.
- `/api/{lang}/decks/{id}/`: cả bộ thẻ, learning state, study_defaults và token đã áp dụng gần đây.
- `/api/{lang}/learning/sync/`: POST1–100 sự kiện practice/review/test/star/options/preferences/study_settings. Mỗi sự kiện transaction riêng, retry UUID không ghi trùng; một sự kiện lỗi không chặn các sự kiện khác.
- `/api/{lang}/sessions/`, `sessions/{token}/finish/`: phiên ôn liên bộ; hoàn thành tự gửi đáp án cả phiên, server chấm/SRS idempotent.
- `/api/{lang}/settings/`, `profile/`, `classes/`: cài đặt, lịch sử và lớp.
- `/api/manage/users/`, `users/{id}/`: superuser quản trị tài khoản; staff chỉ quản lý tài khoản thường. Chặn tự khóa/xóa/hạ quyền. Không ghi mật khẩu vào audit. `users/{id}/data/` tổng hợp/xóa dữ liệu (xác nhận username), `data/{kind}/{id}/` CRUD theo whitelist và quyền sở hữu. `/api/manage/overview/` chỉ superuser, dashboard số lượng, DB/runtime/migrations/audit.
- `/api/site/appearance/`: đọc nền; `/api/manage/appearance/`: superuser sửa.

## Hiệu suất và lưu dữ liệu

`core.js` cache nội dung RAM10phút, mutation làm mất hiệu lực; sync chỉ bỏ cache trạng thái bộ thẻ. Tải metadata trước và tải ngầm toàn Practice Hub sau150ms. Media được preload, phụ thuộc browser cache. Đây không phải PWA offline qua lần khởi động mới.

`learning-sync.js` gom cài đặt/sao trong khoảng1,2giây; review5giây, tối đa20 thay đổi gửi ngay. Hàng đợi UUID localStorage riêng tài khoản/ngôn ngữ, fallback RAM nếu storage bị chặn. Chu kỳ15giây chỉ gửi khi có dữ liệu; online, chuyển trang/ẩn trang và kết thúc buổi học kích hoạt flush. Lỗi mạng giữ queue tự retry; server từ chối từng mục được hiển thị. Không có nút đồng bộ thủ công. Lật/chuyển thẻ và phản hồi đúng/sai không chờ API. Nộp Practice/Test lưu kết quả server.

Cài đặt tài khoản là nguồn dữ liệu chính khi đăng nhập. Overlay queue chưa gửi giúp thao tác không bị mất khi reload; preferences hợp nhất từng trường theo timestamp. StudySettings là mặc định cho bộ thẻ chưa tùy chỉnh; options từng bộ có ưu tiên cao hơn.

## JSON

Mẫu `Frontend/public/templates/practice-hub.json`: gốc `{ "nodes": [...] }`, folder có `children`, exercise có `payload.questions`, theory có format/content. Có thể nhập một bài/theory độc lập. Giới hạn100 mục gốc,500 tổng; lỗi hoàn tác toàn bộ. Nhập câu hỏi JSON nối vào bản nháp. Liên kết chọn sau khi nội dung đã có ID. Lý thuyết giới hạn2MB; HTML hiển thị iframe sandbox. Markdown hiện hỗ trợ tiêu đề/chữ đậm/xuống dòng cơ bản. Mẫu nghe có âm báo; cần thay bằng ngữ liệu thật khi biên soạn.

## Database và kiểm thử

Bốn baseline0001 cho cards/content/practice/users; users0002 thêm preferences. Database cũ đã backup tại `.development-backups/`. Không yêu cầu tương thích dữ liệu thử cũ. Chỉ thay schema mới tạo migration.

`seed_development_demo` DEBUG-only: demo(superuser), learner(user), staff(staff), mật khẩu ban đầu WortifyDemo2026!; demo sở hữu hai bộ12thẻ EN/DE và hai cây đủ mười dạng. Seed chạy lại không nhân bản.

Kiểm tra: npm test, npm run build, manage.py test, manage.py makemigrations --check --dry-run. Test tự tạo dữ liệu. Không dùng dữ liệu seed làm fixture bắt buộc. Khi sửa tương tác cần kiểm tra tạo/sửa/nộp thực tế và trạng thái lưu server, ngoài build.


## Deployment và appearance (2026-09-29)

- README là hướng dẫn triển khai hiện hành: development, staging và production; Compose riêng trong Backend/deploy và Frontend/deploy, nối qua private network/VPN. Django API/admin chạy Gunicorn, PostgreSQL; React chạy Nginx, proxy cùng origin. Private media có volume riêng, không public static.
- Backend tự nạp `.env` tại gốc repo; `WORTIFY_ENV_FILE` chọn file khác (path tương đối từ Backend); môi trường tiến trình luôn ưu tiên. Production dependencies nằm trong Backend/requirements-production.txt và constraints tương ứng. Không đưa secret/database/backup vào image hoặc Git.
- Ảnh nền cá nhân được áp dụng qua shorthand `background` ở surfaces.css: `--page-bg` chứa cả màu cuối nên không được ghép vào thuộc tính background-image. App lấy snapshot theo phiên đăng nhập, lưu Blob vào IndexedDB và thu hồi object URL khi đổi tài khoản; upload không tải lại nền.
- Soundscape dùng nốt hữu hạn, envelope về 0 và stop/disconnect; không dùng oscillator trầm chạy liên tục. Âm nền tạm im khi media/TTS phát hoặc tab ẩn. Thay volume không tạo lại AudioContext.


## Theme và cache đăng nhập (2026-09-29)

- `users.Theme` có owner, shared, preferences và file ảnh riêng; mỗi owner tối đa 5, tạo được khóa theo user để chống vượt quota do request đồng thời. User chỉ công bố riêng; staff/superuser có shared. API không trả owner/username. Profile chọn theme_de/theme_en, xóa theme đặt lựa chọn về null. Ngừng chia sẻ loại bỏ lựa chọn của người khác.
- `api/themes.py`: danh sách/tạo/sửa, chọn cho de/en/both, xóa, ảnh có xác thực và manifest đăng nhập. Theme media không public. Upload ảnh riêng/theme/system tối đa 30 MB, handler users.uploads lưu tạm trên đĩa; không đi qua giới hạn audio recorder 10 MB.
- `/api/session/` trả appearance_session ngẫu nhiên ổn định trong phiên và thay sau mỗi POST login. `appearance-cache.js` lưu manifest + Blob trong IndexedDB, khóa tải trùng giữa các tab khi Web Locks có sẵn. App dùng object URL và thu hồi khi logout; không nghe appearance-updated để tải ảnh lại. Lỗi tải được lưu để tránh retry mỗi reload. Theme thay đổi có hiệu lực từ đăng nhập sau.
- `theme-library.jsx` dùng modal, nút icon và lựa chọn phạm vi EN/DE; không tự tải thumbnail từ server. `interaction-glass.css` là lớp trạng thái chung cuối design-system, giữ kính trong và focus ring; curvature/glassLens được validate và dùng qua CSS variables.


## Server monitor và bỏ qua (2026-09-29)

- Không còn hook health/monitor ở trình duyệt. Vite plugin chỉ chạy trong tiến trình Node server; production có service frontend-monitor ở máy frontend. Worker scripts/backend-monitor.mjs probe ngay khi khởi động và mỗi 600000 ms, persist hàng đợi khi backend lỗi, gửi token idempotent qua X-Wortify-Monitor-Key. Secret chỉ ở môi trường server. BackendCheck.source phân biệt frontend-server với các log browser cũ; dashboard chỉ hiện server và không gắn user.
- PracticeActivity có trạng thái revealed độc lập đáp án/progress: bỏ qua hủy chấm tự động, hiện đáp án, chờ icon tiếp tục; không thêm vào completed. Flashcard learn/test/review/flash và ExtraStudy có bỏ qua; ghi correct=false/Again để không tăng thành thạo. StudySession dùng giá trị reserved __wortify_skipped__ được chấm false cả frontend/backend và lưu idempotent. Test dạng danh sách giữ bố cục, tiếp tục focus câu kế/tổng kết/nút nộp.

## Repo độc lập (2026-10-05)

Backend và Frontend có dependency, env, deploy và README riêng. Backend không được đọc file trong Frontend; mẫu dùng cho test/seed nằm ở Backend/sample_data. Các script gốc chỉ hỗ trợ chạy chung local. Database/media/static path tương đối tính từ Backend, không phụ thuộc working directory. Chạy manage.py trong Backend hoặc dùng Backend/manage.py từ gốc.

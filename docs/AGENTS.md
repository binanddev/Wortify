# AGENTS.md — Wortify

Tài liệu kiến trúc hiện tại. Yêu cầu trực tiếp của người dùng có ưu tiên cao hơn tài liệu này.

## Domain và quyền

- Practice Hub dùng `practice.PracticeNode`: owner/language, parent, kind folder/exercise/theory, payload JSON, links có hướng, visibility và position. Folder tối đa ba cấp; bài/lý thuyết đứng riêng hoặc nằm trong folder. Chặn chu trình và kiểm tra cả chiều cao cây khi di chuyển.
- Chín dạng bài bắt buộc đáp án, tự chấm: trắc nghiệm, đúng/sai/không có, trả lời ngắn, điền chỗ trống, phân loại, nối cặp, sắp xếp, tìm lỗi, nghe–chép. Lý thuyết HTML/Markdown là loại nội dung thứ mười, không chấm điểm. Không có writing dài hoặc chấm thủ công.
- `practice.PracticeAttempt` lưu bài làm/kết quả server. `practice/schema.py` kiểm tra payload, `learning/grading.py` chấm lại khi lưu.
- `cards`: Deck/Card/Folder, StudySettings, StudyProgress, StudySession; DeckLearningState lưu options/progress/stars; LearningEvent ghi batch idempotent bằng UUID.
- `users.Profile` lưu preferences giao diện/âm thanh và timestamp theo từng trường. StudySettings lưu cài đặt học theo ngôn ngữ. Classroom/ClassroomAssignment giao PracticeNode cho thành viên, cho phép truy cập cây con được giao.
- User và staff cùng quyền học/tạo nội dung cá nhân. Superuser có toàn bộ tính năng thường và quản trị người dùng. Staff không có quyền admin Django, quản trị tài khoản hoặc nền toàn hệ thống.
- `content` chỉ còn SiteAppearance. Không còn Book, Chapter, Review, import sách hoặc API tương thích.

## Runtime và mã nguồn

- Django backend cổng8000; Vite frontend5173. Vite proxy `/api`, media và static sang backend.
- `tools/run_local.py` kiểm tra cổng trước khi khởi động; nhận diện đúng Wortify qua health + workspace fingerprint. Dùng lại dịch vụ đúng, không tắt dịch vụ lạ. Có biến WORTIFY_BACKEND_PORT/WORTIFY_FRONTEND_PORT.
- `start.ps1`/`start.sh`: kiểm tra, cài thư viện, migrate, build, chạy dịch vụ. Không tự sinh migrations.
- `frontend-react/src/App.jsx`: tài khoản, routing EN/DE, shell. `ui.jsx`: primitives/form một lớp focus. `glass.css`: lớp theme cuối cùng.
- Sidebar trước điều hướng chính, sau công cụ theo trang. Header cố định có Brand, icon xoay và thu gọn/ghim. Sidebar liền khối352px, hỗ trợ vuốt ngang (ngưỡng65px, bỏ cử chỉ cuộn dọc) và hover mép trái khi thu gọn. navPinned lưu vào preferences server. `SidebarTools` portal vào mặt sau. Không có topbar, chữ quảng bá hoặc hướng dẫn thường trực. Practice Hub tự mở mặt cây: ＋ ở root/folder, folder tạo inline chỉ nhập tên, bài/theory nhận parent hiện tại. Di chuyển dùng hộp thoại riêng; cây hiển thị icon, nhánh và đường nối.
- `practice-hub.jsx`: cây, CRUD, JSON, đọc lý thuyết; `exercise-authoring.jsx`: tạo câu; `practice-activity.jsx`: luyện và chấm tại máy; `exercise-interactions.jsx`: chín dạng tương tác.
- `flashcard-studio.jsx` + `flashcard-engine.js`: Flashcards/Learn/Test cho bộ thẻ; chọn choice/truefalse chấm ngay, written dùng Enter/↵, matching chấm khi đủ. Test tự lưu khi mọi câu được trả lời. Phản hồi có vùng giữ sẵn, xanh/đỏ và ký hiệu đúng/sai. Gắn sao không reset thứ tự/index; `study.jsx`: ôn liên bộ bằng StudySession và luyện thêm. Luyện nói thu âm/nghe lại tại máy, không chấm phát âm tự động.
- `learning.jsx`: Settings; `community.jsx`: hồ sơ/lớp. `frontend-admin/src/Admin.jsx`: chỉ quản trị người dùng; Appearance.jsx: nền hệ thống dành superuser.
- `Soundscape.jsx`: Web Audio sinh âm nền/tương tác, không tải âm khi bấm. TTS phụ thuộc giọng trình duyệt.

## API

- `/api/session/`: tài khoản + preferences; auth/CSRF vẫn bắt buộc.
- `/api/{en|de}/practice-hub/nodes/`: GET metadata, `?full=1` cả payload, POST tạo; `nodes/{id}/` GET/PATCH/DELETE; `practice-hub/import/` nhập cây nguyên tử.
- `/api/{lang}/decks/{id}/`: cả bộ thẻ, learning state, study_defaults và token đã áp dụng gần đây.
- `/api/{lang}/learning/sync/`: POST1–100 sự kiện practice/review/test/star/options/preferences/study_settings. Mỗi sự kiện transaction riêng, retry UUID không ghi trùng; một sự kiện lỗi không chặn các sự kiện khác.
- `/api/{lang}/sessions/`, `sessions/{token}/finish/`: phiên ôn liên bộ; hoàn thành tự gửi đáp án cả phiên, server chấm/SRS idempotent.
- `/api/{lang}/settings/`, `profile/`, `classes/`: cài đặt, lịch sử và lớp.
- `/api/manage/users/`, `users/{id}/`: superuser tạo, sửa, đổi role/password, khóa, xóa, thu hồi phiên, audit. Chặn tự khóa/xóa/hạ quyền. Không ghi mật khẩu vào audit.
- `/api/site/appearance/`: đọc nền; `/api/manage/appearance/`: superuser sửa.

## Hiệu suất và lưu dữ liệu

`core.js` cache nội dung RAM10phút, mutation làm mất hiệu lực; sync chỉ bỏ cache trạng thái bộ thẻ. Tải metadata trước và tải ngầm toàn Practice Hub sau150ms. Media được preload, phụ thuộc browser cache. Đây không phải PWA offline qua lần khởi động mới.

`learning-sync.js` gom cài đặt/sao trong khoảng1,2giây; review5giây, tối đa20 thay đổi gửi ngay. Hàng đợi UUID localStorage riêng tài khoản/ngôn ngữ, fallback RAM nếu storage bị chặn. Chu kỳ15giây chỉ gửi khi có dữ liệu; online, chuyển trang/ẩn trang và kết thúc buổi học kích hoạt flush. Lỗi mạng giữ queue tự retry; server từ chối từng mục được hiển thị. Không có nút đồng bộ thủ công. Lật/chuyển thẻ và phản hồi đúng/sai không chờ API. Nộp Practice/Test lưu kết quả server.

Cài đặt tài khoản là nguồn dữ liệu chính khi đăng nhập. Overlay queue chưa gửi giúp thao tác không bị mất khi reload; preferences hợp nhất từng trường theo timestamp. StudySettings là mặc định cho bộ thẻ chưa tùy chỉnh; options từng bộ có ưu tiên cao hơn.

## JSON

Mẫu `frontend-react/public/templates/practice-hub.json`: gốc `{ "nodes": [...] }`, folder có `children`, exercise có `payload.questions`, theory có format/content. Có thể nhập một bài/theory độc lập. Giới hạn100 mục gốc,500 tổng; lỗi hoàn tác toàn bộ. Nhập câu hỏi JSON nối vào bản nháp. Liên kết chọn sau khi nội dung đã có ID. Lý thuyết giới hạn2MB; HTML hiển thị iframe sandbox. Markdown hiện hỗ trợ tiêu đề/chữ đậm/xuống dòng cơ bản. Mẫu nghe có âm báo; cần thay bằng ngữ liệu thật khi biên soạn.

## Database và kiểm thử

Bốn baseline0001 cho cards/content/practice/users; users0002 thêm preferences. Database cũ đã backup tại `.development-backups/`. Không yêu cầu tương thích dữ liệu thử cũ. Chỉ thay schema mới tạo migration.

`seed_development_demo` DEBUG-only: demo(superuser), learner(user), staff(staff), mật khẩu ban đầu WortifyDemo2026!; demo sở hữu hai bộ12thẻ EN/DE và hai cây đủ mười dạng. Seed chạy lại không nhân bản.

Kiểm tra: npm test, npm run build, manage.py test, manage.py makemigrations --check --dry-run. Test tự tạo dữ liệu. Không dùng dữ liệu seed làm fixture bắt buộc. Khi sửa tương tác cần kiểm tra tạo/sửa/nộp thực tế và trạng thái lưu server, ngoài build.

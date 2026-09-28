# Frontend Wortify

React19, HeroUI2, Tailwind4, Framer Motion12, Vite8; backend Django, không có backend Node riêng.

- App.jsx: auth, routing EN/DE, sidebar hai mặt.
- core.js: API/CSRF, cache, hủy request và action guard.
- ui.jsx: component dùng chung; src/design-system/index.css: entry Tailwind duy nhất. Xem src/design-system/README.md để sửa theme, utility và style theo module.
- practice-hub.jsx/practice-activity.jsx: học và lưu tiến độ cho 7 dạng bài. explore.jsx: tìm nội dung công khai. exercise-studio.jsx: Create, nhập .txt và quản lý nội dung.
- library.jsx: bộ thẻ/thư mục; flashcard-studio.jsx: Flashcards/Learn/Test; study.jsx: ôn liên bộ và luyện thêm.
- learning-sync.js: queue tự lưu server, retry/idempotence. local-learning.js/flashcard-engine.js: chấm tại trình duyệt.
- learning.jsx: cài đặt; community.jsx: hồ sơ/lớp.
- frontend-admin/src/Admin.jsx: quản trị người dùng, tải riêng.

Khởi động từ gốc bằng start.ps1 (PowerShell) hoặc start.sh (Bash). Backend8000, frontend5173. Build có base / và được web server frontend phục vụ độc lập. Django chỉ cung cấp /api/ và admin mặc định; không đọc manifest. Chạy npm test và npm run build từ gốc; backend tests trong backend/api.

Giọng TTS/micro phụ thuộc thiết bị. Practice Hub yêu cầu đáp án khi tạo; không có bài viết dài hoặc chấm thủ công. Hướng dẫn kiến trúc và giới hạn hiện tại: docs/AGENTS.md.

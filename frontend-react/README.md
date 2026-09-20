# React frontend

Ứng dụng đã triển khai tại `src/` và tích hợp API Django. React 19, HeroUI v2, Tailwind 4, Framer Motion 12, Vite 8. Không dùng Next.js hoặc backend Node.

- `App.jsx`: auth, chọn ngôn ngữ, shell và điều hướng history.
- `core.js`: API/CSRF, hủy request, chống submit lặp, dữ liệu đọc và tùy chọn cục bộ.
- `ui.jsx`: thành phần kính, biểu mẫu, modal, input bài tập, thẻ lật, audio.
- `library.jsx`: thư viện, CRUD, thư mục, import và thứ tự từ.
- `study.jsx`: phiên Flash/Learn/Test, bài luyện bổ sung và thu âm.
- `learning.jsx`: sách/lý thuyết/media, bài tập, hồ sơ, lớp và chấm bài.
- `../frontend-admin/src/Admin.jsx`: quản trị riêng, tải lười khi mở `/manage`.

Chạy `bash start.sh` từ gốc để bật toàn bộ, hoặc chạy backend 8002 và `npm run dev` riêng. Build có base `/static/react/`; Django đọc Vite manifest, phục vụ qua staticfiles. Dev chạy ở 5173 với proxy cùng origin, không tắt CSRF. Preview 4173 dùng đường dẫn `/static/react/`; kiểm tra bản sản phẩm tốt nhất qua Django 8002.

`npm test` ở thư mục này chạy kiểm thử API adapter bằng Node. Kiểm thử quyền/chấm/nhập JSON/upload trong `backend/api/test_react_migration.py` cùng các bài test hiện có. UI dùng tiếng Việt, ngôn ngữ học và dữ liệu chia theo `/en` hoặc `/de`.

Cần kiểm tra giọng đọc/micro thật trên thiết bị; nhận dạng nói cần cấu hình provider. Không có AI chấm ngữ nghĩa. Chất lượng đáp án JSON được đánh dấu để admin rà soát, không tự suy diễn câu trả lời thiếu.

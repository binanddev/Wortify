# Lernraum: kiến trúc và contract

Cập nhật 2026-09-20. Đây là tài liệu tổng quan chuẩn; các ghi chú bàn giao React cũ đã được hợp nhất tại đây. Quy tắc dành cho agent nằm ở [../AGENTS.md](../AGENTS.md).

## Tổng quan

Lernraum là ứng dụng học tiếng Anh/Đức. Django giữ toàn bộ nghiệp vụ server: session/auth, CSRF, quyền, SRS, chấm điểm, dữ liệu sách, upload private và API. React chỉ là client cùng origin; không có backend Node.

```text
manage.py
├─ backend/config       settings, URL routing, WSGI/ASGI
├─ backend/api          common helpers, API views, admin management, middleware
├─ backend/cards        flashcards, study sessions, audio/speech
├─ backend/content      book schema, ingestion/import, assets
├─ backend/practice     exercises, grading, progress
├─ backend/users        profile, classroom/review/session
├─ frontend-react/src   learner shell and features
├─ frontend-admin/src   Content Studio, lazy-loaded at /manage
└─ docs/book-template-v1.json
```

## Runtime và routing

- Django chạy local ở `127.0.0.1:8002`; Vite dev ở `127.0.0.1:5173`, preview ở `4173`.
- Vite proxy `/api`, `/admin`, `/static` về Django và giữ cặp Host/Origin cho session/CSRF.
- Frontend mount tại `/`, `/login`, `/en/...`, `/de/...`; Content Studio tại `/manage`; Django Admin tại `/admin/`.
- API học có namespace `/api/en/` và `/api/de/`. API quản trị nằm ở `/api/manage/` và chỉ chấp nhận active superuser.
- Production Django đọc Vite manifest và phục vụ asset build dưới `/static/react/`.

## Frontend

- `App.jsx`: bootstrap session, auth, language, shell và History API routing.
- `core.js`: `request`, CSRF, credentials, JSON/FormData, abort, 401/session-expired và action guard.
- `ui.jsx`: HeroUI/Tailwind primitives, form, modal, feedback, audio và answer controls.
- `library.jsx`: deck/folder CRUD, import/export, flashcard deck.
- `study.jsx`: Flash/Learn/Test, extra exercises, recorder.
- `books.jsx`: book/chapter/lesson/exercise.
- `learning.jsx`: profile, settings, classroom, review, result và book media.
- `frontend-admin/src/Admin.jsx`: users, books, JSON preview/confirm, exercise editor và media upload.

Feature không gọi `fetch` trực tiếp; dùng helper trong `core.js`. Mutation phải giữ CSRF, credentials, pending guard, abort cleanup và hiển thị lỗi thật.

## Domain và dữ liệu sách

Các entity chính gồm `Book`, `Chapter`, `Exercise`, `Question`, `BookAsset`, `BookImportBatch`, cùng deck/session/progress/profile/review. Book content được lưu database; `book/` chỉ là staging source.

Import JSON schema v1: tạo sách → thêm chapter/JSON → preview → confirm token. Bổ sung cùng `chapter.number` và `exercise.id` cập nhật đúng bản ghi, giữ bản ghi khác; theory cũ được giữ nếu payload không cung cấp theory. Import không tự suy luận đáp án mơ hồ; grading manual phải được ghi chú.

Question API người học không làm lộ `source_document` hoặc đáp án gốc chưa chấm. Asset private được truy cập qua endpoint đăng nhập, không qua static. Template đầy đủ ở [book-template-v1.json](book-template-v1.json).

## Contract nghiệp vụ phải giữ

- Auth/session và CSRF thuộc Django; 401 phải đưa client về trạng thái chưa đăng nhập.
- State học và local preference tách theo `user + language`.
- Flash/Learn chấm từng câu; Test chỉ chấm sau khi submit toàn bài và khóa input đã nộp.
- Book exercise giữ form sau submit; sửa tạo Attempt mới.
- Ownership học tập không được mở rộng chỉ vì user là superuser ở API quản trị.
- Community hiện đang bị khóa qua `COMMUNITY_ENABLED = False`.
- Không có AI chấm ngữ nghĩa hoặc realtime push mặc định.

## Công nghệ và giới hạn

Python 3.12+, Django 5.2, Channels 4, SQLite mặc định, React 19, Vite 8, HeroUI 2, Tailwind 4, Framer Motion 12, Node 22.12+, PyAV. Giới hạn chính: JSON 5 MB/file và 20 MB/batch; media 10 MB/file và 50 MB/batch; recording 10 MB/60 giây.

Khi deploy production: `DJANGO_DEBUG=0`, secret không rỗng và ổn định, allowed hosts/CSRF trusted origins đúng, HTTPS, migrate, collectstatic và check deploy. SQLite phù hợp local/quy mô nhỏ; tải ghi nhiều tiến trình cần đánh giá PostgreSQL.

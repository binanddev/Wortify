# AGENTS.md

Tài liệu này là nguồn hướng dẫn chính cho mọi thay đổi trong repository. Đọc file này trước khi sửa code hoặc tài liệu kỹ thuật. Nội dung được tổng hợp từ code hiện tại; nếu phát hiện sai lệch, ưu tiên xác minh bằng code rồi cập nhật tài liệu liên quan.



## Kiến trúc

- `manage.py` trỏ Django settings tới `backend/config`.
- Backend apps:
  - `backend/cards`: flashcards, study session, audio/speech và legacy-compatible endpoints.
  - `backend/content`: Book/Chapter/Exercise/Question/Asset, schema và ingestion/import.
  - `backend/practice`: bài luyện, grading, progress và notification.
  - `backend/users`: profile, classroom/review liên quan session người dùng.
  - `backend/api`: common request helpers, API views, management API, middleware và tests.
  - `backend/config`: settings, URL routing, WSGI/ASGI.
- `frontend-react/src/App.jsx` là shell/auth/routing; `core.js` là API/CSRF/lifecycle; `ui.jsx` là primitives; `library.jsx`, `study.jsx`, `books.jsx`, `learning.jsx` là các feature chính.
- `frontend-admin/src` được lazy-load tại `/manage`, dùng chung build/dependency của `frontend-react`.
- Vite dev/preview proxy `/api`, `/admin`, `/static` tới Django `127.0.0.1:8002`; production dùng build manifest tại `frontend-react/dist/.vite/manifest.json`.
- API học dùng namespace `/api/en/` và `/api/de/`; state/preferences phải tách theo user và language.

## Tech stack

- Python 3.12+, Django `>=5.2,<5.3`, Channels 4, SQLite mặc định.
- React 19, React DOM 19, Vite 8, HeroUI 2, Tailwind CSS 4, Framer Motion 12.
- Node.js 22.12+ và npm; test frontend dùng Node test runner.
- Media/audio dùng Django upload handlers và PyAV; STT/TTS là provider tùy cấu hình môi trường.

## Coding conventions

- Backend dùng Python/Django patterns hiện có; kiểm tra ownership/auth/CSRF trước khi thêm endpoint.
- Frontend dùng functional React components và hooks; request phải đi qua `frontend-react/src/core.js` (`request`, `useResource`, `useAction`), không gọi `fetch` trực tiếp trong feature.
- Giữ cùng-origin credentials, abort cleanup, pending guard, trạng thái loading/error rõ ràng và không setState sau unmount.
- Dùng `endpoint(lang, path)` cho API học; giữ `/api/manage/` riêng cho admin.
- Component dùng primitives trong `ui.jsx`; giữ accessibility, keyboard behavior, reduced motion và responsive layout.
- Không thêm abstraction chung nếu chưa có ít nhất hai caller cùng contract.
- Khi đổi route/API/schema/export hoặc hành vi người dùng, cập nhật tài liệu và test liên quan trong cùng thay đổi.

## Chạy và kiểm thử

Windows từ repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Script chuẩn bị `.venv`, cài requirements, migrate, build React và chạy Django `8002` + Vite `5173`. Tạo admin mới bằng:

```powershell
.\.venv\Scripts\python.exe -X utf8 manage.py createsuperuser
```

Các lệnh kiểm tra tối thiểu:

```powershell
.\.venv\Scripts\python.exe -X utf8 manage.py check
.\.venv\Scripts\python.exe -X utf8 manage.py test
Set-Location .\frontend-react
npm test
npm run build
```

Không chạy `npm` ở root; package nằm trong `frontend-react`. Smoke test UI cần kiểm tra auth/logout, route `/en` và `/de`, flash/learn/test, import/export deck, book exercise, Content Studio, CSRF/401/403 và media/audio.

## Thay đổi cần thận trọng

- Migrations là lịch sử dữ liệu; không sửa migration đã áp dụng để “sửa nhanh”.
- `BookImportBatch` preview/confirm phải idempotent và không xóa exercise chỉ vì payload bổ sung thiếu exercise.
- Đáp án mơ hồ hoặc thiếu phải chuyển manual/ghi chú, không tự suy luận.
- `private_media` chỉ phục vụ qua API đăng nhập; không thêm vào `STATICFILES_DIRS`.
- Giới hạn quan trọng hiện tại: JSON 5 MB/file, 20 MB/batch; media 10 MB/file, 50 MB/batch; recording 10 MB và 60 giây.
- Production phải đặt `DJANGO_DEBUG=0`, secret ổn định, allowed hosts/CSRF origins đúng, HTTPS và chạy `migrate`, `collectstatic --noinput`, `check --deploy`.

## Tài liệu chuẩn

- Tổng quan kiến trúc, module và contract: `docs/README.md`.
- Chạy, test, deploy và checklist thay đổi: `docs/OPERATIONS.md`.
- Schema JSON sách mẫu: `docs/book-template-v1.json`.

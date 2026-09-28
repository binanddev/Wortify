# Wortify

Ứng dụng học tiếng Anh/Đức: React 19, Vite, Django 5.2, SQLite.

## Chạy trên Windows

```powershell
Set-Location -LiteralPath 'E:\code\bigmywweb'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Hoặc nhấp đúp `start.cmd`. Backend mặc định **8000**, frontend **5173**. Mở http://127.0.0.1:5173. Giữ terminal chạy; Ctrl+C dừng các dịch vụ được cửa sổ này khởi động. Script tự dùng lại đúng Wortify của workspace nếu đã chạy; không tắt chương trình khác chiếm cổng. Có thể đổi bằng `WORTIFY_BACKEND_PORT` và `WORTIFY_FRONTEND_PORT`.

Cần Python 3.12+, Node.js 22.12+ và Internet để cài thư viện lần đầu. Bash/Linux/macOS: `bash start.sh`.

## Dữ liệu thử

```powershell
.\.venv\Scripts\python.exe manage.py seed_development_demo
```

Lệnh chỉ chạy trong DEBUG, không nhân bản khi chạy lại. Tài khoản `demo` (superuser), `learner` (user), `staff` (staff), mật khẩu ban đầu `WortifyDemo2026!`. Nội dung mẫu của demo gồm hai cây Practice Hub có bảy dạng bài mới và lý thuyết; mỗi cây có thêm thư mục **Sân tập UI/UX** với nhiều câu hỏi mẫu cho từng dạng, cùng hai bộ thẻ EN/DE. Bộ văn bản để nhập bài: `frontend-react/public/templates/practice-hub.txt`. User và staff có cùng tính năng học, tạo/sửa nội dung của mình; superuser thêm quản trị người dùng tại `/en/admin` hoặc `/manage`.

## Tạo bài học

Ứng dụng tách hai khu: **Practice Hub** (`/en/practice`, `/de/practice`) chỉ để chọn bài và học; **Xưởng bài tập** (`/en/exercise-studio`, `/de/exercise-studio`) để tạo và quản lý nội dung thuộc sở hữu của mình. Các công cụ tìm, nhập tệp, sửa, đổi tên, chia sẻ, xóa, nhóm và di chuyển đều nằm trong thanh Nav bên cạnh. Màn hình chính chỉ hiển thị nội dung bài học, bản soạn hoặc nội dung xem trước. Người học không chọn lại dạng/style: bài được hiển thị theo cấu hình cố định do người tạo khai báo.

Bài tập bắt buộc có đáp án, chấm ngay tại máy rồi tự lưu kết quả lên tài khoản. Không có bài viết dài hoặc chấm thủ công. Lý thuyết nhận HTML/Markdown; có liên kết học tiếp tùy chọn tới bài/lý thuyết/folder.

Practice Hub hiện có **7 dạng bài, 11 kiểu tương tác** theo mẫu UI: điền từ (kéo/chạm), sửa lỗi (sửa từ/gạch từ thừa), nối cặp, sắp xếp câu, phân loại, chọn trong câu (nút/danh sách), viết lại câu (gợi ý đầu câu/khung tự mở rộng). `giaodien.html` chỉ là tài liệu tham khảo, không được nạp vào hệ thống.

Người học làm **từng câu**, không nộp bài. Câu đủ dữ liệu tự kiểm tra; câu gõ chờ 1,4 giây sau lần nhập cuối và không chấm giữa lúc bộ gõ đang ghép chữ. Đúng tự sang câu tiếp sau phản hồi ngắn, sai làm lại tới khi đúng. Có âm báo bật/tắt, hiệu ứng nhẹ, hỗ trợ giảm chuyển động. Chỉ lưu danh sách câu hoàn thành, không gửi đáp án hay điểm cho luồng mới. Tiến độ được lưu ở thiết bị và đồng bộ vào `PracticeProgress`; nhập lại bài đã sửa bắt đầu tiến độ theo phiên bản mới. Đổi tên/di chuyển giữ tiến độ. Lịch sử dữ liệu cũ được giữ nguyên.

**Nhập bài từ .txt** trong Xưởng bài tập nhận nhiều tệp UTF-8. Một tệp có thể chứa nhiều khối `BAI`. Kiểm tra toàn bộ và xem trước rồi lưu nguyên tử tối đa 100 bài, 100 câu/bài, 2 MB/lô. Trang hướng dẫn: `/en/exercise-studio/guide` hoặc `/de/exercise-studio/guide`. Mẫu đủ 11 kiểu: `frontend-react/public/templates/practice-hub.txt`; quy tắc và ví dụ nằm trong `practice-text-guide.txt`. Trình tạo bài bằng form được giữ trong mã nguồn nhưng không hiển thị. Các đường dẫn tạo bài/hướng dẫn cũ trong Practice Hub chuyển sang Xưởng bài tập.

Trong thanh Nav của Xưởng bài tập, chủ sở hữu sửa nội dung bằng văn bản, tải bản hiện tại, đổi tên, chọn nhiều bài để gom nhóm/chuyển, kéo thẻ vào thư mục, dùng nút mũi tên đổi thứ tự và hoàn tác di chuyển. Máy chủ kiểm tra quyền, chu trình và giới hạn ba cấp thư mục trong một giao dịch. Nội dung công khai của người khác chỉ có thao tác học.

Khi cập nhật phiên bản này, chạy `python manage.py migrate` để tạo bảng tiến độ mới.

## Học và tự lưu

- Flashcards: trộn, chiều mặt, sao, phím tắt, TTS từng mặt.
- Learn: lặp thẻ sai, tiến độ chưa học/quen thuộc/thành thạo, chọn dạng câu, chiều trả lời, mục tiêu số thẻ/thời gian.
- Learn/Test: chọn đáp án là chấm ngay, viền và đáp án xanh/đỏ, sai hiện đáp án đúng. Câu viết dùng Enter/nút ↵; nối cặp chấm khi nối đủ. Test tự lưu khi hoàn thành câu cuối, có thống kê và in/lưu PDF. Gắn sao chỉ dùng icon và không làm nhảy thẻ.
- Cài đặt giao diện, âm thanh, học tập, cấu hình bộ thẻ, sao và tiến độ đều lưu server. Thay đổi gom thành đợt tự động, có hàng đợi tại thiết bị và tự thử lại khi mất mạng. Không cần nút đồng bộ.
- Tải toàn bộ bộ thẻ và tải nền Practice Hub; lật thẻ, nhập đáp án và phản hồi tại máy. Practice Hub chỉ đồng bộ các câu đã hoàn thành, không lưu điểm.
- Giao diện Liquid Glass, độ trong suốt/cỡ chữ tùy chỉnh; âm thanh tương tác và nền tạo bằng Web Audio. TTS dùng giọng trình duyệt/hệ điều hành.

## Phát triển

```powershell
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Đã bỏ Book/Chapter và API tương thích. Migrations phát triển gồm bốn baseline cùng migration bổ sung cài đặt tài khoản. Database trước khi reset được sao lưu tại `.development-backups/` (gitignored). Không fake baseline lên database cũ. Chỉ thay schema mới cần migration; build không sinh migration.

Xem [kiến trúc dự án](docs/AGENTS.md).


### Explore, Create và thư viện giao diện

- `/{lang}/explore`: tìm kiếm nội dung công khai theo tiêu đề, hướng dẫn, ngữ cảnh, câu hỏi và tác giả; bỏ dấu khi tìm, hỗ trợ một số tên thì tiếng Anh/Việt, lọc dạng bài và phân trang. Đây là tìm kiếm từ khóa, không phải tìm kiếm ngữ nghĩa. API không trả nội dung riêng tư hay toàn bộ đáp án.
- `/{lang}/create`: tạo và quản lý nội dung sở hữu; `new` nhập `.txt`, `guide` hướng dẫn. Đường dẫn `exercise-studio` cũ được chuyển sang `create` và giữ phần đường dẫn còn lại.
- Practice Hub vẫn là khu vực học. Explore thêm bài công khai vào cùng workspace của Practice Hub.
- Frontend đã có Tailwind CSS v4, HeroUI và Framer Motion. Explore dùng utility Tailwind, Card/Input/Select/Pagination/Skeleton của HeroUI và chuyển động có tôn trọng reduced-motion. Toàn bộ stylesheet cũ đã chuyển thành module Tailwind trong `frontend-react/src/design-system`; CSS thuần chỉ còn biến theme và keyframe. Django không chứa giao diện ứng dụng.
- Tìm kiếm hiện chuẩn hóa và xếp hạng trên máy chủ với tập nội dung công khai trong ngôn ngữ đang học. Khi thư viện tăng lớn, cần chỉ mục tìm kiếm chuyên dụng để tránh quét toàn bộ tập dữ liệu mỗi truy vấn.


### Bảo trì giao diện

Entry duy nhất: `frontend-react/src/design-system/index.css`. Màu và biến giao diện nằm trong `tokens.css`; component HeroUI dùng chung trong `src/ui.jsx`. Style theo khu vực được viết bằng utility Tailwind (`@apply` cho selector/trạng thái hiện hữu). Không còn import `styles.css`, `glass.css`, `practice-ux.css` hoặc `profile.css` cũ.

`npm run build` tạo frontend độc lập trong `frontend-react/dist`. Django không đọc manifest hoặc phục vụ React. `npm test` gồm kiểm tra CSS sau biên dịch và logic tương tác; không thay thế kiểm tra trực quan.

### Django chỉ phục vụ API và admin

- React/Vite sở hữu toàn bộ route ứng dụng, trang đăng nhập và tài nguyên giao diện. Mở frontend ở cổng 5173 khi phát triển. `npm --prefix frontend-react run preview` phục vụ bản build ở cổng 4173 và proxy API/admin tới Django.
- Django cổng 8000 chỉ xử lý `/api/…` và `/admin/…`. Các đường dẫn trang như `/`, `/login`, `/en/practice` trên cổng backend trả JSON 404. CSRF được khởi tạo qua `/api/session/`.
- Template, static CSS/JS, view dựng trang cũ, React shell và cấu hình `REACT_DIST` đã được gỡ. Các API học, chấm, âm thanh, xuất dữ liệu và kiểm tra quyền vẫn hoạt động. Django ModelForm còn dùng để xác thực payload, không render giao diện.
- Admin mặc định của Django được giữ, gồm đăng nhập và static đi kèm thư viện Django; không còn template override branding. `collectstatic` chỉ cần cho admin, không thu gom frontend.
- Khi triển khai, phục vụ `frontend-react/dist` bằng web server và fallback route React về `index.html`; proxy `/api/` và `/admin/` tới Django trên cùng origin. Ví dụ tại `frontend-react/deploy/nginx.conf`. Điều chỉnh tên miền, đường dẫn và HTTPS; chỉ bật `DJANGO_TRUST_PROXY=1` khi Django đứng sau proxy tin cậy tự thiết lập `X-Forwarded-Proto`.
- Các URL media `/static/react/…` đã lưu từ trước được frontend nhận và chuyển về tài nguyên frontend. Django không còn xử lý những URL này.

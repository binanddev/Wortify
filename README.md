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

Lệnh chỉ chạy trong DEBUG, không nhân bản khi chạy lại. Tài khoản `demo` (superuser), `learner` (user), `staff` (staff), mật khẩu ban đầu `WortifyDemo2026!`. Nội dung mẫu của demo gồm hai cây Practice Hub có chín dạng bài và lý thuyết, hai bộ thẻ EN/DE. User và staff có cùng tính năng học, tạo/sửa nội dung của mình; superuser thêm quản trị người dùng tại `/en/admin` hoặc `/manage`.

## Tạo bài học

Practice Hub mở cây nội dung ở thanh bên. **＋** cạnh “Tất cả nội dung” tạo ở cấp gốc; **＋** tại thư mục tạo nội dung con. Tạo folder chỉ cần tên, bài/lý thuyết tự nhận vị trí đang chọn. **Di chuyển** chọn đích riêng sau khi tạo; tối đa ba cấp folder. Thanh bên liền khối có icon xoay cố định, hỗ trợ vuốt ngang để lật, thu gọn và mở lại khi đưa chuột về mép trái.

Bài tập bắt buộc có đáp án, chấm ngay tại máy rồi tự lưu kết quả lên tài khoản. Không có bài viết dài hoặc chấm thủ công. Lý thuyết nhận HTML/Markdown; có liên kết học tiếp tùy chọn tới bài/lý thuyết/folder.

**Nhập JSON / Lấy mẫu** có mẫu folder, bài, lý thuyết; trình soạn bài hỗ trợ thêm câu hỏi bằng JSON. Mẫu đầy đủ: `frontend-react/public/templates/practice-hub.json`. Cấu trúc gốc `nodes`, thư mục có `children`, bài có `payload.questions`. Nhập cây nguyên tử: lỗi không lưu một phần. Chọn liên kết sau khi nhập.

## Học và tự lưu

- Flashcards: trộn, chiều mặt, sao, phím tắt, TTS từng mặt.
- Learn: lặp thẻ sai, tiến độ chưa học/quen thuộc/thành thạo, chọn dạng câu, chiều trả lời, mục tiêu số thẻ/thời gian.
- Learn/Test: chọn đáp án là chấm ngay, viền và đáp án xanh/đỏ, sai hiện đáp án đúng. Câu viết dùng Enter/nút ↵; nối cặp chấm khi nối đủ. Test tự lưu khi hoàn thành câu cuối, có thống kê và in/lưu PDF. Gắn sao chỉ dùng icon và không làm nhảy thẻ.
- Cài đặt giao diện, âm thanh, học tập, cấu hình bộ thẻ, sao và tiến độ đều lưu server. Thay đổi gom thành đợt tự động, có hàng đợi tại thiết bị và tự thử lại khi mất mạng. Không cần nút đồng bộ.
- Tải toàn bộ bộ thẻ và tải nền Practice Hub; lật thẻ, nhập đáp án và phản hồi tại máy. Kết quả nộp bài được gửi để server kiểm tra và lưu lịch sử.
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

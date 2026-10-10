# Wortify Frontend

React/Vite độc lập, giao tiếp với Backend qua `/api/`. Cấu trúc dưới đây là nơi tham chiếu chính khi thêm hoặc sửa mã nguồn.

## Cấu trúc mã nguồn

```text
src/
  main.jsx                 # Entry, provider và error boundary
  hero.js                  # Plugin HeroUI cho Tailwind
  app/App.jsx              # Routing, session và ghép khung ứng dụng
  home/home.jsx            # Trang chủ độc lập với theme
  lib/core.js              # HTTP, cache, routing helpers và hooks nền tảng
  components/
    ui/                    # Button, Field, Icon và UI dùng chung
    modal/                 # Modal dùng chung
    navigation/            # Resize nav, kích thước và cây điều hướng
  features/
    account/               # Hồ sơ học tập và cộng đồng/lớp học
    admin/                 # Quản trị, tài liệu API, quản lý hệ thống
    appearance/            # Thư viện theme, ảnh cá nhân, cache và tương phản
    audio/                 # Phát nhạc, danh mục MP3 và âm thanh
    explore/               # Khám phá và lịch sử tìm kiếm
    flashcards/            # Bộ thẻ, thư viện, luyện và ôn tập
    learning/              # Chấm bài, đồng bộ, thời gian và bỏ qua dùng chung
    practice/              # Bài tập, biên soạn, nhập liệu và các tương tác
    settings/              # Trang cài đặt giao diện, âm thanh, học tập
  themes/                  # Định nghĩa giao diện, icon và tùy chỉnh theo theme
  design-system/           # CSS component/layout, responsive; index.css là entry
```

### Đặt code ở đâu?

- Code chỉ phục vụ một tính năng nằm trong folder của tính năng đó, kể cả component, hook và hàm xử lý. Không tạo folder riêng cho từng component nhỏ.
- Component được nhiều tính năng sử dụng nằm trong `components/`. Không chuyển logic nghiệp vụ vào đây chỉ vì có JSX.
- Logic học tập được flashcard và bài tập cùng sử dụng nằm trong `features/learning/`. Tiện ích hạ tầng không gắn nghiệp vụ nằm trong `lib/`.
- `features/appearance/background-library.jsx` quản lý hành vi tải lên/chọn/xóa ảnh nền dùng chung. `themes/` định nghĩa cách theme hiển thị và lưu tùy chỉnh; hai phần có vai trò khác nhau.
- `app/App.jsx` ghép các tính năng và điều phối session/routing. Hiện form đăng nhập vẫn nằm ở đây; hồ sơ/lớp học nằm trong `features/account/`. Không nhân bản form hoặc logic tài khoản theo theme.
- Khi sửa tính năng, sửa module chung của tính năng một lần. Chỉ sửa folder theme nếu thay đổi màu, font, bề mặt, icon hoặc quy tắc riêng của giao diện.

### Import và phụ thuộc

Dùng import tương đối tới module thực tế; không giữ file chuyển tiếp ở đường dẫn cũ. `app` ghép các feature; feature sử dụng component, tiện ích và theme. Không để component dùng chung import ngược trang hoặc `App`. Tránh vòng phụ thuộc và các file barrel xuất lại toàn bộ thư mục. Khi hai feature cần cùng logic, cân nhắc đưa phần đó vào `features/learning` hoặc `lib` theo đúng trách nhiệm.

Đợt sắp xếp này giữ tên module và hành vi hiện có, không viết lại nội dung từng module lớn. CSS component vẫn được quản lý tập trung tại `design-system` để giữ cascade; không import thêm CSS tùy ý từ từng trang. Hướng dẫn theme: [src/themes/README.md](src/themes/README.md).

### Thêm hoặc sửa tính năng

1. Tìm feature sở hữu hành vi; tạo folder mới chỉ khi đó là một nhóm chức năng độc lập.
2. Đặt UI và logic riêng trong feature. Tái sử dụng `components/ui`, modal và navigation thay vì sao chép.
3. Gắn trang vào routing trong `app/App.jsx` nếu cần. Giữ URL API và dữ liệu lưu tương thích, trừ khi chủ động thực hiện migration.
4. Dùng token CSS và kiểm tra các trạng thái hover, focus, đúng/sai trên các theme; không sao chép trang theo theme.
5. Cập nhật import trong `tests/`, `scripts/` khi di chuyển file. Chạy `npm test`, `npm run build`; thay đổi UI thì chạy thêm `npm run test:interface` (Chrome đọc fixture cục bộ, không khởi động web).

Không cập nhật baseline CSS chỉ để bỏ qua lỗi refactor. Việc đổi vị trí file phải giữ nguyên kết quả CSS. Tests vẫn nằm tại `tests/`; tài nguyên phục vụ trực tiếp nằm tại `public/`.

## Chạy độc lập

Yêu cầu Node.js >=22.12 và npm >=10. Thực hiện trong thư mục này (hoặc gốc repo frontend sau khi tách):

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
```

Mở http://127.0.0.1:5173. Backend mặc định http://127.0.0.1:8000; đổi `DJANGO_DEV_ORIGIN` trong `.env` nếu backend chạy ở địa chỉ khác rồi khởi động lại Vite. `.\start.ps1` hoặc `bash start.sh` cũng cài dependency còn thiếu và chạy frontend. `npm test`, `npm run build`, `npm run preview` đều chạy ngay trong repo này. Preview dùng cổng 4173 và cùng cấu hình proxy.

Trình duyệt luôn gọi `/api/` trên origin của frontend. Vite khi local và Nginx/Netlify khi triển khai chuyển tiếp request tới backend; session cookie, CSRF và các URL media tiếp tục cùng origin. Không cần chia sẻ filesystem, database hay secret Django với frontend. Nếu backend từ xa kiểm tra Host/CSRF, cấu hình backend cho origin frontend tương ứng.

## Triển khai không Docker

Xem [deploy/README.md](deploy/README.md) cho quy trình triển khai trực tiếp, cấu hình mẫu và cập nhật release.

## Tách repo

Copy nội dung thư mục này vào repo frontend mới, gồm các file ẩn mẫu và cấu hình. Bỏ `node_modules`, `dist`, `.env*` thực tế (giữ các `.example`). Cài lại bằng `npm ci`. Không cần bất kỳ file nào ở thư mục cha hay repo backend.


Giọng TTS/micro phụ thuộc thiết bị. Practice Hub yêu cầu đáp án khi tạo; không có bài viết dài hoặc chấm thủ công. Hướng dẫn kiến trúc và giới hạn hiện tại: docs/AGENTS.md.

## Nav, modal và âm thanh

Màn hình rộng tối đa 1024px có thanh Menu / Công cụ trang; chọn liên kết, chạm ra ngoài hoặc Escape để đóng nav. Trong Cài đặt học tập, Kích thước thanh điều hướng cho phép thu/phóng 50–150% và đặt lại 100%; trên desktop vẫn kéo cạnh nav được. Kích thước được đồng bộ theo tài khoản. Trên điện thoại, khung nav luôn giới hạn theo chiều rộng màn hình.

Mọi modal dùng lớp portal riêng dưới body, trên nav; nội dung dài cuộn bên trong. Popover của bài tập trong modal dùng cùng lớp portal.

Cài đặt dùng 20 bản MP3 trong `public/audio/ambient`, nguồn gốc tệp được ghi trong `SOURCES.json`. Chọn bài, bật/tắt và âm lượng được lưu theo tài khoản. Chỉ tải bản đang nghe; nhạc tạm dừng khi audio/video/TTS phát hoặc tab bị ẩn. Trình duyệt có thể yêu cầu tương tác trước khi phát.

## Giao diện

Studio là giao diện mặc định: nền sáng ấm, nav xanh chàm, bề mặt đặc và thẻ học hai màu. Trong Cài đặt, chọn Studio, Glass, Windows, Retro Arcade hoặc Space; đổi có hiệu lực ngay và đồng bộ tài khoản. Glass cố định chữ/icon trắng và chỉ cho chỉnh độ trong suốt 10–100%; thư viện ảnh nền dùng chung cho mọi giao diện. Không còn tạo/lưu preset theme cá nhân.

Icon dùng bộ Wortify Rounded trong `src/components/ui/icon-paths.js`, nét 2.25px, kích thước tối thiểu 22px; icon nav chính có nền đặc, không đổi theo transparency. Flashcard không áp dụng filter/backdrop-filter vào cảnh lật 3D hoặc mặt thẻ.

Kiểm thử CSS bằng trình duyệt ẩn, không chạy web: `npm run build` rồi `npm run test:interface`. Script dựng tệp HTML tạm với CSS production, kiểm tra hover/lật và độ trong suốt của giao diện. Windows mặc định dùng Chrome; hệ điều hành khác đặt `CHROME_PATH` tới trình duyệt Chromium. `INTERFACE_SCREENSHOT` tùy chọn đường dẫn ảnh xem trước.

Giao diện gồm Studio (mặc định), Glass, Windows, Retro Arcade và Space. Tùy chỉnh lưu riêng cho từng giao diện. Trang chủ có thiết kế độc lập; các nhóm Cài đặt nằm ở mặt sau nav.

## Ảnh nền và Retro

Cài đặt → Giao diện gồm bộ chọn phong cách, thư viện tối đa 10 ảnh nền riêng tư (JPG/PNG/WebP, 30 MB/ảnh) và các tùy chỉnh của giao diện đang dùng. Chọn/upload ảnh áp dụng ngay cho mọi giao diện và cả EN/DE; trang chủ vẫn độc lập. Xóa ảnh đang dùng trở về nền mặc định. Ảnh cá nhân cũ được giữ và tính trong giới hạn.

`features/appearance/background-library.jsx` gọi `/api/me/backgrounds/`, `/select/`, `/{id}/`; sau mutation xóa snapshot ảnh và thông báo App tải manifest mới. Không dùng dữ liệu ảnh để thay đổi typography hoặc interface. `themes/shared/backgrounds.css` áp dụng ảnh chung, các panel đặc giữ nội dung dễ đọc. Retro dùng màu giấy ấm, xanh rêu cho hành động chính, đỏ gạch cho focus/lỗi; font monospace chỉ dành cho tiêu đề, nội dung học dùng sans-serif. Tôn trọng reduced motion.

### Nền mặc định tạo từ code

Cài đặt có mục **Ảnh nền** riêng trên nav. `id: null` đặt lại nền theo giao diện, giữ nguyên toàn bộ ảnh đã tải lên; `id: 0` chỉ dành cho ảnh cá nhân cũ. Các theme dùng `themes/DefaultBackground.jsx` và `themes/shared/default-background.css`: SVG/CSS, không tải ảnh ngoài. Retro là cảnh pixel chạng vạng với làng sách, đường đi, nhân vật và mây; các giao diện còn lại có chất nền và biểu tượng riêng. Chi tiết điều chỉnh cho màn hình hẹp. Nền không nhận chuột, không xuất hiện ở trang chủ và ẩn khi chọn ảnh cá nhân.

Chuyển động dùng CSS transform/opacity, dừng khi tab ẩn; checkbox trong mục Ảnh nền lưu lựa chọn trên thiết bị. `prefers-reduced-motion` luôn được tôn trọng. Xem trước cục bộ bằng `node scripts/render-background-preview.mjs` sau build; không cần khởi động web.

### Theme Windows

Tên hiển thị là **Windows**; ID `xp` và thư mục `src/themes/windows-xp/` được giữ để tương thích cài đặt đã lưu.
- XP.css: thanh tiêu đề và khung cửa sổ; 98.css: bảng, fieldset, status bar và viền nổi/chìm. CSS được chọn lọc và scope dưới `:root[data-interface="xp"]` bằng `node scripts/build-windows-vendor.mjs`.
- React95: thanh tác vụ và menu Bắt đầu, với ThemeProvider cục bộ. Không dùng global reset của thư viện.
- `WindowsBackground.jsx`: nền trời và đồi xanh SVG, không tải ảnh. Ảnh nền cá nhân vẫn ưu tiên theo cơ chế nền chung.
- `desktop.css`: bố cục, vật liệu và điều khiển Windows. Không thêm selector không scope, ngoại trừ quy tắc ẩn mặc định của cảnh Windows.
- Giấy phép thư viện nằm trong `src/vendor/LICENSE-*`. Sau khi nâng phiên bản thư viện, sinh lại CSS và chạy test/build.

### Windows Web Desktop

Windows dùng `WindowsDesktop.jsx` và `desktop-state.js` để quản lý nhiều ứng dụng cùng lúc. Mỗi tính năng (Flashcard, Practice, Explore, Create, hồ sơ, lớp học, cài đặt, quản trị theo quyền) có một cửa sổ riêng. Bấm icon hoặc Start lần nữa đưa phiên đang mở ra trước, không reset bài. Thu nhỏ giữ component mounted; đóng cửa sổ yêu cầu xác nhận và kết thúc phiên UI đó. Trạng thái desktop tồn tại trong phiên trang hiện tại, không khôi phục toàn bộ cửa sổ sau reload.

- `WorkspaceContent` dùng chung cho chế độ trang thông thường và các cửa sổ Windows; không nhân bản nghiệp vụ/API.
- `WindowContext` cung cấp route, `useNavigate`, trạng thái focus và nơi nhận `SidebarTools`. Các callback bất đồng bộ giữ điều hướng của cửa sổ sở hữu; không gọi trực tiếp `navigate` toàn cục từ tính năng. Ngoài desktop các hook này dùng router cũ.
- Desktop có icon, menu Start, taskbar; không render nav cũ. Mỗi cửa sổ ứng dụng có sidebar riêng bên trái chứa điều hướng và công cụ; đổi focus không di chuyển hoặc ẩn công cụ của cửa sổ khác.
- Nội dung lõi rộng tối thiểu 760px; cửa sổ nhỏ cuộn ngang/dọc. Kéo thanh tiêu đề để di chuyển, góc dưới phải để resize (phím mũi tên cũng dùng được), nút vuông để phóng to/khôi phục.
- Modal vẫn giữ focus trap và xác nhận dữ liệu của HeroUI, với viền/thanh tiêu đề XP và khả năng kéo; đây là cửa sổ con modal, cần xử lý hoặc đóng trước khi quay lại desktop.
- Chỉ ứng dụng focus nhận phím tắt học tập. CSS mới scope `data-interface="xp"`; các theme khác tiếp tục dùng shell một trang.
- Kiểm thử: `npm test`, `npm run build`, `npm run test:interface`, `node scripts/verify-windows-desktop.mjs`. Fixture cuối chạy từ file HTML, không cần khởi động server.

### English interface and Windows application sidebars

All interface labels, accessible names, validation messages and API documentation use English, independently of the selected theme or learning language. Keep lesson content, user-authored text, language voices and existing data unchanged. `tests/english-interface.test.mjs` scans source literals, with explicit exceptions for multilingual examples and legacy sync receipts. Django uses `en-us`; frontend dates use `en-GB`.

Each Windows app has its own left sidebar. `DesktopWindow` owns the stable `SidebarTools` portal target inside that sidebar; focus changes must not move or remount tools. `renderNavigation` renders the app-specific tree inside the same route context. The title-bar menu button toggles that sidebar. The old separate Tools app is removed.

Desktop shortcuts use colored artwork and pointer capture for dragging. Movement suppresses launching; Enter opens the app, Alt + arrow keys move the icon. Positions are saved locally with `wortify:windows-shortcut:<app>`, and clamped to the viewport. These preferences do not modify lesson data or other themes.

Practice Hub groups My practice (`/:lang/practice`), Discover (`/:lang/explore`) and Create (`/:lang/create`). Existing URLs remain valid. PracticeArea owns navigation only; feature components retain their API and permissions. Windows maps all three routes to the practice window. Deep learning/authoring routes show a compact back link. Dialogue and elimination styles accept one answer; legacy multi-answer rendering remains available.

Practice Hub section links now live in the shared SidebarTools portal (back navigation, or the Windows window sidebar). My practice opens `/practice/all`; the catalog displays 15 folders per page and resets pagination when searching. Dialogue and Elimination hide the unsupported multiple-answer option.

Multiple-choice options are shuffled only in the question renderer, with stable ordering while answering. Authoring/import/export retain stored order and accepted answer text. Inline gap choices are also shuffled per question. True/False/Not given retains semantic order. Elimination is an optional, ungraded crossing-out aid; the selected answer is graded normally.

Drag-fill exercises share the union of all question word banks, distractors, and gap choices on every sentence. Repeated words keep the maximum required multiplicity across questions. Each sentence starts with the full bank; previously completed sentences do not consume it. Authoring preserves imported WORDS and automatically includes gap answers.

Authors can select Word bank scope: Separate choices for each question or Shared choices for the whole exercise. Legacy exercises default to shared. Text import/export uses BANK_SCOPE: question/exercise before QUESTION. Inline multiple choice offers Choose and reveal (STYLE: fall_away): incorrect alternatives disappear after successful checking. Example: QUESTION: She {{1}} a teacher. and BLANK: is => is | are | am.

Settings > Backup & restore uses the authenticated account backup API. It flushes both language sync queues before export, previews ZIP record counts before restoration, and restores content as private copies. See `../Backend/BACKUPS.md` for the versioned archive contract and limits.

Administration uses an independent `/manage` console opened from Home. Legacy `/en/admin` and `/de/admin` links still open the same console. Learning navigation and Windows desktop no longer advertise an admin app. Superusers can export all, filtered, or selected accounts. See Backend/BACKUPS.md for archive details.

Admin data grids: Users, Content and Activity use sticky headers/identity columns, per-grid column visibility, and server-side multi-column ordering (Shift-click adds a sort key). Light/Dark and Comfortable/Cozy/Compact are independent admin display preferences. Role/status inline editors save through existing authorized account endpoints, with explicit Save/Cancel.


### Admin presentation isolation
The admin workspace uses `data-interface="admin"` and its own Light/Dark palette in
`src/design-system/admin.css`. Learning background selectors explicitly exclude
Admin; its canvas is a solid color. Appearance changes are restored when leaving
Admin and do not update a learner's saved theme.
Tables default to Compact (existing density preferences are retained). HeroUI
Dropdown/Popover provides portalled actions, filters and column controls without
changing row height. Identity and Actions columns remain fixed during horizontal
scrolling. Destructive actions retain the existing confirmation and API checks.
Offline checks after `npm run build`: `node scripts/verify-admin-grid.mjs` and
`node scripts/verify-admin-menu.mjs`; neither starts a web server.

### Lesson markup and Admin change log
Practice display text and Markdown theory share the safe parser in
src/features/practice/content-markup.js. It supports LaTeX-style line breaks,
emphasis, alignment, quote/list/tabular environments and includegraphics with
bounded dimensions and alignment. This is a display subset, not a full TeX/math
compiler. Raw HTML is escaped; legacy HTML theory remains sandboxed in an iframe.
Blank callbacks keep answer controls inside the formatting tree; grading data,
choices, word banks and error-correction tokens remain plain text.

Create includes the Formatting guide, sample downloads and theory preview.
Theory image uploads use the existing authenticated media endpoint and attachment
ownership/visibility checks. Keep uploaded images attached when embedding their
URL. Public-collection copying rewrites embedded media URLs to the new owner.
External image URLs are not bundled in text downloads or user backups.

Admin > Change log reads src/features/admin/history.md. The sync:history script
copies ../history.md when present, before dev/build (including Netlify builds).
The bundled copy is retained when Frontend is deployed as a standalone repo.

Offline regression: npm test; node scripts/verify-lesson-markup.mjs after building.
Import public/samples/formatted-practice.txt in Create; paste formatted-theory.txt
into a Markdown theory document.

### v1.2.1 exercise preferences and comments
Settings > Learning exposes exerciseTextSize (16–36px, default 22) and
exerciseTextWeight (400–700, default 500). They use the existing per-user
preference sync, separate from theme appearance profiles. Only exercise content
uses these CSS variables; navigation and action buttons keep their own sizing.
Authors may set COMMENT before the first QUESTION for a shared exercise note,
and EXPLANATION after any QUESTION, including each matching pair. Both round-trip
through text import/export and support lesson markup. Explanations stay hidden
until a correct answer or reveal; matching reveals each solved pair separately.

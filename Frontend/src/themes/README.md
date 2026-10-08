# Theme architecture

- `registry.js`: danh sách giao diện; mã `xp` giữ nguyên để tương thích cài đặt đã lưu.
- `preferences.js`: lưu/khôi phục tùy chỉnh riêng theo giao diện và nền.
- `apply.js`: áp dụng tùy chỉnh vào DOM.
- `icons.js`: tập hợp icon riêng; icon không ghi đè vẫn dùng bộ chung của UI.
- `studio/`, `glass/`, `windows-xp/`, `retro/`, `space/`: CSS và icon riêng. `glass/policy.js` chứa giới hạn chỉnh sửa Glass.
- `shared/`: chất liệu, điều khiển và quy tắc chung giữa các giao diện.
- `identity.css`: điểm nối CSS cho các theme bổ sung, giữ thứ tự cascade hiện tại.

`src/design-system/index.css` vẫn là CSS entry duy nhất. Các import theme giữ đúng vị trí so với CSS component, độ tương phản và tương tác; không gom lại tùy ý vì có thể đổi cascade. `styles.css` chứa màu/bề mặt, `details.css` chứa font/hình dáng/icon, `preview.css` dành cho hình xem trước trong bộ chọn theme.

Logic bài tập, nav, modal và tài khoản tiếp tục dùng component chung. Không sao chép component theo theme. CSS riêng phải có phạm vi `[data-interface="..."]` hoặc class preview riêng; quy tắc toàn cục đặt trong shared/design-system. Trang chủ độc lập với theme.

Khi thêm theme: tạo folder, đăng ký trong registry, thêm CSS import và icon nếu cần. Dùng tên biến hiện có của component. Cập nhật whitelist phía Backend (`users/preferences.py`) và tài liệu API nếu thêm mã giao diện mới. Giữ Studio làm mặc định.

Kiểm tra bằng `npm test`, `npm run build`, `npm run test:interface`. Test CSS duyệt cả themes và design-system. Chỉ cập nhật baseline khi chủ động thay đổi thiết kế, không cập nhật để che lỗi khi di chuyển file.

Thư viện ảnh nền dùng chung ở `../features/appearance/background-library.jsx`; trang cài đặt ở `../features/settings/learning.jsx`. Xem `../../README.md` để hiểu cấu trúc feature/component.

## NES.css và RPGUI

Retro tích hợp NES.css 2.3.0 (nút, balloon, biểu tượng và progress) cùng RPGUI 1.0.3 (khung nine-slice và cursor). Dependencies được khóa trong package-lock. `node scripts/build-retro-vendor.mjs` tạo lại `src/vendor/retro-libraries.css`; không sửa file sinh trực tiếp. Generator chỉ chọn phần dùng được trong React, giữ media/support rules, thêm phạm vi `[data-interface="retro"]` và nhúng cursor để hoạt động khi build. CSS entry vẫn duy nhất tại design-system/index.css.

Không chạy RPGUI JavaScript vì nó tự sửa DOM/điều khiển form; React và HeroUI tiếp tục quản lý tương tác, focus và modal. Không tải Google Fonts/CDN ở runtime. Chữ học tập giữ sans-serif để đọc tiếng Việt/Đức rõ. `arcade.css` điều phối màu, kích thước và trạng thái, không sao chép logic feature theo theme.

Giấy phép và nguồn: `src/vendor/LICENSE-NES.txt` (https://github.com/nostalgic-css/NES.css), `src/vendor/LICENSE-RPGUI.txt` (https://github.com/RonenNess/RPGUI). File sinh là bản đã chọn lọc và chỉnh scope, không phải bản phân phối nguyên gốc. Biểu tượng động là trang trí (ẩn với screen reader), không giả lập điểm thưởng hoặc tiến độ thật. Chuyển động tuân theo lựa chọn dừng nền và reduced-motion.

### Retro: typography và các lớp nền

`retro/pixel-polish.css` chỉ có selector Retro: VT323 400 được self-host từ @fontsource/vt323 (gồm latin, latin-ext, vietnamese; giấy phép tại src/vendor/LICENSE-VT323.txt). Các shell/page/catalog trong suốt, màu giấy chỉ nằm trong panel cụ thể. Các control vuông, Next/check có bóng pixel cứng. Native progress vẫn giữ value/max và aria-label; CSS chia fill thành các khối, không dùng transition width. Không đổi logic chấm bài hoặc component của các theme khác.

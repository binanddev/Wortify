# Bàn giao Wortify — 2026-10-21

## Đọc trước khi sửa

- Repo local: `E:/code/bigmywweb`; nhánh làm việc trước đó `minhtien`. Kiểm tra `git status` và diff thực tế trước khi sửa; không reset các thay đổi chưa commit.
- Đọc `docs/AGENTS.md`, README tương ứng Backend/Frontend, `Frontend/src/themes/README.md` và `history.md` để nắm cấu trúc. Các mô tả lịch sử có thể cũ; mã hiện tại là nguồn xác minh.
- Không tự khởi động web/server. Build, unit test và fixture HTML tĩnh được dùng để kiểm tra. Không test web deploy trước khi người dùng xác nhận đã deploy.
- Không commit/push nếu yêu cầu hiện tại chưa có chỉ dẫn. Lần push được xác nhận trước đợt này là version 1.9.0, commit 7878bc2; kiểm tra Git trước khi phát hành tiếp.
- Giữ database/media local; không đọc hoặc đưa secret vào tài liệu/Git. Không ghi tài khoản, mật khẩu vào bàn giao.
- UI gọn, ưu tiên icon đúng nghĩa, component HeroUI/shared hiện có, modal khi phù hợp. Không thêm các đoạn giải thích dài thường trực lên giao diện. EN/VI/DE dùng bản dịch thủ công.

## Các thay đổi local chưa phát hành

### Ảnh flashcard
- Chỉ lưu URL HTTPS và metadata nguồn/giấy phép; không tải ảnh lên backend, Neon hay lưu base64/binary.
- Migration `Backend/cards/migrations/0012_card_image_links.py` đã tạo, chưa áp dụng vào database local trong đợt làm việc này. Test dùng database riêng.
- Tạo/sửa thẻ có dán link, tìm ảnh; hiển thị ảnh trong học/xem trước/import/export/copy. Phần dán link giữ nguyên theo yêu cầu mới nhất.
- Tìm ảnh ưu tiên mục từ chính xác trên Wikipedia theo ngôn ngữ bộ thẻ, dùng nghĩa VI làm lookup phụ, rồi Commons chỉ tìm tên file. Lọc giấy phép, giữ attribution. Không đảm bảo ảnh đúng cho mọi từ đa nghĩa/trừu tượng; có bước duyệt.
- Auto ảnh xử lý tất cả thẻ chưa có ảnh, dừng/tiếp tục, lỗi riêng từng từ, dừng khi gặp 429, phân trang preview 24 và lưu lô 50. Không ghi đè ảnh đã có; giữ lô đã lưu khi lô sau lỗi. Ảnh lỗi tải bị bỏ chọn.
- Mã chính: `Frontend/src/features/flashcards/image-search.js`, `auto-card-images.jsx`, `card-image-picker.jsx`; API `Backend/api/views.py` hàm `card_images`.

### Icon
- Bộ dùng chung chuyển sang Lucide React, danh mục semantic ở `Frontend/src/components/ui/icon-catalog.js`; bỏ bộ path tự vẽ chung cũ.
- Component `Icon` trong `ui.jsx` chọn glyph theo theme bằng hook `use-interface.js`, chỉ render một SVG; giữ override Notebook/Windows/Retro/MS-DOS. Retro dùng NES.css cho star/heart/trophy. Các thư viện theme không có bộ icon đầy đủ thì dùng Lucide fallback theo màu/nét theme.
- Tách chức năng: Practice=exercise, Reading=book, Explore=compass, search=magnifier, filter=funnel, manage=list, learn=graduation, game=controller. Sửa tên dynamic users/calendar và home/settings MS-DOS. Icon nhỏ tôn trọng size, nút giữ hit target chung.
- Quy ước chi tiết tại `Frontend/src/themes/README.md`.

## Kiểm tra đã thực hiện

- Frontend: 154 tests pass; production build pass sau chỉnh căn giữa NES.
- Backend ảnh/import: 23 tests pass; thêm kiểm tra copy/clear chạy lại 4 tests pass. Migration dry-run không phát hiện thiếu migration.
- `node scripts/verify-card-images.mjs`: URL, giấy phép, cache, fallback ảnh lỗi.
- `node scripts/verify-auto-card-images.mjs`: 51 thẻ, phân trang, lô 50, lỗi lưu giữa chừng và retry.
- `node scripts/verify-icons.mjs`: gallery/check 74 icon trên 6 theme, ảnh chụp tại `.interface-preview` (ignored). Cả 6 theme đều pass; đã xem ảnh Studio/Retro/MS-DOS và sửa căn giữa NES.
- Chưa kiểm tra trên web deploy thật, chưa push các thay đổi trên.

## Chat mới

Bắt đầu bằng yêu cầu đọc file này và kiểm tra Git diff, sau đó nêu rõ tính năng mới. Không xem bàn giao như yêu cầu làm lại mọi việc lịch sử. Không giả định chat mới có toàn bộ transcript chat cũ.

## Sửa nav sau phản hồi ảnh
- Loại SVG lồng gây áp màu và phép xoay hai lần; icon lật nav hoạt động cả hai mặt. Nav dùng màu chữ để đồng bộ, MS-DOS hiển thị icon chức năng.
- `verify-nav-icons.mjs` chụp Workspace thật với mock data trên cả sáu theme; Windows dùng Start menu. Không khởi động web.

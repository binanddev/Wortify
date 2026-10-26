# Hướng dẫn admin: xuất, sao lưu và khôi phục dữ liệu

Áp dụng từ Wortify 1.14.0. Chỉ tài khoản Admin (superuser) đang hoạt động được dùng chức năng này.

## 1. Mở công cụ

Đăng nhập tài khoản Admin, mở Quản trị → Sao lưu & nhập. Phần Xuất dữ liệu website là công cụ mới; công cụ Sao lưu khẩn cấp và nhập tài khoản nằm trong phần thu gọn phía dưới. Mở Hướng dẫn sử dụng để đọc hoặc tải tài liệu này.

## 2. Chọn cấu hình theo mục đích

- **Toàn bộ học liệu:** chọn khi cần giữ nội dung quan trọng nhất của web mà không kèm hồ sơ tài khoản. Mặc định xuất mọi tài khoản, cả công khai và riêng tư, tất cả phần học và tệp đính kèm. Bao gồm kho hệ thống chưa gắn tài khoản. Không kèm tiến độ cá nhân.
- **Học liệu công khai:** dùng để phân tích hoặc lưu kho nội dung công khai. Giữ bộ thẻ, bài tập/lý thuyết và bài đọc công khai, cùng bài đọc hệ thống chưa được chuyển thành nội dung tài khoản. Thư mục cha riêng tư chỉ giữ cấu trúc và tên; nội dung riêng bên trong không được kéo vào.
- **Nội dung và tài khoản:** chọn khi chuẩn bị một gói dữ liệu tổng hợp có chủ sở hữu, hồ sơ, cấu hình, nhóm/quyền, lớp học, tiến độ và nhật ký. Kiểm tra các tùy chọn trước khi tải. Mật khẩu băm mặc định không xuất.
- **Chỉ tài khoản:** chọn khi cần danh sách tài khoản, hồ sơ, cài đặt học, giao diện và quyền; không kèm học liệu. Có thể bật media để giữ ảnh/nền hồ sơ và giao diện.

Ví dụ để lưu kho học liệu toàn web: bấm Toàn bộ học liệu, giữ cả công khai và riêng tư, tất cả phần học/ngôn ngữ/tài khoản, không giới hạn ngày và bật tệp đính kèm. Không cần bật lịch sử học.

Ví dụ để lưu dữ liệu của một người: chọn Nội dung và tài khoản → Các tài khoản được chọn, tìm tên/email rồi đánh dấu người cần xuất. Bật tiến độ nếu cần kết quả học. Tùy chọn mật khẩu băm chỉ cần khi có nhu cầu phục hồi mật khẩu hiện tại.

## 3. Điều chỉnh phạm vi nội dung

Các phần học thực tế gồm **Flashcards**, **Practice** và **Reading**. Practice chứa toàn bộ các kiểu bài tập và lý thuyết, bao gồm nghe/chính tả; không có bộ lọc riêng theo ngữ pháp/nghe/nói/viết. Gói giữ đáp án được chấp nhận, giải thích, nội dung bài, vị trí, cây thư mục và dữ liệu lồng nhau.

Chọn công khai, riêng tư hoặc cả hai; chọn Đức/Anh hoặc tất cả ngôn ngữ. Ngày bắt đầu/kết thúc áp dụng ngày cập nhật gần nhất nếu có, nếu không dùng ngày tạo. Bảng không có trường ngày không được lọc theo ngày. Thư mục cha và bản ghi con có thể nằm ngoài khoảng ngày để bảo toàn cấu trúc. Đây không phải cơ chế sao lưu gia tăng để tự động ghép các gói theo ngày.

Kho hệ thống không thuộc tài khoản cụ thể: chỉ có trong phạm vi Mọi tài khoản; loại khỏi gói chỉ riêng tư. Khi chỉ chọn một số phần học, tài liệu nguồn được giới hạn theo phần đã chọn và ghi lại việc biến đổi trong bản kê. Một bài có thể xuất hiện trong tài liệu nguồn và bản sao đã nhập, nên không cộng hai nguồn để tính số bài độc lập.

## 4. Chọn tài khoản

- **Mọi tài khoản:** lấy toàn bộ, bất kể nội dung ô tìm kiếm hoặc bộ lọc đang có.
- **Tất cả khớp bộ lọc:** lọc theo tên/email, vai trò Admin/Staff/User và trạng thái hoạt động. Áp dụng cho toàn bộ kết quả, không chỉ trang đang nhìn.
- **Các tài khoản được chọn:** đánh dấu từng người hoặc chọn cả trang. Các lựa chọn được giữ khi đổi trang. Xóa lựa chọn nếu cần bắt đầu lại.

Học liệu lọc theo người sở hữu; tiến độ lọc theo người học đã chọn. Nếu người đó học một bài công khai của tác giả khác, gói có thể giữ tiến độ nhưng không có bài gốc. Các tham chiếu ngoài gói được ghi trong reference/unresolved.json; cần xử lý khi khôi phục.

## 5. Chọn dữ liệu đi kèm

- **Không gắn danh tính tài khoản:** bỏ liên kết chủ sở hữu/người học, không xuất hồ sơ, quyền hoặc lịch sử cá nhân. ID nội dung vẫn giữ để nối dữ liệu. Văn bản, tên tệp và URL có thể chứa tên riêng; cần rà soát trước khi chia sẻ.
- **Giữ tham chiếu tài khoản:** giữ quan hệ chủ sở hữu/người học. Chế độ chỉ học liệu vẫn không xuất hồ sơ đăng nhập; chọn Nội dung và tài khoản nếu cần cả hồ sơ.
- **Tệp đa phương tiện:** tải các ảnh, âm thanh và tệp đã lưu trong storage, kể cả âm thanh thẻ được tạo sẵn. Nếu bỏ chọn, chỉ còn metadata/liên kết. URL ảnh/audio ở dịch vụ ngoài được giữ nguyên, không tải bản sao. Giọng đọc trình duyệt và bản ghi chỉ nằm trên thiết bị không có trong dữ liệu máy chủ.
- **Tiến độ và hoạt động học:** chỉ bật khi giữ tham chiếu tài khoản. Bao gồm kết quả học thẻ, bài tập và đọc, đáp án và phiên học. Sự kiện LearningEvent là dữ liệu cấp tài khoản và có thể tham chiếu phần ngoài bộ lọc.
- **Nhật ký quản trị:** chỉ có trong chế độ Nội dung và tài khoản.
- **Mật khẩu băm:** mặc định tắt; khi bật, giữ hash để người vận hành phục hồi. Không có mật khẩu dạng chữ. Nếu tắt, tài khoản phục hồi phải đặt lại mật khẩu. Giữ các gói có tài khoản/hash ở nơi được kiểm soát và mã hóa khi lưu trữ.

## 6. Xem trước và tải

Bấm **Xem trước bản xuất**, kiểm tra số tài khoản, số bản ghi theo nhóm và các lưu ý, rồi bấm **Tải ZIP có tài liệu**. Giữ trang mở trong lúc chuẩn bị. Khi đổi lựa chọn, bản xem trước cũ được xóa; cần xem lại trước khi tải. Nếu dữ liệu thay đổi sau khi xem trước, số lượng cuối có thể khác; manifest.json trong ZIP là bản kê chính xác của lần xuất.

Kiểm tra thư mục Downloads của trình duyệt. Tải dữ liệu không sửa hoặc xóa nội dung trên web; lần xuất được ghi vào nhật ký quản trị. Giới hạn mỗi gói: 2 GiB sau giải nén, 500.000 bản ghi và dưới 100.000 tệp. Gói lớn nên chia theo tài khoản, ngôn ngữ hoặc phần học. Trong khi xuất lớn, hạn chế chỉnh sửa/xóa media để dữ liệu và tệp nhất quán.

## 7. Đọc gói ZIP và phân tích

Giữ nguyên cả ZIP, không chỉ lấy các JSON riêng lẻ:

- **README.md:** mô tả định dạng và điểm bắt đầu.
- **RESTORE.md / ANALYSIS.md:** hướng dẫn khôi phục và phân tích.
- **manifest.json:** thời điểm, bộ lọc, migrations, số bản ghi và SHA-256 của từng tệp. Gói bỏ liên kết tài khoản không lưu ID tài khoản đã chọn hoặc chuỗi tìm kiếm tài khoản.
- **SCHEMA.json:** từ điển trường và quan hệ giữa các nhóm dữ liệu.
- **INDEX.csv:** mục lục tệp dữ liệu và số bản ghi để mở bằng công cụ bảng tính.
- **data/:** JSON UTF-8 giữ model, ID gốc và fields; dùng ID để nối bảng, giữ nguyên payload lồng nhau.
- **media/:** byte tệp, nếu đã chọn tải media.
- **reference/:** mapping media, liên kết ngoài gói và thông tin tài liệu nguồn đã được giới hạn theo phần học.

## 8. Khôi phục: chọn đúng định dạng

**ZIP xuất dữ liệu website mới (wortify-site-export) chưa nhập trực tiếp qua màn hình Import ZIP.** Người vận hành phải kiểm tra checksum, dùng mã nguồn/migrations phù hợp, tạo database và storage cô lập, mapping ID/tài khoản/quyền và kiểm tra theo RESTORE.md trước khi đưa lên hệ thống chính. Gói bỏ chủ sở hữu phải gán tài khoản đích khi nhập.

Nếu muốn khôi phục tài khoản bằng giao diện hiện có: mở **Sao lưu khẩn cấp và nhập tài khoản**, xuất emergency ZIP, bật tệp đa phương tiện và portable ZIP theo tài khoản; bật hash nếu cần giữ mật khẩu. Khi nhập, chọn ZIP → Xem trước → kiểm tra tài khoản và quyền → xác nhận khôi phục.

Khôi phục cũ chỉ tạo tài khoản chưa tồn tại và nhập học liệu thành bản sao riêng tư. Nếu trùng tên tài khoản, cả lô bị chặn; không tự ghi đè tài khoản, mật khẩu hoặc quyền hiện có. Nếu không có hash, admin phải đặt mật khẩu sau khi nhập. Nhóm/quyền riêng cần mapping hợp lệ; gói cũ thiếu mapping cần xuất lại.

Emergency import giới hạn 512 MB và 1.000 tài khoản mỗi lô. Nó không phục hồi nguyên trạng liên kết giữa các tài khoản, thành viên lớp, nhật ký hoặc phiên đăng nhập. Xem số tham chiếu bị bỏ qua sau khi nhập.

## 9. Khi gặp lỗi

- **Không có quyền:** đăng nhập bằng Admin đang hoạt động; Staff không được xuất dữ liệu toàn web.
- **Không có tài khoản khớp:** đổi bộ lọc hoặc lựa chọn tài khoản; kiểm tra người được chọn còn tồn tại.
- **Ngày không hợp lệ / chưa chọn phần học:** sửa khoảng ngày và chọn ít nhất một phần học.
- **Tệp bị thiếu/không đọc được:** kiểm tra storage/quyền truy cập hoặc bỏ media để cứu metadata trước. Khi chọn media, hệ thống báo thất bại thay vì tạo gói thiếu tệp âm thầm.
- **Vượt giới hạn / hết thời gian chờ:** chia nhỏ gói, xem lại bộ lọc rồi tải lại. Không coi tệp tải dở là bản sao lưu hợp lệ.
- **ZIP không nhập được:** kiểm tra định dạng. Site export, emergency ZIP và ZIP cá nhân là các định dạng khác nhau.
- **Checksum sai:** không dùng bản lỗi để phục hồi; tải lại hoặc lấy bản sao còn nguyên vẹn.

Gói này không thay thế bản sao lưu toàn máy chủ: mã nguồn, assets tĩnh, cấu hình triển khai, database engine metadata và các bí mật hệ thống cần được sao lưu riêng. Phiên đăng nhập, reset token và import API key không được xuất. Sau khi khôi phục, kiểm tra quyền, visibility, đáp án, cây thư mục, media và tiến độ trước khi chuyển hệ thống.

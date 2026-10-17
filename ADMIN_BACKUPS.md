# Khôi phục tài khoản từ ZIP quản trị


`/manage` → **Backup & import** → **Import ZIP**. Chọn emergency ZIP xuất từ trang quản trị, Preview import, kiểm tra các tài khoản/quyền rồi Restore accounts and permissions. Chỉ superuser được dùng; tài khoản staff dùng import nội dung ở màn hình học/biên soạn.

Khôi phục tạo tài khoản mới, giữ role Admin/Staff/User, trạng thái active, groups và quyền riêng; nhập dữ liệu học dưới dạng bản sao riêng tư. Nếu tên tài khoản đã tồn tại, toàn bộ lần nhập bị chặn, không đổi mật khẩu hoặc quyền hiện có. Chọn nhóm tài khoản chưa tồn tại khi xuất; không xóa tài khoản đang dùng chỉ để vượt qua bước này.

Muốn giữ mật khẩu cũ, khi xuất bật **Include password hashes**. Nếu không có hash, tài khoản khôi phục chưa đăng nhập được cho đến khi admin đặt mật khẩu. Bật **Uploaded media and portable per-user ZIPs** để có nội dung nhập. ZIP cũ có group/quyền riêng mà thiếu mapping permissions cần xuất lại bằng bản mới.

Giới hạn nhập: 512 MB, tối đa 1000 tài khoản mỗi lô. Chia nhỏ bản xuất lớn. Không khôi phục phiên đăng nhập, nhật ký quản trị cũ, thành viên lớp hoặc liên kết giữa tài khoản; đây không phải khôi phục toàn bộ database nguyên trạng. Giao diện báo số reference bị bỏ qua.

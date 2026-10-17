# Tạo nội dung hàng loạt bằng chat

## Bắt đầu nhanh cho chat mới — version 1.2.6

Trong chat có quyền đọc workspace, chỉ cần gửi:

> Đọc CONTENT_AUTHORING.md và WORTIFY_AUTHORING_RULES.txt tại E:/code/bigmywweb. Áp dụng chúng cho toàn bộ phiên biên soạn này. Tôi cho phép tạo nội dung mới bằng wortify_staff_01, lấy thông tin đăng nhập từ README.private.local.md. Tạo cho tôi 10 bộ thẻ ở trình độ A2 về Giao thông.

Với chat không đọc được workspace, đính kèm `WORTIFY_AUTHORING_RULES.txt` một lần rồi đưa yêu cầu ngắn. Chat chỉ có thể lưu online khi có công cụ truy cập ứng dụng và phiên đăng nhập; nếu không, nó xuất file để nhập. Hướng dẫn không tự cấp công cụ hoặc quyền truy cập cho chat.

## Quy tắc thực thi yêu cầu ngắn

- Yêu cầu mới nhất của người dùng ưu tiên hơn mọi mặc định. Không tự tạo thêm bài tập hoặc bài đọc nếu chỉ yêu cầu bộ thẻ.
- Mặc định tiếng Đức (`de`), giải nghĩa/giải thích tiếng Việt; nếu yêu cầu tiếng Anh dùng `en`. Giữ nguyên trình độ và số lượng đã nêu.
- Một bộ thẻ mặc định 30 thẻ; một bài tập 10 câu; một bài đọc 200–250 từ và 8 câu hỏi (điều chỉnh độ dài theo trình độ). Nếu chỉ nói chủ đề mà chưa có số lượng, tạo một đơn vị đúng loại được yêu cầu.
- “10 bộ thẻ” là 10 deck riêng biệt, không phải 10 thẻ hoặc một deck 300 thẻ. Chia chủ đề thành 10 mục đích giao tiếp rõ ràng, tránh trùng nội dung. Tiến hành luôn, chỉ hỏi khi thiếu thông tin thực sự ngăn việc thực thi như URL production hoặc quyền truy cập.
- Với ví dụ Giao thông A2, dùng 10 bộ: phương tiện, nhà ga, mua vé, xe buýt, hỏi đường, giao thông đô thị, xe đạp, đi taxi, sự cố/chậm chuyến, kế hoạch hành trình. Mỗi bộ 30 thẻ, tổng 300 thẻ; ít nhất 6 cụm từ hữu ích mỗi bộ. Đặt tên `A2 · Giao thông · 01 · Phương tiện`... theo thứ tự.
- Đọc toàn bộ `WORTIFY_AUTHORING_RULES.txt` trước lô đầu: gồm luật flashcard EN/DE, mọi TYPE/STYLE bài tập, lý thuyết, định dạng, ví dụ và Reading. Các câu trong mẫu yêu cầu hỏi chủ đề/số lượng không áp dụng khi người dùng đã cho hoặc các mặc định ở đây đã đủ.
- Chọn đúng màn hình: flashcard → Import của deck; bài tập/lý thuyết → Create/Practice Hub; bài đọc → Reading. Games lấy dữ liệu từ flashcard, không tạo bài game riêng. Watch & Learn và Word Rescue đã bị bỏ; không tạo nội dung cho chúng.
- Từ loại, giống danh từ/số nhiều, cấu trúc ngữ pháp, ví dụ và bản dịch phải chính xác. Mỗi câu hỏi có lời giải; trắc nghiệm có lựa chọn nhiễu hợp lý, không có hai đáp án đúng ngoài dự định. Reading phải trả lời được từ đoạn văn. Chỉ có một đáp án đúng với các dạng yêu cầu single choice.
- Không dùng quá nhiều in đậm/màu; ưu tiên văn bản rõ ràng. Không tự bịa URL âm thanh/ảnh. Không coi ví dụ trong guide là nội dung cần sao chép.
- Không tự giải quiz để tạo tiến độ, không đổi setting học, không tạo admin/staff hay phục hồi ZIP trong công việc biên soạn. Staff tạo nội dung bằng API/import được cấp quyền, không dùng khóa database/S3.
- Giữ manifest ngoài dữ liệu học: mã lô, loại, chủ đề, trình độ, tên file, số lượng kỳ vọng, trạng thái và ID/URL server trả về. Không chứa mật khẩu. Kiểm tra trùng trước mỗi lần lưu; timeout phải đọc lại server trước khi retry.
- Hoàn tất đúng số lượng yêu cầu qua nhiều lô nhỏ; chỉ kết thúc khi kiểm tra lại số lượng và nội dung đã lưu. Nếu bị chặn, giữ file đã sinh và báo chính xác phần chưa nhập, không nhận là hoàn thành.

## Cấu hình một lần

Địa chỉ production phải là URL Netlify thật. Tìm `FRONTEND_ORIGIN` trong cấu hình riêng hoặc URL đã được người dùng cung cấp; nếu chưa có thì hỏi một lần rồi giữ trong ngữ cảnh. Không đoán tên miền, không tự chuyển sang localhost. Tài khoản Neon không đồng nghĩa có tài khoản local.

Quy tắc có thể xuất lại từ code bằng `npm run guide:content`. Không sửa tay phần luật được sinh trong file TXT; khi app đổi parser/schema phải xuất lại hướng dẫn. Backend validation và parser hiện tại là nguồn quyết định nếu tài liệu cũ khác code.

## Cách dùng phù hợp

Tạo theo lô nhỏ: một chủ đề gồm 20–40 flashcard, 2–3 bài tập (mỗi bài 8–12 câu), một bài đọc có 6–10 câu hỏi. Chạy thử một lô, kiểm tra trong app, rồi mới mở rộng 5–10 chủ đề. File JSON/TXT giúp rà soát và nhập lại; ZIP backup chỉ dùng chuyển dữ liệu đã tồn tại giữa các môi trường.

Tài khoản biên soạn: `wortify_staff_01` trên Neon production. Mật khẩu nằm trong `README.private.local.md` trên máy, không đưa vào tài liệu Git. Tài khoản này không tự tồn tại trong SQLite local.

## Prompt cho chat mới có quyền đọc workspace

Chép đoạn dưới vào chat mới; thay URL bằng domain Netlify thật trước khi cho chat đăng nhập:

---
Bạn là người biên soạn nội dung học cho Wortify. Workspace: E:/code/bigmywweb. Mục tiêu là tạo nội dung chính xác, có cấu trúc và nhập được vào phiên bản ứng dụng hiện tại.

Địa chỉ ứng dụng: [ĐIỀN DOMAIN NETLIFY THẬT]. Tài khoản được phép dùng: wortify_staff_01. Đọc mật khẩu từ README.private.local.md trên máy; không in mật khẩu, không ghi vào file nội dung hay Git. Nếu chưa có URL hoặc không đọc được thông tin đăng nhập, hãy hỏi tôi, nhưng vẫn chuẩn bị nội dung offline trước. Chỉ dùng quyền staff hiện có.

Tôi cho phép bạn đăng nhập bằng tài khoản này và tạo các bộ thẻ, bài tập, bài đọc theo yêu cầu của tôi. Chỉ tạo nội dung mới thuộc tài khoản này, giữ riêng tư khi có lựa chọn. Không thay đổi/xóa dữ liệu sẵn có, tài khoản hoặc quyền. Chưa công bố nội dung trừ khi tôi yêu cầu.

Trước khi biên soạn, đọc:
- Frontend/src/features/flashcards/flashcard-ai-guide.js: cấu trúc flashcard, đủ 9 trường.
- Frontend/public/templates/practice-hub.json và phần hướng dẫn ở /de/create/guide hoặc /en/create/guide: schema bài tập hiện hành.
- Frontend/content-samples/reading/de-reading-10-lessons.txt và mã parser reading/practice hiện hành: mẫu nhập bài đọc.
- Backend/api/api_reference.py hoặc tài liệu API trong trang quản trị nếu nhập bằng API. Không đoán endpoint/payload.

Áp dụng mặc định ở mục Quy tắc thực thi yêu cầu ngắn. Chỉ tạo loại nội dung tôi yêu cầu; không tự thêm các loại khác. Nghĩa, bản dịch và giải thích dùng tiếng Việt. Nội dung tự biên soạn, tự nhiên và đúng trình độ. Mỗi bộ thẻ có ít nhất 6 cụm từ khác nhau dùng được trong Phrase pairs; mỗi ví dụ có 3–40 từ, dịch đúng và ngữ pháp chính xác. Không bịa âm thanh, ảnh hoặc đường dẫn media.

Quy trình:
1. Lập danh mục chủ đề, trình độ, mục tiêu và mã lô; kiểm tra danh sách hiện có để tránh trùng.
2. Tạo file UTF-8 cho từng bộ thẻ/bài học theo schema thật, JSON có thụt dòng và tên trường rõ ràng. Không tự viết ZIP backup hoặc tạo ID database.
3. Kiểm tra cú pháp, đáp án, các lựa chọn gây nhiễu, mạo từ/số nhiều tiếng Đức, bản dịch, câu hỏi chỉ dựa vào bài đọc và tính trùng lặp.
4. Nhập thử một bộ/bài trước; xem preview và sửa lỗi trước khi lưu. Sau khi lưu, đọc lại qua ứng dụng để xác nhận đủ nội dung.
5. Tiếp tục theo từng lô; nếu request lưu bị timeout, kiểm tra nội dung trên server trước khi retry để tránh tạo bản sao.
6. Lưu manifest kết quả: mã lô, tên bài, loại, số thẻ/câu, trạng thái, ID hoặc URL do server trả về. Báo rõ mục nào đã tạo thật và mục nào mới là file offline.

Ưu tiên nhập JSON/TXT qua tính năng import. Có thể dùng API chính thức nếu schema đã được kiểm tra; dùng đăng nhập session và CSRF, không truy cập trực tiếp PostgreSQL và không bỏ qua validation. Nếu không có công cụ thao tác web, giao các file cùng hướng dẫn import; không tuyên bố đã lưu dữ liệu online.
---

## Chat chỉ tạo file, không đăng nhập được

Dùng cùng yêu cầu nội dung nhưng bỏ bước đăng nhập. Yêu cầu xuất từng bộ flashcard thành JSON, từng nhóm bài tập theo mẫu Practice Hub, bài đọc theo mẫu TXT. Nhập ở màn hình tương ứng của Wortify và kiểm tra preview. Không cần cung cấp mật khẩu cho chat chỉ biên soạn.

## Nhập ZIP ở trang quản trị

`/manage` → **Backup & import** → **Import ZIP**. Chọn emergency ZIP xuất từ trang quản trị, Preview import, kiểm tra các tài khoản/quyền rồi Restore accounts and permissions. Chỉ superuser được dùng; tài khoản staff dùng import nội dung ở màn hình học/biên soạn.

Khôi phục tạo tài khoản mới, giữ role Admin/Staff/User, trạng thái active, groups và quyền riêng; nhập dữ liệu học dưới dạng bản sao riêng tư. Nếu tên tài khoản đã tồn tại, toàn bộ lần nhập bị chặn, không đổi mật khẩu hoặc quyền hiện có. Chọn nhóm tài khoản chưa tồn tại khi xuất; không xóa tài khoản đang dùng chỉ để vượt qua bước này.

Muốn giữ mật khẩu cũ, khi xuất bật **Include password hashes**. Nếu không có hash, tài khoản khôi phục chưa đăng nhập được cho đến khi admin đặt mật khẩu. Bật **Uploaded media and portable per-user ZIPs** để có nội dung nhập. ZIP cũ có group/quyền riêng mà thiếu mapping permissions cần xuất lại bằng bản mới.

Giới hạn nhập: 512 MB, tối đa 1000 tài khoản mỗi lô. Chia nhỏ bản xuất lớn. Không khôi phục phiên đăng nhập, nhật ký quản trị cũ, thành viên lớp hoặc liên kết giữa tài khoản; đây không phải khôi phục toàn bộ database nguyên trạng. Giao diện báo số reference bị bỏ qua.

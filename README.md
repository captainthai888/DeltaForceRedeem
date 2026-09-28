# Delta Force Redeem — Chrome Extension

Popup tiếng Việt lấy cảm hứng từ hình mẫu: nền tối, điểm nhấn cyan, nhập nhiều mã, chỉnh thời gian chờ, bắt đầu / tạm dừng / tiếp tục / dừng, thống kê và nhật ký.

## Cài đặt

1. Mở `chrome://extensions` trong Chrome.
2. Bật **Developer mode / Chế độ dành cho nhà phát triển**.
3. Chọn **Load unpacked / Tải tiện ích đã giải nén**, chọn thư mục `DeltaForceRedeem` trong dự án này.
4. Ghim **Delta Force Redeem** bằng menu tiện ích (biểu tượng mảnh ghép).
5. Mở https://redeem.df.garena.sg/ và đăng nhập Garena. Giữ tab này mở.
6. Nhấn biểu tượng extension, dán mã cách nhau bằng dấu cách, tab hoặc xuống dòng, rồi nhấn **Bắt đầu**.

## Cách hoạt động

- Đọc đúng cookie `user_info` của trang đổi quà, lấy openid/token của phiên đang đăng nhập. Không dùng thông tin tài khoản trong cURL mẫu.
- Tạo UUID, thời gian và chữ ký MD5 mới theo giao thức của trang chính thức. Gửi POST từ tab đổi quà để Chrome tự cung cấp Origin/Referer. Token chỉ dùng trong bộ nhớ và yêu cầu đến API chính thức; không lưu vào lịch sử hay nhật ký.
- Thành công chỉ khi API trả `code: 0`. Lỗi `400068` được hiển thị là mã hết lượt đổi. Các lỗi khác hiển thị mã lỗi và nội dung phản hồi.
- Chạy tuần tự, mặc định chờ 1,5 giây giữa các yêu cầu (có thể chọn 1–10 giây). Mỗi lượt tối đa 2.000 mã.
- Lịch sử lưu theo openid + mã, giữ nguyên chữ hoa/thường. Mã trùng chính xác hoặc đã gửi trước đó đều bị bỏ qua, bao gồm mã thành công, thất bại và chưa rõ kết quả. Xóa nhật ký không xóa lịch sử chống trùng.
- Ghi dấu đã thử **trước khi gửi** để tránh gửi lại khi bị gián đoạn. Mất mạng, timeout, đóng tab hoặc lỗi HTTP được báo **chưa xác định**, không được tính là lỗi đổi mã đã xác nhận và không tự thử lại. Có thể một mã đã được ghi dấu nhưng chưa đến máy chủ nếu Chrome dừng đúng thời điểm này.
- Đóng popup vẫn tiếp tục chạy. Nếu Chrome/extension khởi động lại hoặc trình chạy nền bị ngắt, lượt chạy chuyển sang tạm dừng; mở popup và nhấn Tiếp tục để xử lý phần còn lại.
- Tạm dừng/dừng không thu hồi yêu cầu đã gửi; kết quả yêu cầu đó vẫn được ghi nhận. Muốn nhập danh sách mới khi đang tạm dừng, nhấn Dừng lại trước.
- Nếu đổi tài khoản, lượt hiện tại tạm dừng. Dừng lượt cũ rồi bắt đầu lại cho tài khoản mới. Trạng thái “Có phiên” chỉ xác nhận có cookie, không đảm bảo token chưa hết hạn; API sẽ xác nhận khi đổi mã.
- Nhật ký giữ 500 dòng gần nhất. Không có máy chủ trung gian, phân tích sử dụng hay mã tải từ bên ngoài.

## Kiểm tra

Chạy `npm test` từ thư mục dự án. Kiểm tra MD5 với triển khai độc lập, chữ ký truy vấn, tách mã, chống gửi lại, kết quả API, cách ly tài khoản, dừng khi có yêu cầu đang chạy và khôi phục sau gián đoạn. Các bài kiểm tra dùng API giả lập và không đổi quà thật.

Chưa kiểm thử đổi quà thật trên tài khoản đăng nhập của người dùng. Khi trang chính thức thay đổi cookie hoặc giao thức ký, phần tích hợp cần được cập nhật.

Nguồn giao thức được đối chiếu: https://redeem.df.garena.sg/assets/cdkgarena.html.0ac41044.js

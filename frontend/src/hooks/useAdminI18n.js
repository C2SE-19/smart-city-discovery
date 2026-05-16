import { useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const VI_TRANSLATIONS = {
  'N/A': 'Không có',
  'Not available': 'Không có',
  'Not provided': 'Chưa cung cấp',
  'Not detected': 'Chưa xác định',
  'Unknown': 'Không xác định',
  'Unknown user': 'Người dùng không xác định',
  'Unknown venue': 'Địa điểm không xác định',
  'Unknown merchant': 'Merchant không xác định',
  'Archived package': 'Gói đã lưu trữ',
  'No email': 'Không có email',
  'No phone': 'Không có số điện thoại',
  'Other': 'Khác',
  'Live': 'Trực tiếp',
  'Search': 'Tìm kiếm',
  'Refresh': 'Làm mới',
  'Add': 'Thêm',
  'Update': 'Cập nhật',
  'Delete': 'Xóa',
  'Cancel': 'Hủy',
  'Clear': 'Xóa chọn',
  'Retry': 'Thử lại',
  'Save': 'Lưu',
  'Edit': 'Chỉnh sửa',
  'Processing...': 'Đang xử lý...',
  'Deleting...': 'Đang xóa...',
  'Saving...': 'Đang lưu...',
  'Sending...': 'Đang gửi...',
  'Searching...': 'Đang tìm...',
  'Applying...': 'Đang áp dụng...',
  'Removing...': 'Đang gỡ...',
  'Loading...': 'Đang tải...',
  'English': 'Tiếng Anh',
  'Vietnamese': 'Tiếng Việt',
  'Admin': 'Quản trị viên',
  'User': 'Người dùng',
  'All roles': 'Tất cả vai trò',
  'All statuses': 'Tất cả trạng thái',
  'New': 'Mới',
  'In Progress': 'Đang xử lý',
  'Replied': 'Đã phản hồi',
  'Closed': 'Đã đóng',
  'Venue Report': 'Báo cáo địa điểm',
  'Review Report': 'Báo cáo đánh giá',
  'All report types': 'Tất cả loại báo cáo',
  'Approved': 'Đã duyệt',
  'Rejected': 'Đã từ chối',
  'Pending': 'Chờ duyệt',
  'Paid': 'Đã thanh toán',
  'Pending payment': 'Chờ thanh toán',
  'Cancelled': 'Đã hủy',
  'Failed': 'Thất bại',
  'Loading data...': 'Đang tải dữ liệu...',
  'No users found.': 'Không tìm thấy người dùng.',
  'Select all': 'Chọn tất cả',
  'Select': 'Chọn',
  'Hide': 'Ẩn',
  'Show': 'Hiện',
  'Male': 'Nam',
  'Female': 'Nữ',
  'Create': 'Tạo',
  'Created': 'Đã tạo',
  'Created:': 'Đã tạo:',
  'Address pending': 'Địa chỉ đang chờ cập nhật',
  'No cover image': 'Không có ảnh bìa',
  'No old images': 'Không có ảnh cũ',
  'No new images': 'Không có ảnh mới',
  'Uploaded': 'Đã tải lên',
  'Missing': 'Thiếu',
  'Map filters': 'Bộ lọc bản đồ',
  'Search keyword': 'Từ khóa tìm kiếm',
  'Close': 'Đóng',
  'Remove image': 'Xóa ảnh',
  'Attach image': 'Đính kèm ảnh',
  'Attachment preview': 'Xem trước tệp đính kèm',
  'User attachment': 'Tệp đính kèm của người dùng',
  'Preview': 'Xem trước',
  'Map Moderation Workspace': 'Không gian kiểm duyệt bản đồ',
  'Admin Map Management': 'Quản lý bản đồ quản trị',
  'Dashboard month window': 'Khoảng tháng của bảng điều khiển',
  'Dashboard month window': 'Khoảng tháng của bảng điều khiển',
  'Data sync': 'Đồng bộ dữ liệu',
  'Administrative Overview': 'Tổng quan quản trị',
  'City growth and monetization at a glance': 'Tổng quan tăng trưởng thành phố và doanh thu',
  'Track user growth, package inventory, venue volume, and monthly ad revenue in one operational dashboard.':
    'Theo dõi tăng trưởng người dùng, số lượng gói, số lượng địa điểm và doanh thu quảng cáo hàng tháng trong một bảng điều khiển vận hành.',
  'Loading dashboard...': 'Đang tải bảng điều khiển...',
  'Fetching latest admin metrics and trends.': 'Đang lấy các chỉ số và xu hướng quản trị mới nhất.',
  'Unable to load dashboard': 'Không thể tải bảng điều khiển',
  'Revenue by month': 'Doanh thu theo tháng',
  'Paid package transactions in the selected window.': 'Giao dịch gói đã thanh toán trong khoảng thời gian đã chọn.',
  'No paid transactions yet.': 'Chưa có giao dịch thanh toán nào.',
  'Venue status distribution': 'Phân bố trạng thái địa điểm',
  'Current moderation distribution across active venue statuses.': 'Phân bố kiểm duyệt hiện tại theo các trạng thái địa điểm đang hoạt động.',
  'No venue status data available.': 'Chưa có dữ liệu trạng thái địa điểm.',
  'Peak revenue month': 'Tháng doanh thu cao nhất',
  'Highest monthly collection from successful package payments.': 'Mức thu hàng tháng cao nhất từ các thanh toán gói thành công.',
  'No revenue has been recorded in the selected period.': 'Chưa có doanh thu nào được ghi nhận trong giai đoạn đã chọn.',
  'Total users': 'Tổng người dùng',
  'Total packages': 'Tổng gói',
  'Total venues': 'Tổng địa điểm',
  'Revenue this month': 'Doanh thu tháng này',
  'vs previous month': 'so với tháng trước',
  'venues': 'địa điểm',
  'Finance Intelligence': 'Phân tích tài chính',
  'Reports & Revenue': 'Báo cáo & doanh thu',
  'Monitor real package revenue, payment lifecycle health, and package demand across the advertising system.':
    'Theo dõi doanh thu gói thực tế, tình trạng vòng đời thanh toán và nhu cầu gói trong toàn bộ hệ thống quảng cáo.',
  'Revenue window': 'Khoảng thời gian doanh thu',
  'months': 'tháng',
  'Loading revenue dashboard...': 'Đang tải bảng doanh thu...',
  'Please wait while we aggregate package payments and usage signals.':
    'Vui lòng chờ trong khi hệ thống tổng hợp thanh toán gói và tín hiệu sử dụng.',
  'Unable to load analytics': 'Không thể tải phân tích',
  'Revenue in window': 'Doanh thu trong kỳ',
  'successful payments': 'thanh toán thành công',
  'All-time revenue': 'Tổng doanh thu',
  'paid package orders': 'đơn hàng gói đã thanh toán',
  'Average order value': 'Giá trị đơn hàng trung bình',
  'Across the selected reporting window': 'Trong khoảng báo cáo đã chọn',
  'Active assignment coverage': 'Phạm vi gán đang hoạt động',
  'packages have generated revenue': 'gói đã tạo ra doanh thu',
  'Revenue Trend': 'Xu hướng doanh thu',
  'Monthly revenue and payment volume sourced from successful PayOS confirmations.':
    'Doanh thu hàng tháng và số lượng thanh toán được lấy từ các xác nhận PayOS thành công.',
  'Monthly revenue trend': 'Xu hướng doanh thu theo tháng',
  'payment(s)': 'thanh toán',
  'Package Spotlight': 'Điểm nhấn gói',
  'Which package is generating the most revenue and coverage right now.':
    'Gói nào đang tạo ra doanh thu và độ phủ lớn nhất hiện tại.',
  'Top revenue package': 'Gói doanh thu cao nhất',
  'No revenue yet': 'Chưa có doanh thu',
  'in confirmed payments': 'trong các thanh toán đã xác nhận',
  'Paid orders': 'Đơn đã thanh toán',
  'Active merchants': 'Merchant đang hoạt động',
  'Most used package': 'Gói được dùng nhiều nhất',
  'No active usage yet': 'Chưa có sử dụng thực tế',
  'active assignments': 'lượt gán đang hoạt động',
  'Revenue packages': 'Gói có doanh thu',
  'Packages with at least one paid transaction': 'Các gói có ít nhất một giao dịch thanh toán',
  'Payment Status Mix': 'Cơ cấu trạng thái thanh toán',
  'Track checkout health across pending, paid, cancelled, and failed package orders.':
    'Theo dõi tình trạng thanh toán giữa các đơn gói đang chờ, đã thanh toán, đã hủy và thất bại.',
  'of all package orders': 'trên tổng số đơn gói',
  'No package orders yet': 'Chưa có đơn gói nào',
  'Best-Selling Packages': 'Các gói bán tốt nhất',
  'Revenue contribution, paid order count, and active assignment volume for each package.':
    'Đóng góp doanh thu, số đơn đã thanh toán và số lượt gán hoạt động của từng gói.',
  'revenue': 'doanh thu',
  'paid orders': 'đơn đã thanh toán',
  'Recent Successful Payments': 'Các thanh toán thành công gần đây',
  'The most recent advertising package payments confirmed in the system.':
    'Các thanh toán gói quảng cáo gần nhất đã được xác nhận trong hệ thống.',
  'Merchant': 'Merchant',
  'Package': 'Gói',
  'Amount': 'Số tiền',
  'Order code': 'Mã đơn hàng',
  'Confirmed at': 'Xác nhận lúc',
  'There are no confirmed payments yet.': 'Chưa có thanh toán nào được xác nhận.',
  'Campaign control': 'Điều khiển chiến dịch',
  'Ad Packages': 'Gói quảng cáo',
  'Create package rules for merchant advertising. This workspace remains separated from map moderation.':
    'Tạo quy tắc gói cho quảng cáo của merchant. Khu vực này được tách biệt khỏi phần kiểm duyệt bản đồ.',
  'Packages': 'Các gói',
  'Statisticals': 'Thống kê',
  'Create a New Package': 'Tạo gói mới',
  'Edit Package': 'Chỉnh sửa gói',
  'Update package identity, active duration and campaign capabilities.':
    'Cập nhật tên gói, thời hạn hoạt động và các khả năng của chiến dịch.',
  'Define package identity, tier color family and campaign behavior.':
    'Thiết lập tên gói, cấp độ màu và hành vi chiến dịch.',
  'Package name': 'Tên gói',
  'Package type': 'Loại gói',
  'Activation duration': 'Thời hạn kích hoạt',
  'Package price (VND)': 'Giá gói (VND)',
  'Minimum 1.000 VND. Digits only.': 'Tối thiểu 1.000 VND. Chỉ nhập số.',
  'Discount (%)': 'Giảm giá (%)',
  'Enter 0 to keep the original price.': 'Nhập 0 để giữ nguyên giá gốc.',
  'Discounted price': 'Giá sau giảm',
  'Package capabilities': 'Khả năng của gói',
  'Maximum promoted posts': 'Số bài quảng bá tối đa',
  'Number of pushes': 'Số lần đẩy',
  'Display duration (hours)': 'Thời gian hiển thị (giờ)',
  'Save changes': 'Lưu thay đổi',
  'Create package': 'Tạo gói',
  'Cancel edit': 'Hủy chỉnh sửa',
  'Created Packages': 'Các gói đã tạo',
  'These package definitions are available in merchant advertisement flow.':
    'Các cấu hình gói này đang được dùng trong luồng quảng cáo của merchant.',
  'Loading packages...': 'Đang tải các gói...',
  'No package yet. Create the first package to activate merchant advertising.':
    'Chưa có gói nào. Hãy tạo gói đầu tiên để kích hoạt quảng cáo cho merchant.',
  'before discount': 'trước khi giảm',
  'off': 'giảm',
  'Delete package?': 'Xóa gói này?',
  'Confirm delete': 'Xác nhận xóa',
  'Package Performance Dashboard': 'Bảng hiệu quả gói',
  'Loading statistics...': 'Đang tải thống kê...',
  'No data yet': 'Chưa có dữ liệu',
  'Currently linked venue campaigns': 'Các chiến dịch địa điểm đang liên kết',
  'Monthly assignment events': 'Sự kiện gán theo tháng',
  'In the last': 'Trong',
  'Package Usage Details': 'Chi tiết sử dụng gói',
  'Click any package in ranking or chart to inspect venues and users currently linked to it.':
    'Bấm vào bất kỳ gói nào trong bảng xếp hạng hoặc biểu đồ để xem địa điểm và người dùng đang liên kết với gói đó.',
  'Loading package usage details...': 'Đang tải chi tiết sử dụng gói...',
  'No venue has actively selected this package yet.': 'Chưa có địa điểm nào đang sử dụng gói này.',
  'Assigned at': 'Gán lúc',
  'Feedback Types': 'Loại phản hồi',
  'Feedback Reports': 'Danh sách phản hồi',
  'Feedback & Support Management': 'Quản lý góp ý & hỗ trợ',
  'Support Operations': 'Vận hành hỗ trợ',
  'Total reports': 'Tổng số báo cáo',
  'Manage Feedback Reports': 'Quản lý báo cáo phản hồi',
  'Contact': 'Liên hệ',
  'Type Editor': 'Trình chỉnh sửa loại',
  'Choose a feedback type': 'Chọn loại phản hồi',
  'Enter feedback type name': 'Nhập tên loại phản hồi',
  'Feedback Types': 'Loại phản hồi',
  'Feedback Types': 'Loại phản hồi',
  'Feedback Types': 'Loại phản hồi',
  'Report Detail': 'Chi tiết báo cáo',
  'User Message': 'Nội dung người dùng gửi',
  'Admin Reply': 'Phản hồi của quản trị viên',
  'Write your support reply...': 'Nhập nội dung phản hồi hỗ trợ...',
  'Reply Report': 'Phản hồi báo cáo',
  'Open user attachment': 'Mở tệp đính kèm của người dùng',
  'No user attachment': 'Không có tệp đính kèm',
  'Search User': 'Tìm người dùng',
  'Selected User': 'Người dùng đã chọn',
  'Search Results': 'Kết quả tìm kiếm',
  'Compose Email': 'Soạn email',
  'Email Title': 'Tiêu đề email',
  'Email Content': 'Nội dung email',
  'Attach Images (Max 5)': 'Đính kèm ảnh (tối đa 5 ảnh)',
  'Send Email': 'Gửi email',
  'Please select a user from the search results to compose email':
    'Vui lòng chọn người dùng từ kết quả tìm kiếm để soạn email',
  'Forum moderation workspace': 'Không gian kiểm duyệt diễn đàn',
  'View Reports': 'Xem báo cáo',
  'Forum Overview': 'Tổng quan diễn đàn',
  'Banned Keywords': 'Từ khóa cấm',
  'Reports': 'Báo cáo',
  'Forum': 'Diễn đàn',
  'Total Posts': 'Tổng bài viết',
  'Reported Posts': 'Bài viết bị báo cáo',
  'Reported Comments': 'Bình luận bị báo cáo',
  'Loading forum data...': 'Đang tải dữ liệu diễn đàn...',
  'Reported': 'Đã bị báo cáo',
  'Report count': 'Số lượt báo cáo',
  'Likes': 'Lượt thích',
  'Comments': 'Bình luận',
  'Report reasons': 'Lý do báo cáo',
  'Delete Comment': 'Xóa bình luận',
  'Delete Post': 'Xóa bài viết',
  'There are no reported posts yet.': 'Hiện chưa có bài viết nào bị báo cáo.',
  'There are no reported comments yet.': 'Hiện chưa có bình luận nào bị báo cáo.',
  'No forum posts match the current search criteria.': 'Không có bài viết nào khớp với tiêu chí tìm kiếm hiện tại.',
  'Review all posts and comments. Reported content is prioritized and highlighted for faster moderation.':
    'Xem toàn bộ bài viết và bình luận. Nội dung bị báo cáo sẽ được ưu tiên và làm nổi bật để kiểm duyệt nhanh hơn.',
  'Reported Post': 'Bài viết bị báo cáo',
  'Reported Comments': 'Bình luận bị báo cáo',
  'Delete selected comments': 'Xóa các bình luận đã chọn',
  'Deleting comments...': 'Đang xóa bình luận...',
  'Delete post': 'Xóa bài viết',
  'Comments ({count})': 'Bình luận ({count})',
  'No comments yet.': 'Chưa có bình luận nào.',
  'Enter a blocked word or phrase...': 'Nhập từ hoặc cụm từ cần chặn...',
  'Keyword': 'Từ khóa',
  'Applied On': 'Áp dụng lúc',
  'Action': 'Thao tác',
  'Remove': 'Gỡ',
  'Loading banned keywords...': 'Đang tải danh sách từ khóa cấm...',
  'No banned keywords have been applied yet.': 'Chưa có từ khóa cấm nào được áp dụng.',
  'User Management': 'Quản lý người dùng',
  'Manage user accounts, roles, and account removal.': 'Quản lý tài khoản người dùng, vai trò và thao tác xóa tài khoản.',
  'Search by name, email, or username': 'Tìm theo tên, email hoặc username',
  'Add user': 'Thêm người dùng',
  'selected user(s)': 'người dùng đã chọn',
  'Delete selected': 'Xóa đã chọn',
  'Edit User': 'Chỉnh sửa người dùng',
  'Add User': 'Thêm người dùng',
  'Full Name': 'Họ và tên',
  'Email': 'Email',
  'Username': 'Tên đăng nhập',
  'Password': 'Mật khẩu',
  'Leave blank to keep the current password': 'Để trống nếu muốn giữ mật khẩu hiện tại',
  'Phone': 'Số điện thoại',
  'Address': 'Địa chỉ',
  'Role': 'Vai trò',
  'Gender': 'Giới tính',
  'Not selected': 'Chưa chọn',
  'Full name': 'Họ và tên',
  'Status': 'Trạng thái',
  'Pause until': 'Tạm dừng đến',
  'Joined at': 'Ngày tham gia',
  'Actions': 'Thao tác',
  'Page': 'Trang',
  'Total': 'Tổng',
  'Prev': 'Trước',
  'Next': 'Sau',
  'Select a report to view details.': 'Hãy chọn một báo cáo để xem chi tiết.',
  'Report ID': 'Mã báo cáo',
  'Feedback Type': 'Loại phản hồi',
  'Submitted At': 'Gửi lúc',
  'Contact Email': 'Email liên hệ',
  'Contact Phone': 'Số điện thoại liên hệ',
  'Reply message is required.': 'Nội dung phản hồi là bắt buộc.',
  'Feedback type name is required.': 'Tên loại phản hồi là bắt buộc.',
  'Feedback type created.': 'Đã tạo loại phản hồi.',
  'Feedback type updated.': 'Đã cập nhật loại phản hồi.',
  'Feedback type deleted.': 'Đã xóa loại phản hồi.',
  'Loading feedback types...': 'Đang tải loại phản hồi...',
  'No feedback types found.': 'Không tìm thấy loại phản hồi nào.',
  'Loading reports...': 'Đang tải báo cáo...',
  'No feedback reports found.': 'Không tìm thấy báo cáo phản hồi nào.',
  'Pending Posts': 'Bài đăng chờ duyệt',
  'Ward Naming': 'Quản lý phường',
  'Click a ward boundary to update or delete it. Use Add Ward to create a new boundary.':
    'Bấm vào ranh giới phường để cập nhật hoặc xóa. Dùng Thêm phường để tạo ranh giới mới.',
  'Place Categories': 'Danh mục địa điểm',
  'Manage a single shared category list used by merchant and user screens.':
    'Quản lý một danh sách danh mục dùng chung cho merchant và người dùng.',
  'Services Offered - Merchant': 'Dịch vụ cung cấp - Merchant',
  'Manage service options shown in merchant registration and moderation details.':
    'Quản lý các tùy chọn dịch vụ hiển thị trong đăng ký merchant và phần chi tiết kiểm duyệt.',
  'Requested at': 'Yêu cầu lúc',
  'Old location': 'Vị trí cũ',
  'New location': 'Vị trí mới',
  'Old Location Data': 'Dữ liệu vị trí cũ',
  'New Location Data': 'Dữ liệu vị trí mới',
  'Pending Queue': 'Hàng chờ duyệt',
  'Location Updates': 'Cập nhật vị trí',
  'Map filters': 'Bộ lọc bản đồ',
  'Choose Place Categories, Ward Naming, and Services Offered, then search by place name.':
    'Chọn danh mục địa điểm, phường và dịch vụ cung cấp, sau đó tìm theo tên địa điểm.',
  'Place name (supports Vietnamese with/without accents)': 'Tên địa điểm (hỗ trợ tiếng Việt có hoặc không dấu)',
  'Choose Place Categories': 'Chọn danh mục địa điểm',
  'Loading map management data...': 'Đang tải dữ liệu quản lý bản đồ...',
  'No subcategories under this main category yet.': 'Chưa có danh mục con nào dưới danh mục chính này.',
  'Select a main category first to create or manage its subcategories.':
    'Hãy chọn danh mục chính trước để tạo hoặc quản lý danh mục con.',
  'Select a main category to manage its subcategories and preview matching markers.':
    'Chọn một danh mục chính để quản lý danh mục con và xem trước các marker tương ứng.',
  'Update Ward': 'Cập nhật phường',
  'Delete Ward': 'Xóa phường',
  'Add Ward': 'Thêm phường',
  'No ward selected. Fill the form and click Add Ward.':
    'Chưa chọn phường nào. Hãy điền biểu mẫu và bấm Thêm phường.',
  'Approve Post': 'Duyệt bài đăng',
  'Update request moderation completed.': 'Đã hoàn tất kiểm duyệt yêu cầu cập nhật.',
  'Loading report detail...': 'Đang tải chi tiết báo cáo...',
  'Monday': 'Thứ Hai',
  'Tuesday': 'Thứ Ba',
  'Wednesday': 'Thứ Tư',
  'Thursday': 'Thứ Năm',
  'Friday': 'Thứ Sáu',
  'Saturday': 'Thứ Bảy',
  'Sunday': 'Chủ Nhật',
  '1 month': '1 tháng',
  '3 months': '3 tháng',
  '6 months': '6 tháng',
  'Show in Trending': 'Hiển thị trong mục nổi bật',
  'Place this post in high-traffic trending blocks.': 'Đưa bài đăng vào các khu vực nổi bật có lưu lượng cao.',
  'Featured Post Badge': 'Huy hiệu bài đăng nổi bật',
  'Highlight posts with a HOT badge across the homepage and other listing surfaces.':
    'Làm nổi bật bài đăng bằng huy hiệu HOT trên trang chủ và các danh sách khác.',
  'Priority Approval': 'Ưu tiên duyệt',
  'Move this post to a faster review queue.': 'Đưa bài đăng vào hàng chờ xét duyệt nhanh hơn.',
  'Post Quantity Limit': 'Giới hạn số lượng bài đăng',
  'Enable and define how many posts this package can promote.': 'Bật và xác định số bài đăng mà gói này có thể quảng bá.',
  'Shown in Trending section': 'Hiển thị trong mục nổi bật',
  'Featured Post Badge (HOT)': 'Huy hiệu bài đăng nổi bật (HOT)',
  'Priority approval queue': 'Hàng chờ duyệt ưu tiên',
  'No boosted distribution options enabled': 'Chưa bật tùy chọn tăng phân phối nào',
};

function interpolateText(template, variables = {}) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function translateAdminText(language, text, variables = {}) {
  const sourceText = String(text ?? '');
  const translated = language === 'vi' ? VI_TRANSLATIONS[sourceText] || sourceText : sourceText;
  return interpolateText(translated, variables);
}

function resolveLocale(language) {
  return language === 'vi' ? 'vi-VN' : 'en-US';
}

export function useAdminI18n() {
  const { language } = useLanguage();
  const locale = useMemo(() => resolveLocale(language), [language]);

  const tx = useCallback(
    (text, variables) => translateAdminText(language, text, variables),
    [language]
  );

  const formatNumber = useCallback(
    (value) => Number(value || 0).toLocaleString(locale),
    [locale]
  );

  const formatDate = useCallback(
    (value, options) => {
      if (!value) {
        return tx('N/A');
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return tx('N/A');
      }

      return parsed.toLocaleDateString(locale, options);
    },
    [locale, tx]
  );

  const formatDateTime = useCallback(
    (value, options) => {
      if (!value) {
        return tx('N/A');
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return tx('N/A');
      }

      return parsed.toLocaleString(locale, options);
    },
    [locale, tx]
  );

  const formatMonthLabel = useCallback(
    (value, options = { month: 'short' }) => {
      const [rawYear, rawMonth] = String(value || '').split('-');
      const year = Number.parseInt(rawYear, 10);
      const month = Number.parseInt(rawMonth, 10);

      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return value || tx('N/A');
      }

      const date = new Date(Date.UTC(year, month - 1, 1));
      return date.toLocaleDateString(locale, options);
    },
    [locale, tx]
  );

  return {
    language,
    locale,
    tx,
    formatDate,
    formatDateTime,
    formatMonthLabel,
    formatNumber,
  };
}

export default useAdminI18n;

const translations = {
  en: {
    brand: {
      name: 'Smart City',
      tagline: 'Discovery',
      homepageAria: 'Smart City home page'
    },
    header: {
      home: 'Home',
      about: 'About',
      allCity: 'All City',
      service: 'Service',
      login: 'Login',
      search: 'Search'
    },
    hero: {
      kicker: 'Taste Da Nang your way',
      title: 'Happy With <span>Delicious Food</span> And Landscape & Entertainment',
      description: 'Exploring new food, Landscape & Entertainment with different transition lets you carry that place and get a good price for us as well as you make a great impact for customers.',
  findByPictures: 'Find By Pictures',
  chooseFromLibrary: 'Choose from library',
  takeNewPhoto: 'Take a new photo',
  chooseOrCaptureImage: 'Choose or capture image',
  searchPlace: 'Search Places',
  searchFood: 'Search Food',
  backToSearchMode: 'Back',
  analyzingImage: 'Analyzing...',
  selectedImage: 'Selected image',
  removeImage: 'Remove',
  findAction: 'Find',
  merchant: 'For Merchants'
    },
    search: {
      food: 'Food',
      landscape: 'Landscape & Entertainment',
      findFood: 'Find Food',
      aiSuggest: 'AI Suggest',
      placeholder: 'Enter your address...',
      back: 'Back',
      searchByImage: 'Search by image',
      noResultHint: 'No matching results. You can go back or continue with image search.'
    },
    weather: {
      sunny: 'Sunny',
      rainy: 'Rainy',
      cloudy: 'Cloudy',
      clear: 'Clear'
    },
    sections: {
      food: 'Food',
      landscape: 'Landscape & Entertainment',
      maps: 'Maps'
    },
    profile: {
      accountInfo: '👤 Account Information',
      managePost: '🏪 Manage Posts',
      feedback: '🗺️ Feedback & Support',
      terms: 'ℹ️ Terms of Use',
      logout: 'Logout',
      hello: 'Hello'
    },
    merchant: {
      overview: 'Overview',
      posts: 'Manage Posts',
      transactions: 'Transaction History',
      support: 'Feedback & Support',
      logout: 'Logout',
      publish: 'Post',
      hello: 'Hello, Merchant',
      selectFromMenu: 'Please select an item from the menu on the left to start.',
      contentHere: 'Content will be displayed here',
      activeAll: 'Active (All)',
      pending: 'Pending',
      rejected: 'Rejected',
      searchPlaceholder: 'Search posts...',
      edit: 'Edit',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this post?',
      noPostsFound: 'No posts found',
      reviews: 'reviews'
    },
    auth: {
      fullname: 'Full name:',
      username: 'Username:',
      email: 'Email:',
      password: 'Password:',
      confirmPassword: 'Confirm Password:',
      createAccount: 'Create account',
      signIn: 'Sign in',
      register: 'Please Fill out form to Register!',
      passwordMismatch: 'Passwords do not match',
      passwordNotMatch: 'Passwords do not match',
      registerSuccess: 'Registered successfully!',
      registerFailed: 'Register failed',
      loginFailed: 'Login failed',
      signingUp: 'Signing up...',
      signingIn: 'Signing in...',
      haveAccount: 'Yes, I have an account?',
      dontHaveAccount: "Don't have an account?",
      signUp: 'Sign Up',
      orContinueWith: 'Or continue with',
      loginWithGoogle: 'Login with Google',
      loginWithFacebook: 'Login with Facebook',
      passwordRequirements: 'Password Requirements:',
      minLength: 'At least 8 characters',
      hasUpperCase: 'At least 1 uppercase letter (A-Z)',
      hasSpecialChar: 'At least 1 special character (!@#$%^&*...)',
      usernameExists: 'Username already exists',
      emailExists: 'Email already exists',
      fixErrors: 'Please fix the errors before registering'
    },
    termsPage: {
      title: 'Terms of Use',
      intro: 'Please review these rules to use the platform responsibly.',
      lastUpdated: 'Last updated',
      common: 'General rules',
      poster: 'Rules for place/content owners',
      user: 'Rules for users'
    },
    globalUi: {
      language: 'Language',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      switchToLight: 'Switch to light mode',
      switchToDark: 'Switch to dark mode'
    },
    mapPage: {
      backToHome: 'Back to Home',
      title: 'City Map Explorer',
      subtitle: 'Explore wards and approved places with live filtering.'
    },
    app: {
      about: {
        title: 'About Smart City Discovery',
        description: 'This sample page shows that route content can change while the shared header, search, food, and footer stay intact.',
        cards: [
          {
            title: 'Local-first discovery',
            copy: 'Focus on venues, food, and highlights so users can search quickly by area.'
          },
          {
            title: 'Merchant support',
            copy: 'Give merchants a simple way to publish photos, menus, offers, and promotional content.'
          },
          {
            title: 'GIS mindset',
            copy: 'Treat maps and administrative wards as core data layers that can expand later.'
          }
        ]
      },
      allCity: {
        title: 'All City Highlights',
        description: 'This is a sample page for a combined city category. Switching routes keeps the shared shell mounted and stable.',
        cards: [
          {
            title: 'Food districts',
            copy: 'Group dining areas by beach zones, central districts, and tourist streets.'
          },
          {
            title: 'Popular landmarks',
            copy: 'Collect check-in spots, famous bridges, museums, and major temples across the city.'
          },
          {
            title: 'Suggested routes',
            copy: 'Suggest compact one-day or weekend routes for travelers.'
          }
        ]
      },
      service: {
        title: 'Service',
        description: 'Use this page for delivery, booking, affiliate ads, or any other service page while reusing the shared shell.',
        cards: [
          {
            title: 'Delivery support',
            copy: 'Connect delivery addresses, merchants, and venue menus in one flow.'
          },
          {
            title: 'Promotion slots',
            copy: 'Let merchants buy featured positions on the landing page without breaking the overall layout.'
          },
          {
            title: 'Content modules',
            copy: 'Each child route can add its own sections without copying the header, food, or footer.'
          }
        ]
      }
    },
    layout: {
      workspace: {
        groupTitle: 'Workspace',
        overview: 'Overview',
        overviewDesc: 'Project command center',
        discovery: 'Discovery',
        discoveryDesc: 'Explore venues',
        adminBoundaries: 'Admin Boundaries',
        adminBoundariesDesc: 'Manage GIS wards',
        merchantWorkbench: 'Merchant Workbench',
        merchantWorkbenchDesc: 'Merchant venue tools',
        brandCopy: 'Role and feature-based workspace so teams can deliver in parallel with clear flow.',
        backendBaseUrl: 'Backend base URL',
        workspaceCurrent: 'Current workspace',
        workspaceFallback: 'Overview',
        workspaceFallbackDesc: 'Project command center and delivery split.',
        scaffoldChip: 'GIS-first scaffold',
        language: 'Language',
        themeDark: 'Dark',
        themeLight: 'Light'
      },
      admin: {
        title: 'Admin',
        dashboard: 'Dashboard',
        users: 'User Management',
        map: 'Map Management',
        reports: 'Reports & Revenue',
        packages: 'Ad Packages',
        feedback: 'Feedback & Support',
        logout: 'Log out',
        role: 'Administrator',
        language: 'Language',
        dark: 'Dark',
        light: 'Light',
        notifications: 'Notifications'
      }
    }
  },
  vi: {
    brand: {
      name: 'Smart City',
      tagline: 'Discovery',
      homepageAria: 'Trang chủ Smart City'
    },
    header: {
      home: 'Trang chủ',
      about: 'Giới thiệu',
      allCity: 'Tất cả thành phố',
      service: 'Dịch vụ',
      login: 'Đăng nhập',
      search: 'Tìm kiếm'
    },
    hero: {
      kicker: 'Thưởng thức Đà Nẵng theo cách của bạn',
      title: 'Hạnh phúc với <span>Đồ ăn ngon</span> Và danh lam thắng cảnh & Giải trí',
      description: 'Khám phá đồ ăn mới, danh lam thắng cảnh & giải trí với những chuyển động khác nhau giúp bạn mang theo địa điểm đó và nhận được giá tốt cho chúng tôi cũng như tạo tác động lớn cho khách hàng.',
  findByPictures: 'Tìm bằng hình ảnh',
  chooseFromLibrary: 'Chọn ảnh từ thư viện',
  takeNewPhoto: 'Chụp ảnh mới',
  chooseOrCaptureImage: 'Chọn hoặc chụp ảnh',
  searchPlace: 'Tìm kiếm địa điểm',
  searchFood: 'Tìm kiếm món ăn',
  backToSearchMode: 'Quay lại',
  analyzingImage: 'Đang phân tích...',
  selectedImage: 'Ảnh đã chọn',
  removeImage: 'Xoá',
  findAction: 'Tìm',
  merchant: 'Dành cho thương nhân'
    },
    search: {
      food: 'Đồ ăn',
      landscape: 'Danh lam thắng cảnh & Giải trí',
      findFood: 'Tìm đồ ăn',
      aiSuggest: 'Gợi ý AI',
      placeholder: 'Nhập địa chỉ của bạn...',
      back: 'Quay lại',
      searchByImage: 'Tìm bằng ảnh',
      noResultHint: 'Không có kết quả phù hợp. Bạn có thể quay lại hoặc tiếp tục tìm bằng ảnh.'
    },
    weather: {
      sunny: 'Năng',
      rainy: 'Mưa',
      cloudy: 'Mây',
      clear: 'Tháng'
    },
    sections: {
      food: 'Đồ ăn',
      landscape: 'Danh lam thắng cảnh & Giải trí',
      maps: 'Bản đồ'
    },
    profile: {
      accountInfo: '👤 Thông tin tài khoản',
      managePost: '🏪 Quản lý bài đăng',
      feedback: '🗺️ Góp ý & hỗ trợ',
      terms: 'ℹ️ Điều khoản sử dụng',
      logout: 'Đăng xuất',
      hello: 'Xin chào'
    },
    merchant: {
      overview: 'Tổng Quan',
      posts: 'Quản lý bài đăng',
      transactions: 'Lịch sử giao dịch',
      support: 'Góp ý & hỗ trợ',
      logout: 'Đăng xuất',
      publish: 'Đăng bài',
      hello: 'Xin chào, Merchant',
      selectFromMenu: 'Hãy chọn một mục từ menu bên trái để bắt đầu.',
      contentHere: 'Nội dung sẽ được hiển thị tại đây',
      activeAll: 'Đang hoạt động (Tất cả)',
      pending: 'Chờ duyệt',
      rejected: 'Bị từ chối',
      searchPlaceholder: 'Tìm kiếm bài đăng...',
      edit: 'Chỉnh sửa',
      delete: 'Xóa',
      confirmDelete: 'Bạn có chắc muốn xóa bài đăng này?',
      noPostsFound: 'Không có bài đăng nào',
      reviews: 'đánh giá'
    },
    auth: {
      fullname: 'Họ tên:',
      username: 'Tên đăng nhập:',
      email: 'Email:',
      password: 'Mật khẩu:',
      confirmPassword: 'Xác nhận mật khẩu:',
      createAccount: 'Tạo tài khoản',
      signIn: 'Đăng nhập',
      register: 'Vui lòng điền đầy đủ form để đăng ký!',
      passwordMismatch: 'Mật khẩu không khớp',
      passwordNotMatch: 'Mật khẩu không khớp',
      registerSuccess: 'Đăng ký thành công!',
      registerFailed: 'Đăng ký thất bại',
      loginFailed: 'Đăng nhập thất bại',
      signingUp: 'Đang đăng ký...',
      signingIn: 'Đang đăng nhập...',
      haveAccount: 'Bạn đã có tài khoản?',
      dontHaveAccount: 'Bạn chưa có tài khoản?',
      signUp: 'Đăng ký',
      orContinueWith: 'Hoặc tiếp tục với',
      loginWithGoogle: 'Đăng nhập bằng Google',
      loginWithFacebook: 'Đăng nhập bằng Facebook',
      passwordRequirements: 'Yêu cầu mật khẩu:',
      minLength: 'Ít nhất 8 ký tự',
      hasUpperCase: 'Ít nhất 1 chữ cái viết hoa (A-Z)',
      hasSpecialChar: 'Ít nhất 1 ký tự đặc biệt (!@#$%^&*...)',
      usernameExists: 'Tên đăng nhập đã tồn tại',
      emailExists: 'Email đã tồn tại',
      fixErrors: 'Vui lòng sửa lỗi trước khi đăng ký'
    },
    termsPage: {
      title: 'Điều khoản sử dụng',
      intro: 'Vui lòng đọc kỹ các quy định sau trước khi sử dụng nền tảng.',
      lastUpdated: 'Cập nhật',
      common: 'Quy định chung',
      poster: 'Quy định cho người đăng địa điểm / nội dung',
      user: 'Quy định cho người sử dụng nền tảng'
    },
    globalUi: {
      language: 'Ngôn ngữ',
      theme: 'Giao diện',
      light: 'Sáng',
      dark: 'Tối',
      switchToLight: 'Chuyển sang chế độ sáng',
      switchToDark: 'Chuyển sang chế độ tối'
    },
    mapPage: {
      backToHome: 'Về trang chủ',
      title: 'Bản đồ thành phố',
      subtitle: 'Khám phá phường và địa điểm đã duyệt với bộ lọc thời gian thực.'
    },
    app: {
      about: {
        title: 'Giới thiệu Smart City Discovery',
        description: 'Trang mẫu này cho thấy nội dung route có thể thay đổi trong khi header, tìm kiếm, món ăn và footer dùng chung vẫn giữ nguyên.',
        cards: [
          {
            title: 'Khám phá theo địa phương',
            copy: 'Tập trung vào địa điểm, món ăn và điểm nổi bật để người dùng tìm nhanh theo khu vực.'
          },
          {
            title: 'Hỗ trợ merchant',
            copy: 'Cho merchant cách đơn giản để đăng ảnh, menu, ưu đãi và nội dung quảng bá.'
          },
          {
            title: 'Tư duy GIS',
            copy: 'Xem bản đồ và ranh giới hành chính như lớp dữ liệu cốt lõi để mở rộng sau này.'
          }
        ]
      },
      allCity: {
        title: 'Điểm nổi bật toàn thành phố',
        description: 'Đây là trang mẫu cho danh mục tổng hợp. Khi chuyển route, shell dùng chung vẫn được giữ nguyên.',
        cards: [
          {
            title: 'Khu ẩm thực',
            copy: 'Nhóm các khu ăn uống theo khu biển, trung tâm thành phố và tuyến du lịch.'
          },
          {
            title: 'Địa danh phổ biến',
            copy: 'Tổng hợp các điểm check-in, cây cầu nổi tiếng, bảo tàng và chùa lớn trong thành phố.'
          },
          {
            title: 'Lộ trình gợi ý',
            copy: 'Gợi ý lịch trình gọn trong 1 ngày hoặc cuối tuần cho khách du lịch.'
          }
        ]
      },
      service: {
        title: 'Dịch vụ',
        description: 'Trang này có thể dùng cho giao đồ, đặt bàn, quảng cáo affiliate hoặc các page dịch vụ khác mà vẫn dùng lại khung trang chung.',
        cards: [
          {
            title: 'Hỗ trợ giao hàng',
            copy: 'Kết nối địa chỉ giao hàng, merchant và danh sách món ăn trong cùng một flow.'
          },
          {
            title: 'Vị trí quảng bá',
            copy: 'Cho phép merchant mua vị trí nổi bật trên landing page mà không phá vỡ bố cục tổng.'
          },
          {
            title: 'Mô-đun nội dung',
            copy: 'Mỗi route con có thể thêm section riêng mà không cần copy lại header, food và footer.'
          }
        ]
      }
    },
    layout: {
      workspace: {
        groupTitle: 'Không gian làm việc',
        overview: 'Tổng quan',
        overviewDesc: 'Trung tâm điều phối dự án',
        discovery: 'Khám phá',
        discoveryDesc: 'Khám phá địa điểm',
        adminBoundaries: 'Ranh giới quản trị',
        adminBoundariesDesc: 'Quản lý bản đồ phường',
        merchantWorkbench: 'Bảng điều khiển Merchant',
        merchantWorkbenchDesc: 'Công cụ quản lý địa điểm',
        brandCopy: 'Khung làm việc theo vai trò và tính năng để team triển khai song song đúng luồng.',
        backendBaseUrl: 'Đường dẫn backend',
        workspaceCurrent: 'Không gian hiện tại',
        workspaceFallback: 'Tổng quan',
        workspaceFallbackDesc: 'Trung tâm điều phối dự án.',
        scaffoldChip: 'Khung GIS ưu tiên',
        language: 'Ngôn ngữ',
        themeDark: 'Tối',
        themeLight: 'Sáng'
      },
      admin: {
        title: 'Admin',
        dashboard: 'Bảng điều khiển',
        users: 'Quản lý người dùng',
        map: 'Quản lý bản đồ',
        reports: 'Báo cáo & doanh thu',
        packages: 'Gói quảng cáo',
        feedback: 'Phản hồi & hỗ trợ',
        logout: 'Đăng xuất',
        role: 'Quản trị viên',
        language: 'Ngôn ngữ',
        dark: 'Tối',
        light: 'Sáng',
        notifications: 'Thông báo'
      }
    }
  }
};

export default translations;

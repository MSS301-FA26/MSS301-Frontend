# BÁO CÁO TOÀN DIỆN KIỂM TOÁN KIẾN TRÚC FRONTEND
**Dự án**: CinemaAI Frontend (CinePremier)  
**Đường dẫn**: `C:\Users\hieu.tuanz\Desktop\KY-9\MSS301\MSS301-Frontend`  
**Thời điểm kiểm tra**: 2026-09-27  
**Vai trò**: Senior Frontend Architect & Senior React Engineer  
**Trạng thái tuân thủ**: Báo cáo ĐỘC BẢN KIỂM TRA (INSPECTION ONLY) - KHÔNG chỉnh sửa bất kỳ tệp mã nguồn nào.

---

## MỤC LỤC
1. [Executive Summary](#1-executive-summary)
2. [Frontend Technology Stack](#2-frontend-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication Architecture](#4-authentication-architecture)
5. [Role & Permission Model](#5-role--permission-model)
6. [Routing & Route Guards](#6-routing--route-guards)
7. [Navigation / Sidebar Matrix](#7-navigation--sidebar-matrix)
8. [Admin Feature Audit](#8-admin-feature-audit)
9. [Manager Feature Audit](#9-manager-feature-audit)
10. [Staff Feature Audit](#10-staff-feature-audit)
11. [Customer Feature Audit](#11-customer-feature-audit)
12. [Cinema / Branch Scope Audit](#12-cinema--branch-scope-audit)
13. [Movie / Genre / Actor / Director Audit](#13-movie--genre--actor--director-audit)
14. [Cinema / Room / Seat Audit](#14-cinema--room--seat-audit)
15. [Showtime Audit](#15-showtime-audit)
16. [Pricing Audit](#16-pricing-audit)
17. [Reports Audit](#17-reports-audit)
18. [System Settings Audit](#18-system-settings-audit)
19. [Promotion Legacy Audit](#19-promotion-legacy-audit)
20. [Booking Flow](#20-booking-flow)
21. [Payment Flow](#21-payment-flow)
22. [Ticket / QR / Check-in Flow](#22-ticket--qr--check-in-flow)
23. [API Client Inventory](#23-api-client-inventory)
24. [Frontend Type / DTO Compatibility](#24-frontend-type--dto-compatibility)
25. [Error Handling](#25-error-handling)
26. [Frontend Security Findings](#26-frontend-security-findings)
27. [Hard-coded / Duplicated Configuration](#27-hard-coded--duplicated-configuration)
28. [Legacy / Dead Code Candidates](#28-legacy--dead-code-candidates)
29. [Backend–Frontend Compatibility Matrix](#29-backendfrontend-compatibility-matrix)
30. [Required Future Changes by Priority](#30-required-future-changes-by-priority)
31. [Answers Q1-Q30](#31-answers-q1-q30)
32. [Missing Information / Needs Confirmation](#32-missing-information--needs-confirmation)

---

## 1. EXECUTIVE SUMMARY

Dự án frontend **CinemaAI (CinePremier)** được xây dựng trên nền tảng **React 19 (Vite, TailwindCSS v4, Zustand)**, phục vụ 4 nhóm người dùng chính: **ADMIN**, **MANAGER**, **STAFF**, và **CUSTOMER**. 

Sau quá trình tái cấu trúc toàn diện Backend thành kiến trúc Microservices 5 dịch vụ (`api-gateway`, `identity-service`, `catalog-service`, `booking-service`, `payment-service`) với mô hình phân quyền chặt chẽ theo cụm rạp (Multi-branch Cinema RBAC) và lược bỏ hoàn toàn module Khuyến mãi (Promotion), Frontend hiện tại bộc lộ nhiều điểm không tương thích kiến trúc nghiêm trọng:

1. **Manager Route & UI Leak**: Các route `/manager/*` đang bị redirect toàn bộ sang `/admin/*`. `AdminRoute` và `AdminPage` cho phép Manager đăng nhập trực tiếp vào trang quản trị của Admin. Tại đây, Manager thấy và có thể nhấn vào các panel tạo/sửa/xóa Phim, Thể loại, Diễn viên (vốn đã bị Backend chặn bằng `ROLE_ADMIN` và sẽ ném lỗi 403).
2. **Lỗi nghiêm trọng xử lý mã lỗi 403 Forbidden**: Trong `src/services/authService.js`, mã lỗi `403` bị gộp chung với `401`. Khi Backend từ chối quyền (403), Frontend tự động kích hoạt refresh token; khi thất bại sẽ gọi `expireAuthSession()` và **CƯỠNG CHẾ ĐĂNG XUẤT** người dùng với thông báo "Phiên đăng nhập đã hết hạn".
3. **Thực thể Đạo diễn (Director)**: Backend đã chuẩn hóa Director thành thực thể riêng biệt (`GET /api/v1/directors`, `/api/v1/admin/directors`). Frontend hiện tại chưa có CRUD Director và vẫn xử lý Director như một chuỗi văn bản thuần (`string`) hoặc mảng chuỗi ghép thủ công trong form Phim.
4. **Ngữ cảnh Cụm rạp phía Khách hàng**: Phía Customer hoàn toàn chưa có bước chọn Cụm rạp (Branch/Cinema Selection). `useMovieStore` duy trì singleton `publicCinema`, và trang đặt vé `BookingPage.jsx` tải suất chiếu theo phim mà không phân loại cụm rạp.
5. **Cấu hình Giá vé (Pricing)**: File giao diện `AdminPricingPanel.jsx` tồn tại nhưng **chưa được gắn (unmounted)** vào `AdminPage.jsx` hay menu điều hướng. Giao diện chưa phân tách rõ quy tắc Toàn cục (`cinemaId == null`) và quy tắc Cụm rạp (`cinemaId != null`).
6. **Mã chết / Module Khuyến mãi (Promotion)**: Tồn tại component `AdminPromotionsPanel.jsx` nhưng không được mount vào đâu và `adminService.js` không có hàm tương ứng. Module này là mã chết hoàn toàn cần loại bỏ.
7. **Cấu hình Hệ thống (System Settings)**: Endpoint mới `/api/v1/admin/system-settings` **chưa được hiện thực (NOT IMPLEMENTED)** ở bất kỳ đâu trên Frontend.
8. **An toàn bảo mật nội bộ**: Frontend hoàn toàn sạch bóng các cuộc gọi `/internal/**` và không lưu trữ bí mật `X-Internal-Service-Secret`.

---

## 2. FRONTEND TECHNOLOGY STACK

| Công nghệ / Thư viện | Phiên bản | Nơi cấu hình | Phạm vi & Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **React** | 19.0.1 | `package.json` | Thư viện UI cốt lõi |
| **React DOM** | 19.0.1 | `package.json` | Render DOM |
| **Ngôn ngữ** | JavaScript (ES Module, JSX) | `vite.config.ts`, `package.json` | Ngôn ngữ phát triển toàn bộ dự án |
| **Build Tool / Bundler** | Vite 6.2.3 | `vite.config.ts`, `package.json` | Dev server (port 3000) & Production build |
| **Router Library** | react-router-dom 7.16.0 | `src/routes/AppRoutes.jsx` | Điều hướng SPA, bảo vệ Route Guards |
| **State Management** | Zustand 5.0.14 | `src/stores/useAuthStore.js`, `useMovieStore.js`, `useUiStore.js` | Quản lý trạng thái xác thực, danh mục phim, UI modal/toast |
| **HTTP Client** | Axios 1.18.0 | `src/configs/axios.js`, `src/services/authService.js` | Giao tiếp REST API qua cổng API Gateway (8080) |
| **CSS Framework** | Tailwind CSS 4.1.14 | `@tailwindcss/vite`, `src/index.css` | Toàn bộ styling giao diện theo phong cách Cinematic Dark |
| **Icon Library** | Lucide React 0.546.0 | `package.json` | Bộ icon vector toàn hệ thống |
| **Animation Library** | Motion (Framer Motion) 12.23.24 | `package.json` | Chuyển cảnh modal, hiệu ứng bảng và timeline |
| **Notification / Toast** | Sonner 2.0.7 | `src/App.jsx` (`<Toaster />`) | Hiển thị thông báo Toast góc màn hình |
| **Chart Library** | Recharts 3.9.2 | `src/pages/admin/overview/AdminOverviewPanel.jsx`, `AdminStatsPanel.jsx` | Biểu đồ doanh thu, tỷ lệ lấp đầy, giờ cao điểm |
| **QR Code Generator** | qrcode.react 4.2.0 | `src/pages/user/MyOrdersPage.jsx`, `MyTicketsPage.jsx` | Render mã QR vé xem phim (SVG) |
| **QR Code Scanner** | jsQR 1.4.0 | `src/pages/staff/StaffCheckInPage.jsx` | Quét mã QR vé xem phim qua WebCam/Camera trực tiếp |
| **Form Library** | React Controlled State (Vanilla) | Các tệp form trong `src/pages/` | Quản lý form thông qua state cục bộ (`useState`) |
| **Validation Library** | Custom Validators | `src/utils/validation.js`, `src/utils/seatValidation.js` | Kiểm tra email, mật khẩu, dữ liệu ghế và form phim |
| **Date/Time Library** | Vanilla JS Date & Intl API | Tự định nghĩa helper trong `src/utils/helpers.js` | Format ngày giờ tiếng Việt (`vi-VN`) |
| **Auth Persistence** | LocalStorage | `src/configs/constants.js`, `src/services/authService.js` | Lưu trữ Access Token, Refresh Token, User Profile, Roles |
| **Role Guarding** | Custom Higher-Order Components | `AdminRoute.jsx`, `ManagerRoute.jsx`, `StaffRoute.jsx`, `ProtectedRoute.jsx` | Bảo vệ điều hướng theo quyền hạn |

---

## 3. PROJECT STRUCTURE

Cấu trúc thư mục thực tế của dự án `C:\Users\hieu.tuanz\Desktop\KY-9\MSS301\MSS301-Frontend`:

```
MSS301-Frontend/
├── .env                              # Cấu hình biến môi trường (VITE_API_BASE_URL, Google Client ID)
├── package.json                      # Danh sách dependencies & scripts
├── vite.config.ts                    # Cấu hình Vite & Tailwind plugin
├── src/
│   ├── main.jsx                      # Entry point React 19
│   ├── App.jsx                       # Root component, Toaster, Auth initialization
│   ├── index.css                     # Tailwind v4 theme, global custom styles
│   ├── configs/
│   │   ├── axios.js                  # Axios instance baseURL: VITE_API_BASE_URL
│   │   └── constants.js              # Storage keys, API endpoints, Admin access flag
│   ├── context/
│   │   └── ManagerCinemaContext.jsx  # Context quản lý rạp của Manager (đang có logic chọn tùy ý)
│   ├── layouts/
│   │   ├── AdminLayout.jsx           # Layout admin
│   │   ├── ManagerLayout.jsx         # Layout manager với header hiển thị rạp
│   │   └── UserLayout.jsx            # Layout khách hàng (Navbar, Footer, Search, Cart)
│   ├── routes/
│   │   ├── AppRoutes.jsx             # Định nghĩa toàn bộ Route và logic Redirect
│   │   ├── AdminRoute.jsx            # Guard cho Admin & Manager
│   │   ├── ManagerRoute.jsx          # Guard cho Manager (chưa dùng độc lập)
│   │   ├── StaffRoute.jsx            # Guard cho Staff
│   │   └── ProtectedRoute.jsx        # Guard yêu cầu đăng nhập
│   ├── stores/
│   │   ├── useAuthStore.js           # Quản lý auth state, login, logout, currentUser, currentRole
│   │   ├── useMovieStore.js          # Quản lý danh sách phim, danh mục món ăn, singleton publicCinema
│   │   └── useUiStore.js             # Quản lý sidebar collapsed, toast notifications, auth modals
│   ├── services/
│   │   ├── apiFactory.js             # Factory sinh CRUD REST standard
│   │   ├── authService.js            # Xử lý JWT, Token Refresh, Axios Request, RBAC checking
│   │   ├── adminService.js           # API clients cho Admin (Movies, Genres, Actors, Rooms, Showtimes, Users...)
│   │   ├── bookingService.js         # API clients cho Booking, SeatMap, CheckoutQuote, FoodOrders
│   │   ├── paymentService.js         # API clients cho VNPay, Mock Payment
│   │   ├── staffService.js           # API clients cho Staff Check-in, Lookup, Food pickup
│   │   ├── movieService.js           # API clients danh mục phim công khai
│   │   ├── userService.js            # API clients thông tin cá nhân khách hàng
│   │   ├── walletService.js          # API clients CineWallet, nạp rút tiền
│   │   ├── loyaltyService.js         # API clients CinePoints
│   │   ├── reviewService.js          # API clients đánh giá phim
│   │   ├── wishlistService.js        # API clients danh sách yêu thích
│   │   └── chatService.js            # API clients trợ lý AI CineBot
│   ├── utils/
│   │   ├── helpers.js                # Định dạng tiền tệ VND, thời gian, tên viết tắt
│   │   ├── seatMap.js                # Tính toán ma trận layout ghế phòng chiếu
│   │   ├── seatValidation.js         # Quy tắc chọn ghế (không để trống ghế đơn lẻ)
│   │   └── validation.js             # Regex kiểm tra form đầu vào
│   ├── components/
│   │   ├── common/                   # Modal, Button, Badge, Skeleton, ConfirmDialog
│   │   ├── manager/
│   │   │   └── ManagerSidebar.jsx    # Sidebar quản trị riêng cho Manager (đang bị unmounted)
│   │   ├── navbar/                   # Navbar công khai cho khách hàng
│   │   ├── footer/                   # Footer
│   │   └── booking/                  # Ghế ngồi, tóm tắt thanh toán, đồng hồ đếm ngược
│   └── pages/
│       ├── auth/
│       │   ├── AuthModal.jsx         # Modal đăng nhập / đăng ký
│       │   └── GooglePasswordSetupPage.jsx # Đặt mật khẩu lần đầu cho Google OAuth
│       ├── admin/
│       │   ├── AdminPage.jsx         # Dashboard tổng hợp của Admin (kiêm Manager)
│       │   ├── catalog/              # AdminMoviesPanel, AdminGenresPanel, AdminActorsPanel, AdminFoodsPanel
│       │   ├── cinema/               # AdminCinemaPanel, AdminRoomsPanel, AdminShowtimesPanel, AdminTicketsPanel, AdminPricingPanel, AdminShowtimeIncidentsPanel
│       │   ├── overview/             # AdminOverviewPanel, AdminStatsPanel, AdminFnbReportPanel
│       │   ├── promotions/           # AdminPromotionsPanel (MÃ CHẾT / UNMOUNTED)
│       │   └── system/               # AdminUsersPanel, AdminAuditPanel, AdminLoyaltyPanel, AdminReviewsPanel, AdminWalletPanel, AdminManagersPage
│       ├── manager/                  # 10 trang manager riêng biệt (ĐANG BỊ REDIRECT TOÀN BỘ VỀ /admin/*)
│       │   ├── ManagerDashboard.jsx
│       │   ├── ManagerOverviewPage.jsx
│       │   ├── ManagerMoviesPage.jsx
│       │   ├── ManagerShowtimesPage.jsx
│       │   ├── ManagerRoomsPage.jsx
│       │   ├── ManagerInventoryPage.jsx
│       │   ├── ManagerBookingsPage.jsx
│       │   ├── ManagerStaffPage.jsx
│       │   ├── ManagerReportsPage.jsx
│       │   └── ManagerAuditLogsPage.jsx
│       ├── staff/
│       │   ├── StaffCheckInPage.jsx  # Giao diện soát vé QR, mã đặt chỗ, giao bắp nước của Staff
│       │   └── StaffWalletPanel.jsx  # Bảng duyệt ví (nếu được nhúng)
│       └── user/
│           ├── HomePage.jsx          # Trang chủ người dùng
│           ├── ExplorePage.jsx       # Khám phá phim
│           ├── MovieDetailPage.jsx   # Chi tiết phim, trailer, đánh giá
│           ├── ShowtimesPage.jsx     # Xem lịch chiếu theo ngày
│           ├── BookingPage.jsx       # Luồng chọn suất chiếu, chọn ghế, chọn bắp nước, giữ chỗ
│           ├── ConcessionsPage.jsx   # Đặt bắp nước riêng lẻ
│           ├── PaymentCallbackPage.jsx # Xử lý phản hồi từ cổng thanh toán VNPay
│           ├── MyOrdersPage.jsx      # Quản lý đơn hàng & mã QR vé
│           ├── MyTicketsPage.jsx     # Chi tiết vé
│           ├── FoodOrdersHistoryPage.jsx
│           ├── ProfilePage.jsx       # Hồ sơ cá nhân
│           ├── WishlistPage.jsx      # Phim yêu thích
│           └── PoliciesPage.jsx      # Quy định điều khoản
```

---

## 4. AUTHENTICATION ARCHITECTURE

### Luồng Xác thực (Authentication Flow)
1. **Đăng nhập**: Người dùng đăng nhập qua form modal (`src/pages/auth/AuthModal.jsx`) hoặc Google OAuth. Gửi yêu cầu tới `POST /api/v1/auth/login` hoặc `POST /api/v1/auth/google`.
2. **Nhận Token**: Backend trả về `accessToken`, `refreshToken`, `expiresIn`, và `user` object.
3. **Lưu trữ (Persistence)**:
   - `cinepremier_access_token` trong `localStorage`.
   - `cinepremier_refresh_token` trong `localStorage`.
   - `cinepremier_access_token_expires_at` trong `localStorage`.
   - `cinepremier_auth_user` trong `localStorage` (chứa `id`, `email`, `fullName`, `roles`, `cinemaId`).
   - `cinepremier_auth_roles` trong `localStorage`.
4. **Giải mã Token (JWT Decoding)**:
   - Hàm `parseJwtPayload(accessToken)` trong `src/services/authService.js` bóc tách payload Base64URL.
   - Tìm kiếm danh sách roles trong payload thông qua các claim: `roles`, `authorities`, `role`, `scope`.
   - Chuẩn hóa: loại bỏ prefix `ROLE_`, chuyển thành chữ hoa.
5. **Cơ chế Refresh Token**:
   - Khi token sắp hết hạn hoặc yêu cầu gặp lỗi xác thực, hàm `tryRefreshToken()` trong `authService.js` gọi `POST /api/v1/auth/refresh` gửi kèm `refreshToken`.
   - Lưu trữ lại token mới và tiếp tục thực hiện lại request bị gián đoạn.
6. **Đăng xuất (Logout)**:
   - Xóa toàn bộ key trong `localStorage`, reset trạng thái trong `useAuthStore`, chuyển hướng về trang chủ `/`.
7. **Nguồn gốc `cinemaId`**:
   - `cinemaId` được lấy từ `user.cinemaId` trả về trong profile đăng nhập (`cinepremier_auth_user`).
   - Tuy nhiên, trong `ManagerCinemaContext.jsx`, tồn tại thêm state `manager_selected_cinema_id` trong `localStorage`, cho phép Manager thay đổi rạp đang chọn thông qua dropdown giao diện.

---

## 5. ROLE & PERMISSION MODEL

### Bảng Phân Tích Quyền Hiện Tại Trên Mã Nguồn

| Vai trò (Role) | Cách nhận diện trong Frontend | Route có thể truy cập | Menu hiển thị trên UI | Quyền thao tác API thực tế | Tệp tin liên quan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | `role === 'admin'`, `roles.includes('ADMIN')` hoặc `ROLE_ADMIN` | Toàn bộ `/admin/*`, tất cả route công khai & user | Thấy toàn bộ menu quản trị (17 mục), bao gồm "Hệ thống cụm rạp", Thống kê toàn hệ thống, Quản lý tài khoản Manager & Staff | Thực hiện toàn bộ API CRUD Admin không bị giới hạn | `src/services/authService.js`<br>`src/routes/AdminRoute.jsx`<br>`src/pages/admin/AdminPage.jsx` |
| **MANAGER** | `role === 'manager'`, `roles.includes('MANAGER')` hoặc `ROLE_MANAGER` | Bị chuyển hướng vào `/admin/*` (thay vì `/manager/*`) | Thấy hầu hết menu Admin trừ menu "Hệ thống cụm rạp" (`cinema`). Vẫn thấy menu Phim, Thể loại, Diễn viên, Người dùng, Thống kê | Bị Backend từ chối (403) khi sửa Phim, Thể loại, Diễn viên. Có quyền sửa Phòng, Suất chiếu, tạo Staff thuộc rạp mình | `src/routes/AppRoutes.jsx`<br>`src/routes/ManagerRoute.jsx`<br>`src/layouts/ManagerLayout.jsx`<br>`src/pages/admin/AdminPage.jsx` |
| **STAFF** | `role === 'staff'`, `roles.includes('STAFF')` hoặc `ROLE_STAFF` | Duy nhất `/staff` (StaffCheckInPage) | Chỉ thanh Header nhân viên soát vé, không có thanh điều hướng Admin/Manager | Soát vé QR, soát vé từng ghế, tra cứu đơn hàng, xác nhận giao bắp nước, xem lịch sử | `src/routes/StaffRoute.jsx`<br>`src/pages/staff/StaffCheckInPage.jsx`<br>`src/services/staffService.js` |
| **CUSTOMER** | Mặc định (người dùng chưa đăng nhập hoặc có role `CUSTOMER` / `USER`) | `/`, `/movies`, `/showtimes`, `/movies/:id`, `/movies/:id/book`, `/tickets`, `/profile`... | Navbar người dùng: Trang chủ, Lịch chiếu, Phim, Bắp nước, Vé của tôi, Tài khoản | Đặt vé, giữ chỗ, thanh toán VNPay, xem vé điện tử, đánh giá phim | `src/layouts/UserLayout.jsx`<br>`src/routes/AppRoutes.jsx`<br>`src/pages/user/BookingPage.jsx` |

### Vấn đề nhân rộng & mã hóa cứng logic Role
- Logic kiểm tra vai trò bị lặp lại tại rất nhiều file (`authService.js`, `AppRoutes.jsx`, `AdminRoute.jsx`, `AdminPage.jsx`, `AdminUsersPanel.jsx`, `AdminRoomsPanel.jsx`, `AdminShowtimesPanel.jsx`).
- Thay vì sử dụng một Policy / Permission Engine thống nhất, Frontend liên tục kiểm tra thủ công `isAdmin || userRole.includes('ADMIN')` và `isEffectiveManager = !isEffectiveAdmin && ...`.

---

## 6. ROUTING & ROUTE GUARDS

### Danh Sách Tuyến Đường Chính & Guards

| Route | Component Page | Quyền cho phép (Allowed Role) | File Guard / Điều kiện |
| :--- | :--- | :--- | :--- |
| `/` | HomePage | Public / Customer (Nếu Admin/Manager chuyển hướng `/admin/overview`, Staff chuyển hướng `/staff`) | `src/routes/AppRoutes.jsx` |
| `/movies` | ExplorePage | Public | Không có guard |
| `/movies/:id` | MovieDetailPage | Public | Không có guard |
| `/showtimes` | ShowtimesPage | Public | Không có guard |
| `/movies/:id/book` | BookingPage | CUSTOMER | `src/routes/ProtectedRoute.jsx` |
| `/concessions` | ConcessionsPage | CUSTOMER | `src/routes/ProtectedRoute.jsx` |
| `/tickets` | MyOrdersPage | CUSTOMER | `src/routes/ProtectedRoute.jsx` |
| `/profile` | ProfilePage | CUSTOMER | `src/routes/ProtectedRoute.jsx` |
| `/staff` | StaffCheckInPage | STAFF | `src/routes/StaffRoute.jsx` |
| `/manager/*` | Redirect -> `/admin/*` | MANAGER | Bị Redirect cưỡng chế trong `AppRoutes.jsx` |
| `/admin/:section` | AdminDashboard (`AdminPage.jsx`) | **ADMIN và MANAGER** *(Lỗ hổng RBAC)* | `src/routes/AdminRoute.jsx` |

### Lỗ hổng chuyển tiếp và lọt quyền Route
- **MANAGER có thể truy cập trang của ADMIN**: Do `AdminRoute.jsx` kiểm tra:
  ```javascript
  const hasStoredAccess = hasBackendAdminAccess(accessToken, user) || hasBackendManagerAccess(accessToken, user);
  ```
  Điều này cho phép tài khoản Manager truy cập trực tiếp vào `/admin/movies`, `/admin/genres`, `/admin/actors`, `/admin/users`.
- **UI Guard thuần túy**: Nút menu "Hệ thống cụm rạp" chỉ được ẩn ở mức JSX (`{isAdmin && <NavItem ... tab="cinema" />}`). Nếu Manager gõ trực tiếp URL `/admin/cinema`, component `AdminCinemaPanel` vẫn được import và render, chỉ có các nút bấm bên trong được bảo vệ thêm một lớp.

---

## 7. NAVIGATION / SIDEBAR MATRIX

| Tính năng | ADMIN | MANAGER | STAFF | CUSTOMER | Đánh giá tính tương thích |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tổng quan (Overview)** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | Tương thích (Manager bị giới hạn hiển thị theo rạp) |
| **Hệ thống cụm rạp (Cinemas)** | VISIBLE | **HIDDEN** | HIDDEN | HIDDEN | **TƯƠNG THÍCH** (Đã ẩn đúng với Manager) |
| **Quản lý Manager** | VISIBLE | **HIDDEN** | HIDDEN | HIDDEN | **TƯƠNG THÍCH** (Nút cấp Manager chỉ hiện với Admin) |
| **Quản lý Staff** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | **TƯƠNG THÍCH** (Manager được cấp Staff cho rạp mình) |
| **Thư viện Phim (Movies)** | VISIBLE | **VISIBLE** | HIDDEN | VISIBLE (Browse) | **INCORRECT** (Manager KHÔNG ĐƯỢC PHÉP thấy nút sửa/tạo Phim) |
| **Thể loại phim (Genres)** | VISIBLE | **VISIBLE** | HIDDEN | HIDDEN | **INCORRECT** (Manager không được phép quản lý Thể loại) |
| **Diễn viên (Actors)** | VISIBLE | **VISIBLE** | HIDDEN | HIDDEN | **INCORRECT** (Manager không được phép quản lý Diễn viên) |
| **Đạo diễn (Directors)** | **NOT FOUND** | **NOT FOUND** | NOT FOUND | NOT FOUND | **CHƯA CÓ TRANG/MENU ĐẠO DIỄN RIÊNG BIỆT** |
| **Phòng chiếu (Rooms)** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | **TƯƠNG THÍCH** (Manager bị khóa dropdown rạp) |
| **Sơ đồ Ghế (Seats)** | VISIBLE | VISIBLE | HIDDEN | VISIBLE (Pick) | **TƯƠNG THÍCH** (Gắn liền với sơ đồ phòng) |
| **Suất chiếu (Showtimes)** | VISIBLE | VISIBLE | HIDDEN | VISIBLE (View) | **TƯƠNG THÍCH** (Manager bị khóa cụm rạp) |
| **Bảng giá vé (Pricing)** | **NOT FOUND** | **NOT FOUND** | HIDDEN | HIDDEN | **INCORRECT** (Panel tồn tại nhưng KHÔNG CÓ TRÊN MENU) |
| **Báo cáo doanh thu (Reports)** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | **INCORRECT** (Trang `statistics` không có bộ lọc rạp cho Manager) |
| **Cấu hình hệ thống (Settings)** | **NOT FOUND** | NOT FOUND | NOT FOUND | NOT FOUND | **CHƯA ĐƯỢC HIỆN THỰC (NOT IMPLEMENTED)** |
| **Soát vé QR (Check-in)** | HIDDEN | HIDDEN | VISIBLE | HIDDEN | **TƯƠNG THÍCH** |
| **Đặt vé & Ghế (Booking)** | HIDDEN | HIDDEN | HIDDEN | VISIBLE | **INCORRECT** (Customer chưa được chọn Cụm rạp) |
| **Thanh toán (Payments)** | VISIBLE | VISIBLE | HIDDEN | VISIBLE | **TƯƠNG THÍCH** |

---

## 8. ADMIN CURRENT FEATURES

| Tính năng Admin | Tệp giao diện (Page/Panel) | Tuyến đường (Route) | API sử dụng | Tương thích Backend? | Vấn đề tồn đọng |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Quản lý Cụm rạp** | `AdminCinemaPanel.jsx` | `/admin/cinema` | `/api/v1/admin/cinemas/**` | **TƯƠNG THÍCH** | Giao diện chuẩn, có CRUD và đổi trạng thái |
| **Quản lý Manager** | `AdminUsersPanel.jsx` | `/admin/users` | `POST /api/v1/admin/users/manager` | **TƯƠNG THÍCH** | Nút tạo Manager và phân rạp hoạt động tốt |
| **Quản lý Staff** | `AdminUsersPanel.jsx` | `/admin/users` | `POST /api/v1/admin/users/staff` | **TƯƠNG THÍCH** | Admin có thể chọn rạp bất kỳ cho Staff |
| **Quản lý Phim** | `AdminMoviesPanel.jsx` | `/admin/movies` | `/api/v1/admin/movies/**` | **MỘT PHẦN** | Đạo diễn vẫn nhập text string, chưa dùng thực thể Director |
| **Quản lý Thể loại** | `AdminGenresPanel.jsx` | `/admin/genres` | `/api/v1/genres`, `admin/genres/**` | **TƯƠNG THÍCH** | CRUD thể loại chuẩn |
| **Quản lý Diễn viên** | `AdminActorsPanel.jsx` | `/admin/actors` | `/api/v1/admin/actors/**` | **TƯƠNG THÍCH** | CRUD diễn viên chuẩn |
| **Quản lý Đạo diễn** | **NOT FOUND** | **NOT FOUND** | `/api/v1/admin/directors` | **KHÔNG** | Chưa xây dựng màn hình CRUD Đạo diễn |
| **Quản lý Phòng chiếu** | `AdminRoomsPanel.jsx` | `/admin/rooms` | `/api/v1/admin/rooms/**` | **TƯƠNG THÍCH** | Có dropdown lọc và chọn rạp cho Admin |
| **Quản lý Ghế** | `AdminRoomsPanel.jsx` | `/admin/rooms` | Lưu kèm layout phòng chiếu | **TƯƠNG THÍCH** | Chỉnh sửa ma trận ghế chuẩn |
| **Quản lý Suất chiếu** | `AdminShowtimesPanel.jsx` | `/admin/showtimes` | `/api/v1/admin/showtimes/**` | **TƯƠNG THÍCH** | Chọn rạp, chọn phòng, chọn phim toàn cục |
| **Quản lý Giá vé** | `AdminPricingPanel.jsx` | **CHƯA GẮN** | `/api/v1/admin/ticket-pricing/rules` | **KHÔNG** | Component chưa được render vào AdminPage |
| **Báo cáo Thống kê** | `AdminStatsPanel.jsx` | `/admin/statistics` | `/api/v1/admin/reports/**` | **TƯƠNG THÍCH** | Thống kê tổng hợp toàn hệ thống |
| **Cấu hình Hệ thống** | **NOT FOUND** | **NOT FOUND** | `/api/v1/admin/system-settings` | **KHÔNG** | Chưa có màn hình quản trị cấu hình hệ thống |

---

## 9. MANAGER CURRENT FEATURES

Theo mô hình nghiệp vụ chuẩn của Backend:
```
MANAGER
└── assigned Cinema
    ├── Staff
    ├── Room
    ├── Seat
    ├── Showtime
    ├── Pricing
    └── Reports
```
Manager **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP** chỉnh sửa: Phim, Thể loại, Diễn viên, Đạo diễn, Cụm rạp, Cấu hình hệ thống.

### Các vi phạm kiến trúc của Manager trên Frontend hiện tại:
1. **Manager truy cập form Tạo/Sửa Phim**:
   - **Tệp tin**: `src/pages/admin/catalog/AdminMoviesPanel.jsx`
   - **Nguyên nhân**: Bảng quản lý phim không kiểm tra quyền `isAdmin`. Nút "Thêm phim mới", "Chỉnh sửa", "Xóa phim" vẫn hiển thị đầy đủ cho Manager.
   - **Hậu quả**: Khi Manager bấm lưu, Backend ném lỗi **403 Forbidden** vì `AdminMovieController` yêu cầu `ROLE_ADMIN`. Khi gặp 403, `authService.js` cưỡng chế đăng xuất Manager.
2. **Manager truy cập form Thể loại & Diễn viên**:
   - **Tệp tin**: `src/pages/admin/catalog/AdminGenresPanel.jsx` và `AdminActorsPanel.jsx`
   - **Nguyên nhân**: Không kiểm tra vai trò `isAdmin`, Manager có thể mở modal tạo/sửa thể loại và diễn viên.
   - **Hậu quả**: Backend trả về **403 Forbidden**.
3. **Manager xem Báo cáo toàn hệ thống mà không có phạm vi cụ thể**:
   - **Tệp tin**: `src/pages/admin/overview/AdminStatsPanel.jsx` (Mục Thống kê mua bán `/admin/statistics`)
   - **Nguyên nhân**: Không truyền tham số `cinemaId` của Manager vào các API thống kê. Manager xem được doanh thu toàn bộ hệ thống.
4. **Trang Quản lý Manager riêng biệt bị bỏ hoang**:
   - Thư mục `src/pages/manager/` có đầy đủ 10 trang riêng biệt và `ManagerLayout.jsx`, nhưng `AppRoutes.jsx` lại redirect toàn bộ về `/admin/*`.

---

## 10. STAFF CURRENT FEATURES

Theo mô hình Backend:
```
STAFF
└── assigned Cinema
    └── Ticket Check-in
```

### Kết quả kiểm tra giao diện Staff (`src/pages/staff/StaffCheckInPage.jsx`):
- **Quét mã QR**: ĐÃ HỖ TRỢ. Tích hợp thư viện `jsqr` quét trực tiếp từ webcam/camera.
- **Nhập mã thủ công**: ĐÃ HỖ TRỢ. Cho phép nhập mã đặt chỗ (bookingCode) hoặc chuỗi QR dạng `CINEAI:...`.
- **Tra cứu thông tin vé/đơn hàng**: ĐÃ HỖ TRỢ. Gọi API `/api/v1/staff/check-in/lookup`.
- **Soát vé toàn bộ đơn (Full booking check-in)**: ĐÃ HỖ TRỢ. Nút soát vé toàn bộ gọi `POST /api/v1/staff/check-in`.
- **Soát vé từng ghế (Partial seat check-in)**: ĐÃ HỖ TRỢ. Có danh sách checkbox chọn từng mã vé (`ticketCodes`) và nút gọi `POST /api/v1/staff/check-in/seats`.
- **Hiển thị trạng thái vé & cảnh báo**:
  - Đã check-in: Hiển thị badge màu ngọc lục bảo `CHECKED_IN`.
  - Quá giờ chiếu: Cảnh báo suất chiếu đã kết thúc, không cho phép check-in.
  - Ngoài khung giờ: Cảnh báo chỉ mở check-in trước giờ chiếu 30 phút.
- **Giao bắp nước (Food Pickup)**: ĐÃ HỖ TRỢ. Tra cứu và nút "Xác nhận giao món" gọi `POST /api/v1/staff/check-in/food-orders/pickup`.
- **Lưu ý**: Staff không có quyền tự chọn cụm rạp; cụm rạp được tự động gán theo tài khoản Staff ở Backend.

---

## 11. CUSTOMER FEATURE AUDIT

### Kết quả kiểm tra luồng Khách hàng:
1. **Trang chủ & Khám phá**: `HomePage.jsx`, `ExplorePage.jsx`. Người dùng tìm kiếm phim theo tên, thể loại, trạng thái đang chiếu / sắp chiếu.
2. **Chi tiết phim (`MovieDetailPage.jsx`)**: Xem trailer, diễn viên, đạo diễn, mô tả, đánh giá sao.
3. **Xem lịch chiếu (`ShowtimesPage.jsx`)**: Cho phép chọn ngày chiếu trong vòng 7 ngày, lọc theo độ tuổi, nhưng **HOÀN TOÀN THIẾU BỘ LỌC CỤM RẠP**. Suất chiếu của các cụm rạp khác nhau bị gộp chung.
4. **Quy trình Đặt vé (`BookingPage.jsx`)**:
   - Chọn ngày & suất chiếu.
   - Chọn ghế ngồi (Standard, VIP, Couple).
   - Chọn combo bắp nước.
   - Giữ chỗ (Hold seats) và đếm ngược thời gian.
   - Thanh toán qua VNPay hoặc CineWallet.
5. **Vé của tôi (`MyOrdersPage.jsx`, `MyTicketsPage.jsx`)**: Hiển thị danh sách vé đã mua, mã QR SVG để đưa cho nhân viên rạp quét, trạng thái từng ghế.

---

## 12. CINEMA / BRANCH SCOPE AUDIT

### Cơ chế Quản lý Cụm rạp trong Frontend
- **ADMIN**:
  - Tại `AdminOverviewPanel.jsx`: Có dropdown `<select>` cho phép chọn "Toàn bộ hệ thống (Tất cả rạp)" hoặc một rạp cụ thể.
  - Tại `AdminRoomsPanel.jsx`: Có dropdown chọn rạp để xem danh sách phòng, và khi tạo phòng mới có thể gán cho bất kỳ rạp nào.
  - Tại `AdminShowtimesPanel.jsx`: Có dropdown chọn rạp để điều phối lịch chiếu.
  - Tại `AdminUsersPanel.jsx`: Có chức năng chuyển đổi rạp phân công cho Manager / Staff (`assignAdminUserCinema`).
- **MANAGER**:
  - Tại `AdminRoomsPanel.jsx`: Biến `managerCinemaId` được trích xuất từ `currentUser.cinemaId`. Dropdown chọn rạp bị disable (`disabled={!isEffectiveAdmin}`). Manager không thể đổi rạp của phòng chiếu.
  - Tại `AdminShowtimesPanel.jsx`: Dropdown chọn rạp bị thay bằng Badge cố định tên rạp của Manager.
  - **LỖ HỔNG TRONG `ManagerCinemaContext.jsx`**: File này cho phép Manager tự do chọn rạp thông qua `localStorage.setItem('manager_selected_cinema_id')` nếu như API trả về nhiều hơn một rạp.
- **CUSTOMER**:
  - **CHƯA HỖ TRỢ CHỌN RẠP**: Customer không có dropdown chọn rạp ở Navbar hay trang Booking. `useMovieStore.js` lưu singleton `publicCinema`. Đây là điểm không tương thích lớn nhất với Backend multi-branch.

---

## 13. MOVIE / GENRE / ACTOR / DIRECTOR AUDIT

### 1. Phim (Movie)
- **Tính toàn cục**: Phim trong Frontend được định nghĩa không gắn với `cinemaId`. Hàm `buildDefaultMovieForm()` không có trường `cinemaId`. Điều này hoàn toàn phù hợp với Backend: **Movie là Master Data toàn cầu**.
- **Lỗi phân quyền**: Manager đang có quyền xem form tạo/sửa phim tại `AdminMoviesPanel.jsx`.

### 2. Thể loại (Genre) & Diễn viên (Actor)
- Thể loại và Diễn viên là Master Data toàn cục.
- Các API client `genresApi` và `actorsApi` trong `adminService.js` hoạt động chính xác.
- Lỗi phân quyền: Manager vẫn nhìn thấy nút thêm/sửa/xóa thể loại và diễn viên.

### 3. Đạo diễn (Director)
- **Hiện trạng Frontend**:
  - Trong `movieService.js`: `director: movie.director || movie.directorName || fallback.director || 'Dang cap nhat'`.
  - Trong form tạo phim `AdminMoviesPanel.jsx`: `formData.director` là một chuỗi văn bản thuần (String). Người dùng chọn tên đạo diễn hoặc gõ text, lưu dưới dạng chuỗi phân cách bởi dấu phẩy.
  - **KHÔNG CÓ** màn hình quản trị Đạo diễn (`/admin/directors`).
  - **KHÔNG CÓ** hàm gọi API `/api/v1/directors` hay `/api/v1/admin/directors` trong `adminService.js`.

---

## 14. CINEMA / ROOM / SEAT AUDIT

1. **Quản lý Cụm rạp (`AdminCinemaPanel.jsx`)**:
   - Được phân quyền chặt chẽ: chỉ Admin mới nhìn thấy và thao tác CRUD rạp.
   - Các trường dữ liệu: `name`, `city`, `address`, `hotline`, `status`.
2. **Quản lý Phòng chiếu (`AdminRoomsPanel.jsx`)**:
   - Admin có thể tạo phòng ở bất kỳ rạp nào.
   - Manager bị khóa cứng cụm rạp theo `currentUser.cinemaId`.
   - Các trường dữ liệu: `name`, `roomType` (STANDARD, IMAX, 4DX), `floor`, `cinemaId`.
3. **Quản lý Sơ đồ Ghế**:
   - Được tích hợp trực tiếp trong `AdminRoomsPanel.jsx`.
   - Hỗ trợ công cụ vẽ ghế (Brush): Ghế Thường (STD), Ghế VIP, Ghế Đôi (Couple), Lối đi (Aisle).
   - Kiểm tra tính hợp lệ của sơ đồ ghế trước khi lưu.

---

## 15. SHOWTIME MANAGEMENT

- **Tệp giao diện**: `src/pages/admin/cinema/AdminShowtimesPanel.jsx`
- **Đầu vào của form**:
  - Phim (`movieId`): Chọn từ danh sách phim toàn cục (`moviesList`).
  - Cụm rạp (`cinemaId`): Admin được chọn rạp bất kỳ; Manager bị khóa chặt theo rạp được phân công.
  - Phòng chiếu (`roomId`): Tải danh sách phòng thuộc cụm rạp đã chọn.
  - Ngày chiếu (`date`): Chọn qua DatePicker.
  - Giờ bắt đầu / kết thúc (`startTime`, `endTime`).
- **Đánh giá tương thích**: Luồng tạo suất chiếu của Manager tương thích tốt với Backend vì đã chặn việc chọn phòng ngoài cụm rạp.

---

## 16. PRICING AUDIT

Backend hiện hỗ trợ 2 cấp độ quy tắc giá vé:
- **Quy tắc Toàn cục (Global Rule)**: `cinemaId == null` (Áp dụng cho toàn hệ thống, chỉ Admin quản lý).
- **Quy tắc Cụm rạp (Branch Rule)**: `cinemaId != null` (Áp dụng riêng cho từng rạp, Manager quản lý rạp của mình).

### Hiện trạng trên Frontend:
- **Tệp giao diện**: `src/pages/admin/cinema/AdminPricingPanel.jsx`
- **Trạng thái**: **CHƯA ĐƯỢC GẮN (UNMOUNTED)**. Tệp tin tồn tại nhưng không được import vào `AdminPage.jsx` và không có mục nào trên thanh menu điều hướng.
- **Tính năng bên trong component**:
  - Có CRUD quy tắc giá vé theo loại ghế (STANDARD, VIP, COUPLE), ngày trong tuần (WEEKDAY, WEEKEND), khung giờ (EARLY, STANDARD, LATE).
  - Có trường `cinemaId` trong form.
  - **CHƯA PHÂN BIỆT RÕ RÀNG** giữa quy tắc Global (`cinemaId == null`) và quy tắc Branch.
  - Chưa có phân quyền: Manager nếu vào được sẽ thấy và sửa được cả quy tắc Global (vi phạm quyền Backend).

---

## 17. SYSTEM SETTINGS

- **Endpoint Backend**: `/api/v1/admin/system-settings` (ADMIN only).
- **Hiện trạng Frontend**:
  - **NOT IMPLEMENTED** (Chưa được hiện thực).
  - Không có file giao diện cài đặt hệ thống.
  - Không có service method nào trong `adminService.js`.
  - Không có mục menu "Cấu hình hệ thống" trên Sidebar.

---

## 18. PROMOTION LEGACY AUDIT

- **Chủ trương Backend**: Backend **KHÔNG HIỆN THỰC** module Khuyến mãi / Khuyến mại (Promotion).
- **Hiện trạng Frontend**:
  - Tồn tại file `src/pages/admin/promotions/AdminPromotionsPanel.jsx`.
  - File này cố gắng gọi các hàm: `adminService.getAdminPromotions`, `getAdminPromotionStats`, `deleteAdminPromotion`.
  - Tuy nhiên, trong `adminService.js` **không hề tồn tại** các hàm này.
  - File `AdminPromotionsPanel.jsx` **không được import** ở bất kỳ đâu trong hệ thống.
- **Kết luận**: Đây là **MÃ CHẾT / LEGACY / BACKEND NOT SUPPORTED**. Không gây lỗi khi chạy do không được mount, nhưng cần dọn dẹp khi refactor.

---

## 19. REPORTS AUDIT

- **Các trang báo cáo**:
  1. `AdminOverviewPanel.jsx`: Báo cáo tổng quan KPI (Doanh thu, vé bán, tỷ lệ lấp đầy). Đã hỗ trợ phân quyền: Admin xem được toàn bộ hoặc lọc theo rạp; Manager bị cố định xem theo rạp của mình.
  2. `AdminStatsPanel.jsx`: Báo cáo biểu đồ chi tiết mua bán, giờ cao điểm, ghế bán chạy. **Chưa hỗ trợ tham số `cinemaId`**, Manager xem bị lộ số liệu toàn hệ thống.
  3. `AdminFnbReportPanel.jsx`: Báo cáo doanh thu bắp nước.
  4. `ManagerReportsPage.jsx`: Trang báo cáo riêng cho Manager, gọi `/api/v1/manager/cinemas/{id}/reports/overview` nhưng trang này đang bị redirect bỏ hoang.

---

## 20. BOOKING FLOW

Quy trình đặt vé của Khách hàng hiện tại:
```
Trang Chi tiết Phim (MovieDetailPage)
       │
       ▼ Nhấn "Đặt vé ngay"
Trang Đặt vé (BookingPage)
       ├── Bước 1: Chọn ngày & Chọn suất chiếu (Showtime)
       ├── Bước 2: Chọn ghế trên ma trận phòng chiếu (Seats)
       ├── Bước 3: Giữ chỗ tạm thời (Hold Seats API) ──> Đếm ngược 3 phút
       ├── Bước 4: Chọn bắp nước kèm theo (Concessions/Combos)
       └── Bước 5: Xác nhận thông tin đơn hàng & Nhận báo giá (Checkout Quote API)
```

- **Nhược điểm lớn nhất**: Thiếu bước **CHỌN CỤM RẠP (Select Cinema)**. Luồng hiện tại giả định phim chỉ chiếu ở 1 rạp duy nhất hoặc tải toàn bộ suất chiếu của tất cả các rạp mà không nhóm theo rạp.

---

## 21. SEAT HOLD BEHAVIOR

- **Backend**: Cấu hình thời gian giữ ghế là **3 phút** (`app.booking.hold-duration-minutes=3`).
- **Frontend (`src/pages/user/BookingPage.jsx`)**:
  - Tại dòng 25: `const HOLD_DURATION_SECONDS = 10 * 60;` (Đang hardcode 10 phút làm giá trị mặc định!).
  - Khi API giữ ghế trả về `holdExpiresAt` từ Backend, Frontend tính thời gian còn lại:
    ```javascript
    const secondsRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
    ```
  - Nếu Backend trả về `holdExpiresAt` chính xác, đồng hồ sẽ chạy từ 3:00 phút. Tuy nhiên nếu fallback xảy ra, giao diện hiển thị sai lệch thành 10:00 phút.
  - Khi hết giờ: Tự động hủy ghế, hiển thị thông báo "Hết thời gian giữ ghế" và làm mới lại sơ đồ ghế.
  - Xử lý lỗi 409 (Conflict): Đã bắt lỗi khi ghế đã bị người khác chọn.

---

## 22. PAYMENT FLOW

Luồng thanh toán hiện tại:
1. **Khởi tạo đơn hàng**: Gọi `POST /api/v1/bookings` tạo booking ở trạng thái `PENDING`.
2. **Tạo giao dịch thanh toán**:
   - **VNPay**: Gọi `paymentService.createVnpayPaymentUrl` (`POST /api/v1/payments/vnpay/create?bookingId=...`). Nhận `paymentUrl` và chuyển hướng trình duyệt sang cổng thanh toán VNPay Sandbox.
   - **CineWallet**: Gọi API trừ tiền ví nội bộ nếu số dư khả dụng đủ thanh toán.
3. **Phản hồi thanh toán**:
   - VNPay redirect về `PaymentCallbackPage.jsx` (`/payment-callback`).
   - Frontend đọc các query param: `vnp_ResponseCode`, `vnp_TxnRef`, kiểm tra kết quả giao dịch và hiển thị màn hình thành công hoặc thất bại.
   - Sau khi thành công, chuyển hướng người dùng về trang xem vé `/tickets`.

---

## 23. TICKET / QR / CHECK-IN FLOW

- **Hiển thị mã QR Khách hàng (`MyOrdersPage.jsx`)**:
  - Render mã QR bằng `QRCodeSVG` với nội dung: `booking.qrCode` (chuỗi định dạng `CINEAI:BOOKING:<id>:<uuid>`).
  - Hiển thị danh sách vé từng ghế, mã vé (`ticketCode`), tên phim, phòng, giờ chiếu, định dạng chiếu.
- **Quy trình Quét & Soát vé của Staff (`StaffCheckInPage.jsx`)**:
  - Staff dùng camera quét mã QR của khách hàng.
  - Frontend giải mã chuỗi qua `jsQR`, tự động gọi `staffService.lookupStaffCheckInBooking`.
  - Hiển thị đầy đủ thông tin đơn hàng, danh sách ghế và trạng thái check-in của từng ghế.
  - Staff có thể nhấn "Check-in toàn bộ" hoặc tích chọn từng ghế để check-in từng phần cho khách đến muộn.

---

## 24. API CLIENT INVENTORY

| Tên Hàm Frontend | Phương thức | Endpoint Đường dẫn | File Khai báo | Trang Sử dụng | Vai trò Dự kiến | Mức độ Tương thích Backend |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: |
| `login` | POST | `/api/v1/auth/login` | `authService.js` | `AuthModal.jsx` | Public | TƯƠNG THÍCH |
| `refreshToken` | POST | `/api/v1/auth/refresh` | `authService.js` | Interceptor | Authenticated | TƯƠNG THÍCH |
| `getAdminMovies` | GET | `/api/v1/admin/movies` | `adminService.js` | `AdminMoviesPanel.jsx` | ADMIN | TƯƠNG THÍCH |
| `createAdminMovie` | POST | `/api/v1/admin/movies` | `adminService.js` | `AdminMoviesPanel.jsx` | **ADMIN ONLY** | **XUNG ĐỘT (Manager truy cập sẽ bị 403)** |
| `updateAdminMovie` | PUT | `/api/v1/admin/movies/{id}`| `adminService.js` | `AdminMoviesPanel.jsx` | **ADMIN ONLY** | **XUNG ĐỘT (Manager truy cập sẽ bị 403)** |
| `deleteAdminMovie` | DELETE | `/api/v1/admin/movies/{id}`| `adminService.js` | `AdminMoviesPanel.jsx` | **ADMIN ONLY** | **XUNG ĐỘT (Manager truy cập sẽ bị 403)** |
| `getAdminGenres` | GET | `/api/v1/genres` | `adminService.js` | `AdminGenresPanel.jsx` | Public/Admin | TƯƠNG THÍCH |
| `createAdminGenre` | POST | `/api/v1/admin/genres` | `adminService.js` | `AdminGenresPanel.jsx` | **ADMIN ONLY** | **XUNG ĐỘT (Manager truy cập sẽ bị 403)** |
| `getAdminActors` | GET | `/api/v1/admin/actors` | `adminService.js` | `AdminActorsPanel.jsx` | ADMIN | TƯƠNG THÍCH |
| `createAdminActor` | POST | `/api/v1/admin/actors` | `adminService.js` | `AdminActorsPanel.jsx` | **ADMIN ONLY** | **XUNG ĐỘT (Manager truy cập sẽ bị 403)** |
| **Director APIs** | CRUD | `/api/v1/admin/directors` | **CHƯA CÓ** | **CHƯA CÓ** | ADMIN | **CHƯA ĐƯỢC HIỆN THỰC** |
| `getAdminCinemas` | GET | `/api/v1/admin/cinemas` | `adminService.js` | Nhiều panel | ADMIN | TƯƠNG THÍCH |
| `createAdminCinema`| POST | `/api/v1/admin/cinemas` | `adminService.js` | `AdminCinemaPanel.jsx`| ADMIN ONLY | TƯƠNG THÍCH |
| `getAdminRooms` | GET | `/api/v1/admin/rooms` | `adminService.js` | `AdminRoomsPanel.jsx` | ADMIN, MANAGER | TƯƠNG THÍCH |
| `createAdminRoom` | POST | `/api/v1/admin/rooms` | `adminService.js` | `AdminRoomsPanel.jsx` | ADMIN, MANAGER | TƯƠNG THÍCH |
| `getAdminShowtimes`| GET | `/api/v1/admin/showtimes` | `adminService.js` | `AdminShowtimesPanel` | ADMIN, MANAGER | TƯƠNG THÍCH |
| `createAdminShowtime`| POST| `/api/v1/admin/showtimes` | `adminService.js` | `AdminShowtimesPanel` | ADMIN, MANAGER | TƯƠNG THÍCH |
| `getAdminPricingRules`| GET | `/api/v1/admin/ticket-pricing/rules` | `adminService.js` | `AdminPricingPanel` (Unmounted) | ADMIN, MANAGER | TƯƠNG THÍCH |
| **System Settings**| CRUD | `/api/v1/admin/system-settings` | **CHƯA CÓ** | **CHƯA CÓ** | ADMIN ONLY | **CHƯA ĐƯỢC HIỆN THỰC** |
| `holdSeats` | POST | `/api/v1/bookings/hold` | `bookingService.js` | `BookingPage.jsx` | CUSTOMER | TƯƠNG THÍCH |
| `getCheckoutQuote` | POST | `/api/v1/catalog/checkout-quote` | `bookingService.js` | `BookingPage.jsx` | CUSTOMER | TƯƠNG THÍCH |
| `createVnpayPaymentUrl`| POST| `/api/v1/payments/vnpay/create` | `paymentService.js` | `BookingPage.jsx` | CUSTOMER | TƯƠNG THÍCH |
| `lookupStaffCheckIn`| GET | `/api/v1/staff/check-in/lookup` | `staffService.js` | `StaffCheckInPage.jsx`| STAFF | TƯƠNG THÍCH |
| `checkInStaffSeats`| POST | `/api/v1/staff/check-in/seats` | `staffService.js` | `StaffCheckInPage.jsx`| STAFF | TƯƠNG THÍCH |

---

## 25. FRONTEND TYPE / DTO COMPATIBILITY

| Kiểu dữ liệu Frontend | Các trường hiện có | Khái niệm Backend tương ứng | Tương thích? | Yêu cầu thay đổi trong tương lai |
| :--- | :--- | :--- | :---: | :--- |
| **User / CurrentUser** | `id`, `email`, `fullName`, `roles`, `cinemaId`, `avatarUrl` | `UserResponse` (identity-service) | **CÓ** | Đồng bộ chặt chẽ `cinemaId` để khóa phạm vi cho Manager/Staff |
| **Movie** | `id`, `title`, `duration`, `genreIds`, `director` (string), `actorIds` | `MovieResponse` (catalog-service) | **MỘT PHẦN** | Chuyển trường `director` từ string sang danh sách thực thể `directors` |
| **Director** | *Chưa có interface / DTO riêng* | `DirectorResponse` (catalog-service) | **KHÔNG** | Tạo mới DTO Director: `id`, `name`, `biography`, `avatarUrl` |
| **Cinema** | `id`, `name`, `city`, `address`, `hotline`, `status` | `CinemaResponse` (catalog-service) | **CÓ** | Hoàn toàn tương thích |
| **Room** | `id`, `name`, `roomType`, `cinemaId`, `floor`, `seatRows` | `RoomResponse` (catalog-service) | **CÓ** | Hoàn toàn tương thích |
| **Seat** | `id`, `rowLabel`, `seatNumber`, `seatType`, `status` | `SeatResponse` (catalog-service) | **CÓ** | Hoàn toàn tương thích |
| **Showtime** | `id`, `movieId`, `roomId`, `startTime`, `endTime`, `cinemaId` | `ShowtimeResponse` (catalog-service) | **CÓ** | Hoàn toàn tương thích |
| **TicketPricingRule**| `id`, `cinemaId`, `seatType`, `dayOfWeek`, `timeSlot`, `price` | `TicketPricingRuleResponse` | **MỘT PHẦN** | Bổ sung phân biệt rõ quy tắc Global (`cinemaId == null`) |
| **Booking** | `id`, `bookingCode`, `status`, `totalAmount`, `seats`, `qrCode` | `BookingResponse` (booking-service) | **CÓ** | Hoàn toàn tương thích |
| **BookingSeat** | `ticketCode`, `seatId`, `ticketType`, `price`, `status` | `BookingSeatResponse` (booking-service) | **CÓ** | Hoàn toàn tương thích |
| **SystemSetting** | *Chưa có DTO* | `SystemSettingResponse` (catalog-service) | **KHÔNG** | Cần định nghĩa DTO cấu hình hệ thống |

---

## 26. ERROR HANDLING

### Đánh giá các mã lỗi HTTP trong Frontend:
1. **Mã lỗi 401 (Unauthorized)**: Xử lý chuẩn. Kích hoạt `tryRefreshToken()`; nếu thất bại chuyển hướng đăng nhập.
2. **Mã lỗi 403 (Forbidden) - LỖI KIẾN TRÚC NGHIÊM TRỌNG**:
   - **Vị trí**: `src/services/authService.js` dòng 227:
     ```javascript
     if (!(hadToken && (status === 401 || status === 403))) {
       throw normalizeAxiosError(requestError);
     }
     ```
   - **Vấn đề**: Gộp mã lỗi 403 chung với 401. Khi Manager bị Backend từ chối quyền (ví dụ cố sửa phim), Frontend coi đây là lỗi hết hạn token và đăng xuất người dùng!
   - **Hành vi đúng cần có**: Bắt riêng lỗi 403, giữ nguyên phiên đăng nhập và hiển thị thông báo "Bạn không có quyền thực hiện thao tác này".
3. **Mã lỗi 409 (Conflict - Xung đột ghế)**: Đã được bắt trong `BookingPage.jsx`. Hiển thị thông báo "Ghế vừa được người khác giữ" và tự động tải lại sơ đồ ghế.
4. **Mã lỗi 400 & 404**: Được trích xuất message từ response Backend và hiển thị qua Sonner Toast (`showToast(error.message)`).

---

## 27. FRONTEND SECURITY FINDINGS

1. **Không gọi Endpoint Nội bộ**: Frontend hoàn toàn KHÔNG gọi bất kỳ endpoint `/internal/**` nào.
2. **Không lộ Secret Nội bộ**: Frontend KHÔNG chứa header `X-Internal-Service-Secret`.
3. **Lưu trữ Token trong LocalStorage**: Cả Access Token và Refresh Token đều lưu trong `localStorage`. Điều này dễ bị tấn công XSS nếu có lỗ hổng chèn script. Tuy nhiên đây là kiến trúc client-side SPA hiện hành phổ biến.
4. **Không tin tưởng vai trò từ Client**: Backend Spring Security độc lập xác thực JWT token và phân quyền chặt chẽ bằng `@PreAuthorize`, ngăn chặn việc giả mạo vai trò từ phía client.

---

## 28. HARD-CODED / DUPLICATED CONFIGURATION

1. **Thời gian giữ ghế**: Hardcode `HOLD_DURATION_SECONDS = 10 * 60` trong `src/pages/user/BookingPage.jsx` dòng 25, trong khi cấu hình thực tế của Backend là 3 phút.
2. **Thời gian mở check-in**: Hardcode `CHECK_IN_LEAD_MINUTES = 30` trong `src/pages/staff/StaffCheckInPage.jsx` dòng 27.
3. **Base URL Gateway**: Cấu hình mặc định `http://localhost:8080` trong `.env` và `src/configs/constants.js`.
4. **Màu sắc và cấu hình loại ghế**: Lặp lại cấu hình `SEAT_TYPE_CONFIG` ở nhiều file (`AdminPricingPanel.jsx`, `AdminRoomsPanel.jsx`, `BookingPage.jsx`).

---

## 29. LEGACY / DEAD CODE CANDIDATES

| Tệp / Thư mục | Trạng thái | Lý do / Đánh giá | Hướng xử lý sau này |
| :--- | :---: | :--- | :--- |
| `src/pages/admin/promotions/AdminPromotionsPanel.jsx` | **DEAD CODE** | Backend không hỗ trợ Promotion, file không được mount vào đâu | **REMOVE LATER** |
| `src/pages/manager/*` (10 trang riêng biệt) | **UNUSED** | `AppRoutes.jsx` redirect toàn bộ sang `/admin/*` | **MODIFY / REACTIVATE** |
| `src/components/manager/ManagerSidebar.jsx` | **UNUSED** | Không được render do ManagerLayout bị bỏ qua | **MODIFY / REACTIVATE** |
| `src/context/ManagerCinemaContext.jsx` | **LEGACY LOGIC** | Chứa logic cho Manager tự chọn rạp thủ công | **MODIFY** |
| `src/pages/admin/cinema/AdminPricingPanel.jsx` | **UNMOUNTED** | Chưa được gắn vào AdminPage | **MODIFY & MOUNT** |

---

## 30. REQUIRED FUTURE CHANGES BY PRIORITY

### Ưu tiên P0 (Bảo mật, Phân quyền & Lỗi nghiêm trọng)
1. **Tách biệt xử lý 403 Forbidden khỏi 401 Unauthorized** trong `src/services/authService.js`. Không gọi refresh token hoặc logout khi nhận 403.
2. **Chặn Manager truy cập các nút Tạo/Sửa/Xóa Phim, Thể loại, Diễn viên** trong `AdminMoviesPanel.jsx`, `AdminGenresPanel.jsx`, `AdminActorsPanel.jsx`.
3. **Phân tách Route Quản trị**: Kích hoạt lại `/manager/*` sử dụng `ManagerLayout` và `ManagerSidebar` riêng biệt, loại bỏ quyền truy cập của Manager vào `/admin/*`.

### Ưu tiên P1 (Không tương thích API & Tính năng gãy)
1. **Bổ sung bước chọn Cụm rạp (Cinema Selection) cho Khách hàng**: Cho phép khách hàng chọn cụm rạp ở Header/Showtimes trước khi đặt vé.
2. **Chuẩn hóa thực thể Đạo diễn (Director)**: Tạo CRUD Quản lý Đạo diễn (`/admin/directors`) và cập nhật form Phim gọi `GET /api/v1/directors` thay vì nhập text string.
3. **Gắn và hoàn thiện Quản lý Giá vé (`AdminPricingPanel.jsx`)**: Đưa vào menu điều hướng, phân định rõ Global Rule (Admin) và Branch Rule (Manager).

### Ưu tiên P2 (Trải nghiệm Vai trò & Điều hướng)
1. **Khóa chặt phạm vi cụm rạp của Manager**: Loại bỏ dropdown chọn rạp tùy ý trong `ManagerCinemaContext.jsx`, tự động nhận `cinemaId` từ tài khoản đăng nhập.
2. **Bộ lọc Cụm rạp trong Thống kê (`AdminStatsPanel.jsx`)**: Bổ sung tham số `cinemaId` cho tài khoản Manager.
3. **Điều chỉnh đồng hồ đếm ngược giữ ghế**: Đồng bộ giá trị hiển thị mặc định thành 3 phút khớp với cấu hình Backend.

### Ưu tiên P3 (Dọn dẹp Mã nguồn & Master Data)
1. **Xóa bỏ panel Khuyến mãi rác (`AdminPromotionsPanel.jsx`)**.
2. **Hiện thực màn hình Cấu hình Hệ thống (`/admin/settings`)** kết nối với `/api/v1/admin/system-settings`.

---

## 31. ANSWERS Q1-Q30

- **Q1. What frontend framework/stack is currently used?**  
  React 19.0.1 (JavaScript/JSX), Vite 6.2.3, Tailwind CSS v4.1.14, Zustand 5.0.14, React Router DOM 7.16.0, Axios 1.18.0.
- **Q2. How are ADMIN, MANAGER, STAFF and CUSTOMER detected?**  
  Được giải mã từ JWT token (`parseJwtPayload`) và đọc từ `localStorage` (`cinepremier_auth_user.roles`). Kiểm tra chuỗi chứa `ADMIN`, `MANAGER`, `STAFF` hoặc tiền tố `ROLE_`.
- **Q3. Is cinemaId available in frontend current-user state?**  
  CÓ. `cinemaId` có sẵn trong `currentUser.cinemaId` (thuộc `useAuthStore`).
- **Q4. Can Manager currently select arbitrary Cinema?**  
  TRONG `ManagerCinemaContext.jsx`: CÓ (cho phép chọn qua `localStorage`). TRONG `AdminRoomsPanel` và `AdminShowtimesPanel`: KHÔNG (đã bị disable/khóa vào rạp được phân công).
- **Q5. Can Staff currently select arbitrary Cinema?**  
  KHÔNG. Giao diện Staff không có bộ chọn rạp; Backend tự động ép quyền theo tài khoản.
- **Q6. Can Manager currently access Movie CRUD UI?**  
  CÓ. Manager truy cập được `/admin/movies` và thấy toàn bộ nút tạo/sửa/xóa phim (khi bấm lưu sẽ bị Backend trả về 403).
- **Q7. Can Manager currently access Genre CRUD UI?**  
  CÓ. Manager truy cập được `/admin/genres` và mở được modal tạo/sửa thể loại.
- **Q8. Can Manager currently access Actor CRUD UI?**  
  CÓ. Manager truy cập được `/admin/actors` và mở được modal tạo/sửa diễn viên.
- **Q9. Does Director management UI exist?**  
  KHÔNG. Chưa có bất kỳ giao diện CRUD nào cho Đạo diễn.
- **Q10. Does frontend currently treat Director as plain text?**  
  CÓ. Đạo diễn hiện được xử lý dưới dạng plain text string trong DTO phim và form nhập liệu.
- **Q11. Does Cinema CRUD exist?**  
  CÓ. Nằm trong `AdminCinemaPanel.jsx` (`/admin/cinema`).
- **Q12. Does Manager currently have Cinema CRUD controls?**  
  KHÔNG. Mục menu và panel này đã được ẩn chính xác đối với Manager (`isAdmin` guard).
- **Q13. Does Manager Staff management exist?**  
  CÓ. Nằm trong tab `staff` của `AdminUsersPanel.jsx`. Manager có thể tạo tài khoản Staff và tự động gắn vào rạp của Manager.
- **Q14. Does Room management exist?**  
  CÓ. Nằm trong `AdminRoomsPanel.jsx`.
- **Q15. Does Seat management exist?**  
  CÓ. Tích hợp trực tiếp bên trong `AdminRoomsPanel.jsx` với công cụ vẽ ma trận ghế.
- **Q16. Does Showtime management exist?**  
  CÓ. Nằm trong `AdminShowtimesPanel.jsx`.
- **Q17. Does Manager pricing management exist?**  
  MỘT PHẦN / CHƯA HOÀN THIỆN. File `AdminPricingPanel.jsx` tồn tại nhưng chưa được gắn vào giao diện điều hướng.
- **Q18. Does pricing UI distinguish global vs branch pricing?**  
  KHÔNG. Giao diện giá vé chưa có cơ chế hiển thị phân biệt giữa quy tắc Global (`cinemaId == null`) và quy tắc Branch.
- **Q19. Does System Settings UI exist?**  
  NOT IMPLEMENTED. Chưa có giao diện cho Cấu hình hệ thống.
- **Q20. Does Promotion UI exist even though backend no longer supports Promotion?**  
  CÓ (dưới dạng mã chết). Tồn tại file `AdminPromotionsPanel.jsx` nhưng không được mount vào đâu.
- **Q21. Does branch-scoped Report UI exist?**  
  CÓ trong `AdminOverviewPanel.jsx` (Manager xem theo rạp của mình), nhưng KHÔNG CÓ trong `AdminStatsPanel.jsx` (xem lộ số liệu toàn hệ thống).
- **Q22. Can Manager select "All Cinemas" in reports?**  
  KHÔNG trong `AdminOverviewPanel` (tùy chọn "All Cinemas" chỉ hiện với Admin).
- **Q23. Does Staff QR check-in UI exist?**  
  CÓ. Hoạt động hoàn chỉnh với webcam và quét camera tại `StaffCheckInPage.jsx`.
- **Q24. Does partial seat check-in UI exist?**  
  CÓ. Cho phép tích chọn từng ghế và gửi danh sách `ticketCodes` tại `StaffCheckInPage.jsx`.
- **Q25. Does Customer booking flow work as Movie -> Cinema -> Showtime -> Seat?**  
  KHÔNG HOÀN TOÀN. Hiện tại hoạt động theo kiểu `Movie -> Date -> Showtime (Tất cả rạp) -> Seat`. BƯỚC CHỌN RẠP ĐANG BỊ THIẾU.
- **Q26. Is 3-minute hold countdown supported?**  
  CÓ tính toán động theo `holdExpiresAt` từ Backend, nhưng biến fallback và nhãn giao diện đang bị hardcode sai thành 10 phút.
- **Q27. Are 403 responses handled properly?**  
  KHÔNG. Lỗi 403 đang bị xử lý nhầm thành 401 và cưỡng chế đăng xuất người dùng.
- **Q28. Are internal service endpoints ever called directly from frontend?**  
  KHÔNG. Tuyệt đối không gọi `/internal/**`.
- **Q29. Are backend URLs centralized or duplicated?**  
  TẬP TRUNG TƯƠNG ĐỐI TỐT thông qua `API_BASE_URL` trong `src/configs/constants.js` và các service files (`adminService.js`, `bookingService.js`).
- **Q30. What are the biggest frontend incompatibilities with the newly refactored backend?**  
  1. Lỗi xử lý mã lỗi 403 khiến Manager bị văng đăng xuất khi chạm vào API bị cấm.  
  2. Manager có thể vào form tạo/sửa Phim, Thể loại, Diễn viên.  
  3. Khách hàng chưa có bước chọn Cụm rạp trong luồng đặt vé.  
  4. Đạo diễn chưa được chuẩn hóa thành thực thể CRUD.  
  5. Quản lý giá vé chưa phân định Global vs Local và chưa được gắn lên giao diện.

---

## 32. MISSING INFORMATION / NEEDS CONFIRMATION

1. **Giao diện Cấu hình Hệ thống (System Settings)**: Cần xác nhận các trường dữ liệu cụ thể mà Backend `/api/v1/admin/system-settings` trả về (danh sách key-value hay schema cố định) trước khi dựng UI.
2. **Kế hoạch tái kích hoạt `/manager/*`**: Cần xác nhận xem dự án muốn Manager dùng riêng Layout độc lập (`ManagerLayout` và `ManagerSidebar`) hay tiếp tục dùng chung `AdminPage` với các tab được ẩn/hiện theo quyền.
3. **Trải nghiệm chọn Cụm rạp của Khách hàng**: Cần xác nhận luồng ưu tiên: Chọn Rạp trước rồi chọn Phim, hay Chọn Phim trước rồi mới chọn Rạp ở màn hình kế tiếp.

---
*Báo cáo được hoàn thành bởi Senior Frontend Architect. Không có dòng mã nguồn nào bị thay đổi.*

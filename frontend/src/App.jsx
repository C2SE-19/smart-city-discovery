import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import LandingLayout from './components/layouts/LandingLayout';
import WorkspaceLayout from './components/layouts/WorkspaceLayout';
import MerchantLayout from './components/layouts/MerchantLayout';
import AdminLayout from './components/layouts/AdminLayout';
import RoleGuard from './components/auth/RoleGuard';
import OverviewPage from './pages/overview/OverviewPage';
import LandingInfoPage from './LandingInfoPage';
import DiscoveryPage from './pages/discovery/DiscoveryPage';
import CityMapPage from './pages/map/CityMapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminBoundaryPage from './pages/admin/AdminBoundaryPage';
import AdminUserManagementPage from './pages/admin/AdminUserManagementPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminVenueApprovalPage from './pages/admin/AdminVenueApprovalPage';
import AdminFeedbackManagementPage from './pages/admin/AdminFeedbackManagementPage';
import MerchantWorkbenchPage from './pages/merchant/MerchantWorkbenchPage';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage';
import MerchantPostListPage from './pages/merchant/MerchantPostListPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/profile/ProfilePage';
import FeedbackSupportPage from './pages/feedback/FeedbackSupportPage';
import TermsPage from './pages/terms/TermsPage';
import { APP_ROUTES } from './constants/routes';
import { ROLES } from './constants/roles';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appContent = (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <Routes>
          <Route element={<LandingLayout />}>
          <Route path={APP_ROUTES.HOME} element={<OverviewPage />} />
          <Route
            path={APP_ROUTES.ABOUT}
            element={
              <LandingInfoPage
                title="About Smart City Discovery"
                description="Trang nay la khung noi dung mau de ban thay route thay doi nhung header, search, food va footer van giu nguyen."
                cards={[
                  {
                    title: 'Local-first discovery',
                    copy: 'Tap trung vao dia diem, mon an va trai nghiem noi bat de nguoi dung tim nhanh theo khu vuc.'
                  },
                  {
                    title: 'Merchant support',
                    copy: 'Cho merchant de dang dua hinh anh, menu, uu dai va noi dung quang ba vao he thong.'
                  },
                  {
                    title: 'GIS mindset',
                    copy: 'Ban do va khu vuc hanh chinh duoc xem nhu lop du lieu chinh de mo rong sau nay.'
                  }
                ]}
              />
            }
          />
          <Route
            path={APP_ROUTES.ALL_CITY}
            element={
              <LandingInfoPage
                title="All City Highlights"
                description="Day la page mau cho danh muc tong hop. Khi chuyen route, LandingLayout khong bi remount nen phan dung chung van giu nguyen."
                cards={[
                  {
                    title: 'Food districts',
                    copy: 'Nhom khu vuc an uong theo bai bien, trung tam thanh pho va khu du lich.'
                  },
                  {
                    title: 'Popular landmarks',
                    copy: 'Tong hop cac diem check-in, cau noi tieng, bao tang va chua lon trong thanh pho.'
                  },
                  {
                    title: 'Suggested routes',
                    copy: 'Goi y hanh trinh di chuyen gon trong 1 ngay hoac cuoi tuan cho khach du lich.'
                  }
                ]}
              />
            }
          />
          <Route
            path={APP_ROUTES.SERVICE}
            element={
              <LandingInfoPage
                title="Service"
                description="Page nay co the dung cho giao do, dat ban, affiliate ads hoac cac service page khac ma van dung lai khung trang chung."
                cards={[
                  {
                    title: 'Delivery support',
                    copy: 'Ket noi dia chi giao hang, merchant va danh sach mon an trong cung mot flow.'
                  },
                  {
                    title: 'Promotion slots',
                    copy: 'Cho phep merchant mua vi tri noi bat tren landing page ma khong pha vo bo cuc tong.'
                  },
                  {
                    title: 'Content modules',
                    copy: 'Moi route con co the them section rieng ma khong can copy lai header, food va footer.'
                  }
                ]}
              />
            }
          />
          <Route path={APP_ROUTES.TERMS} element={<TermsPage />} />
          <Route path={APP_ROUTES.FEEDBACK} element={<FeedbackSupportPage />} />
          <Route path={APP_ROUTES.CITY_MAP} element={<CityMapPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path={APP_ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={APP_ROUTES.REGISTER} element={<RegisterPage />} />

        <Route element={<WorkspaceLayout />}>
          <Route path={APP_ROUTES.DISCOVERY} element={<DiscoveryPage />} />
        </Route>

        <Route element={<MerchantLayout />}>
          <Route path={APP_ROUTES.MERCHANT_DASHBOARD} element={<MerchantDashboardPage />} />
          <Route path={APP_ROUTES.MERCHANT_POSTS} element={<MerchantPostListPage />} />
          <Route path={APP_ROUTES.MERCHANT_WORKBENCH} element={<MerchantWorkbenchPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={[ROLES.ADMIN]}>
              <AdminLayout />
            </RoleGuard>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="boundaries" element={<AdminBoundaryPage />} />
          <Route path="users" element={<AdminUserManagementPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="approvals" element={<AdminVenueApprovalPage />} />
          <Route path="feedback" element={<AdminFeedbackManagementPage />} />
        </Route>

        <Route path="*" element={<Navigate replace to={APP_ROUTES.HOME} />} />
      </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );

  if (!googleClientId) {
    return appContent;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {appContent}
    </GoogleOAuthProvider>
  );
}

export default App;

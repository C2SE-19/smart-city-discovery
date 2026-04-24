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
import ErrorBoundary from './components/shared/ErrorBoundary';
import ChatWidget from './components/chat/ChatWidget';
import AppOnboarding from './components/onboarding/AppOnboarding';
import OverviewPage from './pages/overview/OverviewPage';
import LandingInfoPage from './LandingInfoPage';
import LandingDetailPage from './pages/landing/LandingDetailPage';
import PlaceListPage from './pages/landing/PlaceListPage';
import ServiceDetailPage from './pages/landing/ServiceDetailPage';
import DiscoveryPage from './pages/discovery/DiscoveryPage';
import VenueDetailPage from './pages/discovery/VenueDetailPage';
import CityMapPage from './pages/map/CityMapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminBoundaryPage from './pages/admin/AdminBoundaryPage';
import AdminUserManagementPage from './pages/admin/AdminUserManagementPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminVenueApprovalPage from './pages/admin/AdminVenueApprovalPage';
import AdminFeedbackManagementPage from './pages/admin/AdminFeedbackManagementPage';
import AdminForumManagementPage from './pages/admin/AdminForumManagementPage';
import AdminForumOverviewPage from './pages/admin/AdminForumOverviewPage';
import AdminForumKeywordBanPage from './pages/admin/AdminForumKeywordBanPage';
import AdminAdPackagesPage from './pages/admin/AdminAdPackagesPage';
import MerchantWorkbenchPage from './pages/merchant/MerchantWorkbenchPage';
import MerchantWorkbenchEditPage from './pages/merchant/MerchantWorkbenchEditPage';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage';
import MerchantPostListPage from './pages/merchant/MerchantPostListPage';
import MerchantAdPackagesSelectionPage from './pages/merchant/MerchantAdPackagesSelectionPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/profile/ProfilePage';
import FeedbackSupportPage from './pages/feedback/FeedbackSupportPage';
import TermsPage from './pages/terms/TermsPage';
import ForumPage from './pages/forum/ForumPage';
import { APP_ROUTES } from './constants/routes';
import { ROLES } from './constants/roles';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route path={APP_ROUTES.HOME} element={<OverviewPage />} />
        <Route
          path={APP_ROUTES.ABOUT}
          element={
            <LandingInfoPage
              title="About Smart City Discovery"
              description="Explore local places and smart city content in one platform."
            />
          }
        />
        <Route
          path={APP_ROUTES.ALL_CITY}
          element={
            <LandingInfoPage
              title="All City Highlights"
              description="Browse city highlights and discover places near you."
            />
          }
        />
        <Route
          path={APP_ROUTES.SERVICE}
          element={
            <LandingInfoPage
              title="Our Services"
              description="Smart services connecting users, merchants, and map data."
            />
          }
        />
        <Route path={APP_ROUTES.TERMS} element={<TermsPage />} />
        <Route path={APP_ROUTES.FORUM} element={<ForumPage />} />
        <Route path={APP_ROUTES.FEEDBACK} element={<FeedbackSupportPage />} />
        <Route path={APP_ROUTES.LANDING_DETAIL} element={<LandingDetailPage />} />
        <Route path={APP_ROUTES.PLACE_LIST} element={<PlaceListPage />} />
        <Route path={APP_ROUTES.SERVICE_DETAIL} element={<ServiceDetailPage />} />
        <Route path={APP_ROUTES.VENUE_DETAIL} element={<VenueDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path={APP_ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={APP_ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={APP_ROUTES.CITY_MAP} element={<CityMapPage />} />

      <Route element={<WorkspaceLayout />}>
        <Route path={APP_ROUTES.DISCOVERY} element={<DiscoveryPage />} />
      </Route>

      <Route element={<MerchantLayout />}>
        <Route path={APP_ROUTES.MERCHANT_DASHBOARD} element={<MerchantDashboardPage />} />
        <Route path={APP_ROUTES.MERCHANT_POSTS} element={<MerchantPostListPage />} />
        <Route path={APP_ROUTES.MERCHANT_POST_ADVERTISE} element={<MerchantAdPackagesSelectionPage />} />
        <Route path={APP_ROUTES.MERCHANT_WORKBENCH} element={<MerchantWorkbenchPage />} />
        <Route path={APP_ROUTES.MERCHANT_WORKBENCH_EDIT} element={<MerchantWorkbenchEditPage />} />
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
        <Route path="forum" element={<Navigate replace to={APP_ROUTES.ADMIN_FORUM_REPORTS} />} />
        <Route path="forum/reports" element={<AdminForumManagementPage />} />
        <Route path="forum/view" element={<AdminForumOverviewPage />} />
        <Route path="forum/keywords" element={<AdminForumKeywordBanPage />} />
        <Route path="users" element={<AdminUserManagementPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="packages" element={<AdminAdPackagesPage />} />
        <Route path="approvals" element={<AdminVenueApprovalPage />} />
        <Route path="feedback" element={<AdminFeedbackManagementPage />} />
      </Route>

      <Route path="*" element={<Navigate replace to={APP_ROUTES.HOME} />} />
    </Routes>
  );
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const appContent = (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <BrowserRouter>
              <AppRoutes />
              <ChatWidget />
              <AppOnboarding />
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );

  if (!googleClientId) {
    return appContent;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{appContent}</GoogleOAuthProvider>;
}

export default App;

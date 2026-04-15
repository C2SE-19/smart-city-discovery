import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import LandingLayout from './components/layouts/LandingLayout';
import WorkspaceLayout from './components/layouts/WorkspaceLayout';
import MerchantLayout from './components/layouts/MerchantLayout';
import AdminLayout from './components/layouts/AdminLayout';
import RoleGuard from './components/auth/RoleGuard';
import OverviewPage from './pages/overview/OverviewPage';
import LandingInfoPage from './LandingInfoPage';
import DiscoveryPage from './pages/discovery/DiscoveryPage';
import VenueDetailPage from './pages/discovery/VenueDetailPage';
import CityMapPage from './pages/map/CityMapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminBoundaryPage from './pages/admin/AdminBoundaryPage';
import AdminUserManagementPage from './pages/admin/AdminUserManagementPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminVenueApprovalPage from './pages/admin/AdminVenueApprovalPage';
import AdminAdPackagesPage from './pages/admin/AdminAdPackagesPage';
import AdminFeedbackManagementPage from './pages/admin/AdminFeedbackManagementPage';
import MerchantWorkbenchPage from './pages/merchant/MerchantWorkbenchPage';
import MerchantWorkbenchEditPage from './pages/merchant/MerchantWorkbenchEditPage';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage';
import MerchantPostListPage from './pages/merchant/MerchantPostListPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/profile/ProfilePage';
import FeedbackSupportPage from './pages/feedback/FeedbackSupportPage';
import TermsPage from './pages/terms/TermsPage';
import { APP_ROUTES } from './constants/routes';
import { ROLES } from './constants/roles';
import ChatWidget from './components/chat/ChatWidget';
import translations from './constants/translations';
import { useLanguage } from './contexts/LanguageContext';

function AppRoutes() {
  const { language } = useLanguage();
  const t = translations[language] || translations.vi;
  const appCopy = t.app || translations.vi.app;

  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route path={APP_ROUTES.HOME} element={<OverviewPage />} />
        <Route
          path={APP_ROUTES.ABOUT}
          element={
            <LandingInfoPage
              title={appCopy.about.title}
              description={appCopy.about.description}
              cards={appCopy.about.cards}
            />
          }
        />
        <Route
          path={APP_ROUTES.ALL_CITY}
          element={
            <LandingInfoPage
              title={appCopy.allCity.title}
              description={appCopy.allCity.description}
              cards={appCopy.allCity.cards}
            />
          }
        />
        <Route
          path={APP_ROUTES.SERVICE}
          element={
            <LandingInfoPage
              title={appCopy.service.title}
              description={appCopy.service.description}
              cards={appCopy.service.cards}
            />
          }
        />
        <Route path={APP_ROUTES.TERMS} element={<TermsPage />} />
        <Route path={APP_ROUTES.FEEDBACK} element={<FeedbackSupportPage />} />
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
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
    </ErrorBoundary>
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


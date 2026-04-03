import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ROUTES } from '../../constants/routes';

function RoleGuard({ allowedRoles, children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate replace to={APP_ROUTES.LOGIN} state={{ from: location.pathname }} />;
  }

  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return children;
  }

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate replace to={APP_ROUTES.HOME} state={{ from: location.pathname }} />;
  }

  return children;
}

export default RoleGuard;

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666'
        }}
      >
        Loading...
      </div>
    );
  }

  // If already authenticated and trying to access login/register, redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

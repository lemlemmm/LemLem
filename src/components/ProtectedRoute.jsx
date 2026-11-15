import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';

export default function ProtectedRoute({ role, children }) {
  const { session, profile, loading } = useAuth();
  const { t } = useLang();
  const location = useLocation();

  if (loading) return <div className="center-screen">{t('common.loading')}</div>;
  if (!session || !profile) return <Navigate to="/login" replace />;

  // First login: force the user to choose their own password
  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Wrong role: send to the correct home
  if (role && profile.role !== role) return <Navigate to="/" replace />;

  return children;
}
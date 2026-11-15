import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { useNotify } from '../notify/NotifyContext';

export default function NotificationBell({ role, onClick, compact }) {
  const { t } = useLang();
  const { unreadCount } = useNotify();
  return (
    <Link
      to={`/${role}/notifications`}
      className={`bell ${compact ? 'bell-compact' : ''}`}
      onClick={onClick}
      aria-label={t('nav.notifications')}
    >
      <span>🔔 {!compact && t('nav.notifications')}</span>
      {unreadCount > 0 && <span className="count">{unreadCount}</span>}
    </Link>
  );
}
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { useNotify } from '../notify/NotifyContext';
import { fmtDateTime } from '../lib/dates';
import { notifTitle } from '../lib/notify';

export default function Notifications() {
  const { t, lang } = useLang();
  const { items, unreadCount, markRead, markAllRead } = useNotify();
  const navigate = useNavigate();

  function open(n) {
    if (!n.is_read) markRead(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <>
      <div className="row space-between">
        <h1>{t('nav.notifications')}</h1>
        {unreadCount > 0 && (
          <button className="btn btn-light btn-auto btn-small" onClick={markAllRead}>
            {t('notif.markAll')}
          </button>
        )}
      </div>

      {items.length === 0 && <p className="muted">{t('notif.empty')}</p>}

      {items.map((n) => (
        <button
          type="button"
          key={n.id}
          className={`card notif ${n.is_read ? '' : 'unread'}`}
          onClick={() => open(n)}
        >
          <strong>{notifTitle(n, t, lang)}</strong>
          {n.type === 'message_new' && n.body && <div className="muted">{n.body}</div>}
          <div className="muted">{fmtDateTime(n.created_at, lang)}</div>
        </button>
      ))}
    </>
  );
}
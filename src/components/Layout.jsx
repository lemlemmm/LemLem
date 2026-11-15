import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { useNotify } from '../notify/NotifyContext';
import { teacherNav, studentNav } from '../lib/nav';
import Mascot from '../mascot/Mascot';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

export default function Layout({ role }) {
  const { profile, signOut } = useAuth();
  const { t } = useLang();
  const { unreadMessages } = useNotify();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = role === 'teacher' ? teacherNav : studentNav;
  const base = `/${role}`;

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="app">
      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><Logo /></div>
        <nav className="nav">
          {items.map((key) => (
            <NavLink
              key={key}
              to={key === 'dashboard' ? base : `${base}/${key}`}
              end={key === 'dashboard'}
              onClick={() => setOpen(false)}
            >
              <span>{t(`nav.${key}`)}</span>
              {key === 'messages' && unreadMessages > 0 && <span className="count">{unreadMessages}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <NotificationBell role={role} onClick={() => setOpen(false)} />
          <div className="name">{profile?.full_name}</div>
          <button className="btn btn-light" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="btn btn-light menu-btn" onClick={() => setOpen(true)}>
            ☰ {t('nav.menu')}
          </button>
          <strong style={{ flex: 1 }}>{t('app.name')}</strong>
          <NotificationBell role={role} compact />
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>

      <Mascot />
    </div>
  );
}
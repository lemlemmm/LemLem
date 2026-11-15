import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useLang();
  const { session, profile } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session && profile) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    let email = identifier.trim();
    if (!email.includes('@')) {
      const { data } = await supabase.rpc('email_for_username', { p_username: email });
      email = data || '';
    }
    if (!email) {
      setError(t('login.error'));
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(t('login.error'));
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand">🐹 {t('app.name')}</div>
        <LanguageSwitcher />
        <h1>{t('login.title')}</h1>
        <form onSubmit={handleSubmit}>
          <label>{t('login.identifier')}</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
          <label>{t('login.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={busy}>
            {t('login.submit')}
          </button>
        </form>
        <p style={{ marginTop: 16 }}>
          <Link className="link" to="/forgot-password">{t('login.forgot')}</Link>
        </p>
        <p className="muted">{t('login.note')}</p>
      </div>
    </div>
  );
}
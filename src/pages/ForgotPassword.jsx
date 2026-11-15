import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true); // always show the same message (does not reveal which emails exist)
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand">🐹 {t('app.name')}</div>
        <LanguageSwitcher />
        <h1>{t('forgot.title')}</h1>
        {sent ? (
          <div className="success">{t('forgot.sent')}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p>{t('forgot.text')}</p>
            <label>{t('forgot.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="btn" disabled={busy}>{t('forgot.send')}</button>
          </form>
        )}
        <p style={{ marginTop: 16 }}>
          <Link className="link" to="/login">{t('forgot.back')}</Link>
        </p>
      </div>
    </div>
  );
}
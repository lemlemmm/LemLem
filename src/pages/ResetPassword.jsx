import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PasswordForm from '../components/PasswordForm';

export default function ResetPassword() {
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // The link from the email creates a temporary recovery session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setChecked(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setTimeout(() => setChecked(true), 800);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand">🐹 {t('app.name')}</div>
        <LanguageSwitcher />
        <h1>{t('password.title')}</h1>
        {ready ? (
          <PasswordForm />
        ) : checked ? (
          <>
            <div className="error">{t('password.invalidLink')}</div>
            <Link className="link" to="/forgot-password">{t('forgot.send')}</Link>
          </>
        ) : (
          <p className="muted">{t('common.loading')}</p>
        )}
      </div>
    </div>
  );
}
import { useLang } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PasswordForm from '../components/PasswordForm';

export default function ChangePassword() {
  const { t } = useLang();
  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand">🐹 {t('app.name')}</div>
        <LanguageSwitcher />
        <h1>{t('password.title')}</h1>
        <PasswordForm intro={t('password.firstLogin')} />
      </div>
    </div>
  );
}
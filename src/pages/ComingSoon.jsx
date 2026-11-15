import { useLang } from '../i18n/LanguageContext';

export default function ComingSoon({ titleKey }) {
  const { t } = useLang();
  return (
    <>
      <h1>{t(titleKey)}</h1>
      <div className="card">
        <p className="muted">{t('common.comingSoon')}</p>
      </div>
    </>
  );
}
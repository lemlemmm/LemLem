import { useLang } from '../i18n/LanguageContext';

export default function StatusBadge({ status }) {
  const { t } = useLang();
  return <span className={`badge status-${status}`}>{t(`status.${status}`)}</span>;
}
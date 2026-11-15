import { useLang } from '../i18n/LanguageContext';

export default function AttendanceBadge({ status }) {
  const { t } = useLang();
  return <span className={`badge att-${status}`}>{t(`att.${status}`)}</span>;
}
import { useLang } from '../i18n/LanguageContext';

// Only real web links are allowed (blocks things like "javascript:...")
const safe = (u) => /^https?:\/\//i.test(u || '');

export default function JoinButton({ lesson, small }) {
  const { t } = useLang();
  if (lesson.status === 'cancelled' || lesson.status === 'completed') return null;
  if (!safe(lesson.meeting_url)) return <span className="muted">{t('join.noLink')}</span>;
  return (
    <a
      className={`btn btn-auto ${small ? 'btn-small' : ''}`}
      href={lesson.meeting_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t('join.button')}
    </a>
  );
}
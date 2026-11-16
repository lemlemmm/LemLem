import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import ProgressView from '../../components/ProgressView';

export default function MyProgress() {
  const { profile } = useAuth();
  const { t } = useLang();
  return (
    <>
      <h1>{t('nav.progress')}</h1>
      <ProgressView studentId={profile.id} role="student" />
    </>
  );
}
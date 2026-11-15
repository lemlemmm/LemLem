import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import StatusBadge from '../../components/StatusBadge';

export default function StudentLessons() {
  const { t, lang } = useLang();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, starts_at, status')
        .order('starts_at', { ascending: false });
      setLessons(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('student.myLessons')}</h1>
      {lessons.length === 0 && <p className="muted">{t('lesson.empty')}</p>}
      {lessons.map((l) => (
        <div className="card row space-between" key={l.id}>
          <div>
            <strong>{l.title}</strong>
            <div className="muted">{fmtDateTime(l.starts_at, lang)}</div>
            <StatusBadge status={l.status} />
          </div>
          <Link className="btn btn-light btn-auto btn-small" to={`/student/lessons/${l.id}`}>
            {l.status === 'completed' ? t('student.openMaterials') : `🔒 ${t('lesson.open')}`}
          </Link>
        </div>
      ))}
    </>
  );
}
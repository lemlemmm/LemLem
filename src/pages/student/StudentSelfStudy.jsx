import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import AttendanceBadge from '../../components/AttendanceBadge';

export default function StudentSelfStudy() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      // Row Level Security returns only this student's self-study lessons and own records
      const [a, p, at] = await Promise.all([
        supabase.from('self_study_access').select('lesson_id, lessons(id, title, topic, starts_at)'),
        supabase.from('self_study_progress').select('lesson_id, studied_at, reviewed_at'),
        supabase.from('attendance').select('lesson_id, status'),
      ]);
      const byLesson = {};
      (a.data || []).forEach((x) => { if (x.lessons) byLesson[x.lesson_id] = x.lessons; });
      const progBy = {};
      (p.data || []).forEach((x) => { progBy[x.lesson_id] = x; });
      const attBy = {};
      (at.data || []).forEach((x) => { attBy[x.lesson_id] = x.status; });

      setItems(
        Object.values(byLesson)
          .sort((x, y) => new Date(y.starts_at) - new Date(x.starts_at))
          .map((l) => ({ ...l, prog: progBy[l.id] || null, att: attBy[l.id] || null }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.selfstudy')}</h1>
      {items.length === 0 && <p className="muted">{t('ss.listEmpty')}</p>}
      {items.map((l) => (
        <div className="card row space-between" key={l.id}>
          <div>
            <strong>{l.title}</strong>
            <div className="muted">{fmtDateTime(l.starts_at, lang)}</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              {l.att && <AttendanceBadge status={l.att} />}
              {l.prog && <span className="badge status-completed">{t('ss.studied')}</span>}
              {l.prog?.reviewed_at && <span className="badge">{t('ss.reviewed')}</span>}
            </div>
          </div>
          <Link className="btn btn-light btn-auto btn-small" to={`/student/selfstudy/${l.id}`}>
            {t('lesson.open')}
          </Link>
        </div>
      ))}
    </>
  );
}
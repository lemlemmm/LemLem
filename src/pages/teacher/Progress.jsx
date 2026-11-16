import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import ProgressView from '../../components/ProgressView';

function List() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const [st, at] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, group_members(groups(name))').eq('role', 'student').order('full_name'),
        supabase.from('attendance').select('student_id, status'),
      ]);
      const c = {};
      (at.data || []).forEach((a) => {
        if (!c[a.student_id]) c[a.student_id] = { p: 0, d: 0 };
        if (a.status === 'present') { c[a.student_id].p += 1; c[a.student_id].d += 1; }
        if (a.status === 'excused' || a.status === 'unexcused') c[a.student_id].d += 1;
      });
      setRows((st.data || []).map((s) => ({
        id: s.id,
        name: s.full_name,
        group: s.group_members?.[0]?.groups?.name || '',
        pct: c[s.id] && c[s.id].d > 0 ? Math.round((c[s.id].p / c[s.id].d) * 100) : null,
      })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.progress')}</h1>
      <h2>{t('prog.students')}</h2>
      {rows.length === 0 && <p className="muted">{t('pay.noStudents')}</p>}
      {rows.map((r) => (
        <Link className="card row space-between block-link" to={`/teacher/progress/${r.id}`} key={r.id}>
          <div>
            <strong>{r.name}</strong> {r.group && <span className="badge">{r.group}</span>}
            <div className="muted">
              {t('prog.attendance')}: {r.pct == null ? t('prog.na') : `${r.pct}%`}
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}

function Detail({ studentId }) {
  const { t } = useLang();
  const [name, setName] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle()
      .then(({ data }) => setName(data?.full_name || ''));
  }, [studentId]);

  return (
    <>
      <p><Link className="link" to="/teacher/progress">← {t('lesson.back')}</Link></p>
      <h1>{name}</h1>
      <p><Link className="link" to={`/teacher/students/${studentId}`}>{t('prog.notes')}</Link></p>
      <ProgressView studentId={studentId} role="teacher" />
    </>
  );
}

export default function Progress() {
  const { studentId } = useParams();
  return studentId ? <Detail studentId={studentId} /> : <List />;
}
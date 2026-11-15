import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime, fmtTime, startOfDay, addDays } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';
import StatusBadge from '../../components/StatusBadge';
import JoinButton from '../../components/JoinButton';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const dayStart = startOfDay(new Date());
      const dayEnd = addDays(dayStart, 1);

      const [st, gr, today, upcoming, subs, bal] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'student'),
        supabase.from('groups').select('id'),
        supabase.from('lessons')
          .select('id, title, starts_at, status, meeting_url, groups(name)')
          .gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString())
          .neq('status', 'cancelled').order('starts_at'),
        supabase.from('lessons')
          .select('id, title, starts_at, status, groups(name)')
          .gte('starts_at', dayEnd.toISOString()).eq('status', 'upcoming')
          .order('starts_at').limit(5),
        supabase.from('homework_submissions')
          .select('homework_id, student_id, submitted_at, homework(title), profiles(full_name)')
          .eq('status', 'submitted').order('submitted_at'),
        supabase.from('package_balance').select('student_id, outstanding_debt'),
      ]);

      setErrors([st, gr, today, upcoming, subs, bal].map((r) => r.error?.message).filter(Boolean));

      const students = st.data || [];
      const debtBy = {};
      (bal.data || []).forEach((b) => {
        debtBy[b.student_id] = (debtBy[b.student_id] || 0) + Number(b.outstanding_debt);
      });
      const debtors = students
        .map((s) => ({ id: s.id, name: s.full_name, debt: debtBy[s.id] || 0 }))
        .filter((s) => s.debt > 0)
        .sort((a, b) => b.debt - a.debt);

      setData({
        studentCount: students.length,
        groupCount: (gr.data || []).length,
        today: today.data || [],
        upcoming: upcoming.data || [],
        toCheck: subs.data || [],
        debtors,
        totalDebt: debtors.reduce((sum, d) => sum + d.debt, 0),
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('dashboard.hello', { name: profile?.full_name })}</h1>
      {errors.length > 0 && <div className="error">{t('dash.error')} {errors.join(' · ')}</div>}

      <div className="stats">
        <Link className="stat stat-link" to="/teacher/students">
          <div className="stat-label">{t('dash.students')}</div>
          <div className="stat-value">{data.studentCount}</div>
        </Link>
        <Link className="stat stat-link" to="/teacher/groups">
          <div className="stat-label">{t('dash.groups')}</div>
          <div className="stat-value">{data.groupCount}</div>
        </Link>
        <Link className="stat stat-link" to="/teacher/schedule">
          <div className="stat-label">{t('dash.todayLessons')}</div>
          <div className="stat-value">{data.today.length}</div>
        </Link>
        <Link className="stat stat-link" to="/teacher/homework">
          <div className="stat-label">{t('dash.hwToCheck')}</div>
          <div className={`stat-value ${data.toCheck.length > 0 ? 'danger' : ''}`}>{data.toCheck.length}</div>
        </Link>
        <Link className="stat stat-link" to="/teacher/payments">
          <div className="stat-label">{t('dash.totalDebt')}</div>
          <div className={`stat-value ${data.totalDebt > 0 ? 'danger' : ''}`}>{fmtMoney(data.totalDebt, lang)}</div>
        </Link>
        <Link className="stat stat-link" to="/teacher/payments">
          <div className="stat-label">{t('dash.debtors')}</div>
          <div className="stat-value">{data.debtors.length}</div>
        </Link>
      </div>

      <div className="dash-grid">
        <div>
          <h2>{t('dash.today')}</h2>
          {data.today.length === 0 && <p className="muted">{t('dash.noToday')}</p>}
          {data.today.map((l) => (
            <div className="card" key={l.id}>
              <div className="row space-between">
                <div>
                  <strong>{fmtTime(l.starts_at, lang)} · {l.title}</strong>
                  <div className="muted">{l.groups?.name}</div>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <JoinButton lesson={l} small />
                <Link className="btn btn-light btn-auto btn-small" to={`/teacher/lessons/${l.id}`}>
                  {t('lesson.open')}
                </Link>
              </div>
            </div>
          ))}

          <h2>{t('dash.upcoming')}</h2>
          {data.upcoming.length === 0 && <p className="muted">{t('dash.noUpcoming')}</p>}
          {data.upcoming.map((l) => (
            <Link className="card row space-between block-link" to={`/teacher/lessons/${l.id}`} key={l.id}>
              <div>
                <strong>{l.title}</strong>
                <div className="muted">{fmtDateTime(l.starts_at, lang)} · {l.groups?.name}</div>
              </div>
            </Link>
          ))}
        </div>

        <div>
          <h2>{t('dash.hwToCheck')}</h2>
          {data.toCheck.length === 0 && <p className="muted">{t('dash.nothingToCheck')}</p>}
          {data.toCheck.slice(0, 8).map((s) => (
            <Link
              className="card block-link"
              to={`/teacher/homework/${s.homework_id}/submissions/${s.student_id}`}
              key={`${s.homework_id}-${s.student_id}`}
            >
              <strong>{s.profiles?.full_name}</strong>
              <div className="muted">{s.homework?.title}</div>
            </Link>
          ))}

          <h2>{t('dash.debtors')}</h2>
          {data.debtors.length === 0 && <p className="muted">{t('dash.noDebtors')}</p>}
          {data.debtors.slice(0, 8).map((d) => (
            <Link className="card row space-between block-link" to={`/teacher/payments/${d.id}`} key={d.id}>
              <strong>{d.name}</strong>
              <strong className="amount-minus">{fmtMoney(d.debt, lang)}</strong>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
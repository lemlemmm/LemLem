import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDate, fmtTime, fmtDateTime } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';
import { effectiveStatus } from '../../lib/homework';
import JoinButton from '../../components/JoinButton';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [homework, setHomework] = useState([]);
  const [balance, setBalance] = useState(null);
  const [totalDebt, setTotalDebt] = useState(0);

  useEffect(() => {
    (async () => {
      // Row Level Security returns only this student's own group and records
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const [l, h, s, b] = await Promise.all([
        supabase.from('lessons')
          .select('id, title, topic, starts_at, duration_min, status, meeting_url, groups(name)')
          .in('status', ['upcoming', 'in_progress']).gte('starts_at', since)
          .order('starts_at').limit(3),
        supabase.from('homework').select('id, title, deadline, max_score'),
        supabase.from('homework_submissions').select('homework_id, status'),
        supabase.from('package_balance').select('*').order('started_on', { ascending: false }),
      ]);
      setErrors([l, h, s, b].map((r) => r.error?.message).filter(Boolean));

      const subBy = {};
      (s.data || []).forEach((x) => { subBy[x.homework_id] = x; });
      const due = (h.data || [])
        .map((hw) => ({ ...hw, eff: effectiveStatus(hw, subBy[hw.id] || null) }))
        .filter((hw) => ['not_started', 'in_progress', 'overdue'].includes(hw.eff))
        .sort((a, b2) => new Date(a.deadline || '9999-12-31') - new Date(b2.deadline || '9999-12-31'));

      const packs = b.data || [];
      setLessons(l.data || []);
      setHomework(due);
      setBalance(packs.find((p) => p.is_active) || packs[0] || null);
      setTotalDebt(packs.reduce((sum, p) => sum + Number(p.outstanding_debt), 0));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const next = lessons[0];
  const more = lessons.slice(1);
  const left = balance ? Number(balance.remaining_lessons) : null;

  return (
    <>
      <h1>{t('dashboard.hello', { name: profile?.full_name })}</h1>
      {errors.length > 0 && <div className="error">{t('dash.error')} {errors.join(' · ')}</div>}

      <h2>{t('dash.nextLesson')}</h2>
      {!next && <p className="muted">{t('student.noUpcoming')}</p>}
      {next && (
        <div className="card next-lesson lesson-card">
          <div className="lesson-time">{fmtTime(next.starts_at, lang)}</div>
          <div>
            <h2 style={{ marginBottom: 4 }}>{next.title}</h2>
            <p className="muted">
              {fmtDate(next.starts_at, lang)} · {next.duration_min} {t('lesson.min')}
              {next.groups?.name ? ` · ${next.groups.name}` : ''}
            </p>
            {next.topic && <p>{next.topic}</p>}
            <JoinButton lesson={next} />
          </div>
        </div>
      )}
      {more.map((l) => (
        <div className="card row space-between" key={l.id}>
          <div>
            <strong>{l.title}</strong>
            <div className="muted">{fmtDateTime(l.starts_at, lang)}</div>
          </div>
        </div>
      ))}
      {lessons.length > 0 && (
        <p><Link className="link" to="/student/schedule">{t('dash.viewAll')} →</Link></p>
      )}

      <div className="dash-grid">
        <div>
          <h2>{t('dash.hwDue')}</h2>
          {homework.length === 0 && <p className="muted">{t('dash.noHwDue')}</p>}
          {homework.slice(0, 3).map((h) => (
            <Link className="card block-link" to={`/student/homework/${h.id}`} key={h.id}>
              <div className="row space-between">
                <strong>{h.title}</strong>
                <span className={`badge hws-${h.eff}`}>{t(`hwstatus.${h.eff}`)}</span>
              </div>
              <div className="muted">
                {h.deadline ? t('hw.deadlineOn', { date: fmtDateTime(h.deadline, lang) }) : t('hw.noDeadline')}
              </div>
            </Link>
          ))}
          {homework.length > 3 && (
            <p><Link className="link" to="/student/homework">{t('dash.viewAll')} →</Link></p>
          )}
        </div>

        <div>
          <h2>{t('dash.myBalance')}</h2>
          {!balance && <p className="muted">{t('pay.noPackage')}</p>}
          {balance && (
            <Link className="stats stats-2 block-link" to="/student/payments">
              <div className="stat">
                <div className="stat-label">{t('dash.lessonsLeft')}</div>
                <div className={`stat-value ${left <= 0 ? 'danger' : ''}`}>{left}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('pay.debt')}</div>
                <div className={`stat-value ${totalDebt > 0 ? 'danger' : ''}`}>
                  {fmtMoney(Math.max(totalDebt, 0), lang)}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
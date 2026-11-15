import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDate, fmtTime, isSameDay, startOfDay } from '../../lib/dates';
import JoinButton from '../../components/JoinButton';

export default function StudentSchedule() {
  const { t, lang } = useLang();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // include lessons that began up to 3 hours ago, so late joiners still see the button
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('lessons')
        .select('id, title, topic, starts_at, duration_min, status, meeting_url, groups(name)')
        .in('status', ['upcoming', 'in_progress'])
        .gte('starts_at', since)
        .order('starts_at');
      setLessons(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const now = new Date();
  const todays = lessons.filter((l) => isSameDay(new Date(l.starts_at), now));
  const later = lessons.filter((l) => startOfDay(new Date(l.starts_at)) > startOfDay(now));

  const card = (l) => (
    <div className="card lesson-card" key={l.id}>
      <div className="lesson-time">{fmtTime(l.starts_at, lang)}</div>
      <div>
        <h2 style={{ marginBottom: 4 }}>{l.title}</h2>
        <p className="muted">
          {fmtDate(l.starts_at, lang)} · {l.duration_min} {t('lesson.min')}
          {l.groups?.name ? ` · ${l.groups.name}` : ''}
        </p>
        {l.topic && <p>{l.topic}</p>}
        <JoinButton lesson={l} />
      </div>
    </div>
  );

  return (
    <>
      <h1>{t('nav.schedule')}</h1>
      {lessons.length === 0 && <p className="muted">{t('student.noUpcoming')}</p>}
      {todays.length > 0 && <><h2>{t('student.today')}</h2>{todays.map(card)}</>}
      {later.length > 0 && <><h2>{t('student.later')}</h2>{later.map(card)}</>}
    </>
  );
}
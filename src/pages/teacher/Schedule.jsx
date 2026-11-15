import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import Calendar from '../../components/Calendar';
import { localeFor, startOfWeek, addDays, toLocalInput, recurringDates } from '../../lib/dates';

const URL_OK = /^https?:\/\//i;

function defaultForm() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return {
    group_id: '', title: '', topic: '', objectives: '',
    starts_at: toLocalInput(d.toISOString()),
    duration_min: 60, meeting_url: '',
    recurring: false, days: [0, 2, 4], weeks: 4, // Mon, Wed, Fri x 4 weeks = 12 lessons
  };
}

export default function Schedule() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: l }, { data: g }] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, title, starts_at, duration_min, status, meeting_url, group_id, groups(name)')
        .order('starts_at'),
      supabase.from('groups').select('id, name').order('created_at'),
    ]);
    setLessons(l || []);
    setGroups(g || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleDay = (i) =>
    setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i] });

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(new Date()), i).toLocaleDateString(localeFor(lang), { weekday: 'short' })
  );

  const validStart = !isNaN(new Date(form.starts_at));
  const count = form.recurring && validStart
    ? recurringDates(form.starts_at, form.days, Number(form.weeks) || 1).length
    : 1;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.group_id) return setError(t('lesson.chooseGroup'));
    if (form.meeting_url.trim() && !URL_OK.test(form.meeting_url.trim())) return setError(t('lesson.linkInvalid'));
    if (!validStart) return setError(t('lesson.chooseDays'));

    const dates = form.recurring
      ? recurringDates(form.starts_at, form.days, Number(form.weeks) || 1)
      : [new Date(form.starts_at)];
    if (dates.length === 0) return setError(t('lesson.chooseDays'));

    const rows = dates.map((d) => ({
      group_id: form.group_id,
      title: form.title.trim(),
      topic: form.topic.trim() || null,
      objectives: form.objectives.trim() || null,
      starts_at: d.toISOString(),
      duration_min: Number(form.duration_min) || 60,
      meeting_url: form.meeting_url.trim() || null,
    }));

    setBusy(true);
    const { error: err } = await supabase.from('lessons').insert(rows);
    setBusy(false);
    if (err) return setError(err.message);
    setShowForm(false);
    setForm(defaultForm());
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <div className="row space-between">
        <h1>{t('nav.schedule')}</h1>
        {!showForm && (
          <button className="btn btn-auto" onClick={() => setShowForm(true)}>+ {t('lesson.new')}</button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{t('lesson.new')}</h2>
          <form onSubmit={submit}>
            <div className="grid-2">
              <div>
                <label>{t('lesson.group')}</label>
                <select value={form.group_id} onChange={set('group_id')} required>
                  <option value="">{t('lesson.chooseGroup')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t('lesson.title')}</label>
                <input value={form.title} onChange={set('title')} required />
              </div>
              <div>
                <label>{t('lesson.start')}</label>
                <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
              </div>
              <div>
                <label>{t('lesson.duration')}</label>
                <input type="number" min="15" step="5" value={form.duration_min} onChange={set('duration_min')} />
              </div>
              <div>
                <label>{t('lesson.topic')}</label>
                <input value={form.topic} onChange={set('topic')} />
              </div>
              <div>
                <label>{t('lesson.link')}</label>
                <input value={form.meeting_url} onChange={set('meeting_url')} placeholder="https://meet.google.com/..." />
              </div>
            </div>
            <label>{t('lesson.objectives')}</label>
            <textarea rows="2" value={form.objectives} onChange={set('objectives')} />

            <label className="check">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
              {t('lesson.recurring')}
            </label>

            {form.recurring && (
              <div style={{ marginTop: 12 }}>
                <div className="days">
                  {dayNames.map((n, i) => (
                    <label className="check" key={i}>
                      <input type="checkbox" checked={form.days.includes(i)} onChange={() => toggleDay(i)} />
                      {n}
                    </label>
                  ))}
                </div>
                <label>{t('lesson.weeks')}</label>
                <input type="number" min="1" max="26" value={form.weeks} onChange={set('weeks')} style={{ maxWidth: 160 }} />
                <p className="muted">{t('lesson.willCreate', { n: count })}</p>
              </div>
            )}

            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn btn-auto" disabled={busy}>{t('lesson.create')}</button>
              <button type="button" className="btn btn-light btn-auto" onClick={() => { setShowForm(false); setError(''); }}>
                {t('groups.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <Calendar lessons={lessons} onSelect={(l) => navigate(`/teacher/lessons/${l.id}`)} />
    </>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { testWindow } from '../../lib/tests';

const emptyForm = () => ({
  group_id: '', title: '', description: '', instructions: '',
  opens_at: '', closes_at: '', time_limit_min: 30, max_score: 20,
});

export default function Tests() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tt, g] = await Promise.all([
      supabase
        .from('tests')
        .select('id, title, opens_at, closes_at, time_limit_min, group_id, groups(name), test_submissions(status)')
        .order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name').order('created_at'),
    ]);
    setList(tt.data || []);
    setGroups(g.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.group_id) return setError(t('lesson.chooseGroup'));
    const max = Number(form.max_score);
    const limit = Number(form.time_limit_min);
    if (!Number.isInteger(max) || max < 1) return setError(t('hw.err.max'));
    if (!Number.isInteger(limit) || limit < 1 || limit > 300) return setError(t('test.err.limit'));
    if (form.opens_at && form.closes_at && new Date(form.closes_at) <= new Date(form.opens_at)) {
      return setError(t('test.err.dates'));
    }
    setBusy(true);
    const { data, error: err } = await supabase
      .from('tests')
      .insert({
        group_id: form.group_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        time_limit_min: limit,
        max_score: max,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) return setError(err.message);
    navigate(`/teacher/tests/${data.id}`); // next: add the questions
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const shown = list.filter((x) => !groupFilter || x.group_id === groupFilter);

  return (
    <>
      <div className="row space-between">
        <h1>{t('nav.tests')}</h1>
        {!showForm && (
          <button className="btn btn-auto" onClick={() => setShowForm(true)}>+ {t('test.new')}</button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{t('test.new')}</h2>
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
                <label>{t('hw.titleField')}</label>
                <input value={form.title} onChange={set('title')} required />
              </div>
              <div>
                <label>{t('test.timeLimit')}</label>
                <input type="number" min="1" max="300" step="1" value={form.time_limit_min} onChange={set('time_limit_min')} />
              </div>
              <div>
                <label>{t('hw.maxScore')}</label>
                <input type="number" min="1" step="1" value={form.max_score} onChange={set('max_score')} />
              </div>
              <div>
                <label>{t('test.opens')}</label>
                <input type="datetime-local" value={form.opens_at} onChange={set('opens_at')} />
              </div>
              <div>
                <label>{t('test.closes')}</label>
                <input type="datetime-local" value={form.closes_at} onChange={set('closes_at')} />
              </div>
            </div>
            <label>{t('hw.description')}</label>
            <textarea rows="2" value={form.description} onChange={set('description')} />
            <label>{t('hw.instructions')}</label>
            <textarea rows="3" value={form.instructions} onChange={set('instructions')} />
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn btn-auto" disabled={busy}>{t('test.create')}</button>
              <button type="button" className="btn btn-light btn-auto" onClick={() => { setShowForm(false); setError(''); }}>
                {t('groups.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <label>{t('lesson.filterGroup')}</label>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} style={{ marginBottom: 0 }}>
          <option value="">{t('lesson.all')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {shown.length === 0 && <p className="muted">{t('test.empty')}</p>}

      {shown.map((x) => {
        const subs = x.test_submissions || [];
        const toCheck = subs.filter((s) => s.status === 'submitted').length;
        const done = subs.filter((s) => s.status === 'submitted' || s.status === 'checked').length;
        const win = testWindow(x);
        return (
          <div className="card row space-between" key={x.id}>
            <div>
              <strong>{x.title}</strong>
              <div className="muted">
                {x.groups?.name} · {t('test.min', { n: x.time_limit_min })}
              </div>
              <div className="muted">
                {x.opens_at ? t('test.opensOn', { date: fmtDateTime(x.opens_at, lang) }) : t('test.alwaysOpen')}
                {x.closes_at ? ` · ${t('test.closesOn', { date: fmtDateTime(x.closes_at, lang) })}` : ''}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <span className={`badge ${win === 'open' ? 'status-completed' : win === 'closed' ? 'status-cancelled' : ''}`}>
                  {t(`test.win.${win}`)}
                </span>
                <span className="badge">{t('hw.submittedN', { n: done })}</span>
                {toCheck > 0 && <span className="badge badge-warn">{t('hw.toCheck', { n: toCheck })}</span>}
              </div>
            </div>
            <Link className="btn btn-light btn-auto btn-small" to={`/teacher/tests/${x.id}`}>
              {t('lesson.open')}
            </Link>
          </div>
        );
      })}
    </>
  );
}
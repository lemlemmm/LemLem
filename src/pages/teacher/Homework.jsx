import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { safeName } from '../../lib/files';

const emptyForm = () => ({
  group_id: '', lesson_id: '', title: '', description: '', instructions: '', deadline: '', max_score: 10,
});

export default function Homework() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [lessons, setLessons] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [h, g] = await Promise.all([
      supabase
        .from('homework')
        .select('id, title, deadline, group_id, groups(name), homework_submissions(status)')
        .order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name').order('created_at'),
    ]);
    setList(h.data || []);
    setGroups(g.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lessons of the chosen group, for the optional "lesson" field
  useEffect(() => {
    if (!form.group_id) { setLessons([]); return; }
    supabase
      .from('lessons')
      .select('id, title, starts_at')
      .eq('group_id', form.group_id)
      .order('starts_at', { ascending: false })
      .limit(60)
      .then(({ data }) => setLessons(data || []));
  }, [form.group_id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.group_id) return setError(t('lesson.chooseGroup'));
    const max = Number(form.max_score);
    if (!Number.isInteger(max) || max < 1) return setError(t('hw.err.max'));

    setBusy(true);
    const { data, error: err } = await supabase
      .from('homework')
      .insert({
        group_id: form.group_id,
        lesson_id: form.lesson_id || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        max_score: max,
      })
      .select('id')
      .single();
    if (err) { setBusy(false); return setError(err.message); }

    if (file) {
      const path = `homework/${data.id}/${Date.now()}-${safeName(file.name)}`;
      const up = await supabase.storage.from('materials').upload(path, file);
      if (up.error) {
        await supabase.from('homework').delete().eq('id', data.id); // roll back
        setBusy(false);
        return setError(up.error.message);
      }
      await supabase.from('homework').update({ file_path: path, file_name: file.name }).eq('id', data.id);
    }
    setBusy(false);
    navigate(`/teacher/homework/${data.id}`); // next: add the questions
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const shown = list.filter((h) => !groupFilter || h.group_id === groupFilter);

  return (
    <>
      <div className="row space-between">
        <h1>{t('nav.homework')}</h1>
        {!showForm && (
          <button className="btn btn-auto" onClick={() => setShowForm(true)}>+ {t('hw.new')}</button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{t('hw.new')}</h2>
          <form onSubmit={submit}>
            <div className="grid-2">
              <div>
                <label>{t('lesson.group')}</label>
                <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value, lesson_id: '' })} required>
                  <option value="">{t('lesson.chooseGroup')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t('hw.lesson')}</label>
                <select value={form.lesson_id} onChange={set('lesson_id')}>
                  <option value="">{t('hw.noLesson')}</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>{fmtDateTime(l.starts_at, lang)} — {l.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t('hw.titleField')}</label>
                <input value={form.title} onChange={set('title')} required />
              </div>
              <div>
                <label>{t('hw.maxScore')}</label>
                <input type="number" min="1" step="1" value={form.max_score} onChange={set('max_score')} />
              </div>
              <div>
                <label>{t('hw.deadline')}</label>
                <input type="datetime-local" value={form.deadline} onChange={set('deadline')} />
              </div>
              <div>
                <label>{t('hw.attachment')}</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <label>{t('hw.description')}</label>
            <textarea rows="2" value={form.description} onChange={set('description')} />
            <label>{t('hw.instructions')}</label>
            <textarea rows="3" value={form.instructions} onChange={set('instructions')} />
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn btn-auto" disabled={busy}>{t('hw.create')}</button>
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

      {shown.length === 0 && <p className="muted">{t('hw.empty')}</p>}

      {shown.map((h) => {
        const subs = h.homework_submissions || [];
        const toCheck = subs.filter((s) => s.status === 'submitted').length;
        const done = subs.filter((s) => s.status === 'submitted' || s.status === 'checked').length;
        return (
          <div className="card row space-between" key={h.id}>
            <div>
              <strong>{h.title}</strong>
              <div className="muted">
                {h.groups?.name} · {h.deadline ? t('hw.deadlineOn', { date: fmtDateTime(h.deadline, lang) }) : t('hw.noDeadline')}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <span className="badge">{t('hw.submittedN', { n: done })}</span>
                {toCheck > 0 && <span className="badge badge-warn">{t('hw.toCheck', { n: toCheck })}</span>}
              </div>
            </div>
            <Link className="btn btn-light btn-auto btn-small" to={`/teacher/homework/${h.id}`}>
              {t('lesson.open')}
            </Link>
          </div>
        );
      })}
    </>
  );
}
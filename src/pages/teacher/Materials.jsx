import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { safeName } from '../../lib/files';
import FileLink from '../../components/FileLink';

const KINDS = ['vocabulary', 'grammar', 'reading', 'exercise', 'listening', 'speaking', 'writing', 'notes'];
const MAX_MB = 50;
const emptyForm = () => ({ title: '', target: 'group', group_id: '', student_id: '', lesson_id: '', kind: 'notes' });

export default function Materials() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [lessonNames, setLessonNames] = useState({});
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [m, g, s] = await Promise.all([
      supabase.from('materials').select('*, groups(name), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name').order('created_at'),
      supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name'),
    ]);
    const list = m.data || [];
    const ids = [...new Set(list.filter((x) => x.lesson_id).map((x) => x.lesson_id))];
    const names = {};
    if (ids.length) {
      const { data } = await supabase.from('lessons').select('id, title').in('id', ids);
      (data || []).forEach((l) => { names[l.id] = l.title; });
    }
    setItems(list);
    setLessonNames(names);
    setGroups(g.data || []);
    setStudents(s.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lessons of the chosen group (only when assigning to a lesson)
  useEffect(() => {
    if (form.target !== 'lesson' || !form.group_id) { setLessons([]); return; }
    supabase.from('lessons').select('id, title, starts_at').eq('group_id', form.group_id)
      .order('starts_at', { ascending: false }).limit(60)
      .then(({ data }) => setLessons(data || []));
  }, [form.target, form.group_id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(''); setMsg('');
    if (!file) return setError(t('lib.noFile'));
    if (file.size > MAX_MB * 1024 * 1024) return setError(t('lib.tooBig', { n: MAX_MB }));
    if (form.target === 'group' && !form.group_id) return setError(t('lesson.chooseGroup'));
    if (form.target === 'student' && !form.student_id) return setError(t('lib.chooseStudent'));
    if (form.target === 'lesson' && (!form.group_id || !form.lesson_id)) return setError(t('lib.chooseLesson'));

    setBusy(true);
    const title = form.title.trim() || file.name;
    const path = `library/${Date.now()}-${safeName(file.name)}`;
    const up = await supabase.storage.from('materials').upload(path, file);
    if (up.error) { setBusy(false); return setError(up.error.message); }

    const { data: row, error: err } = await supabase.from('materials').insert({
      title,
      file_path: path,
      file_type: file.type || null,
      group_id: form.target === 'group' ? form.group_id : null,
      student_id: form.target === 'student' ? form.student_id : null,
      lesson_id: form.target === 'lesson' ? form.lesson_id : null,
    }).select('id').single();
    if (err) {
      await supabase.storage.from('materials').remove([path]);
      setBusy(false);
      return setError(err.message);
    }

    if (form.target === 'lesson') {
      const { error: lmErr } = await supabase.from('lesson_materials').insert({
        lesson_id: form.lesson_id, kind: form.kind, title,
        file_path: path, file_type: file.type || null, material_id: row.id, sort_order: 100,
      });
      if (lmErr) {
        await supabase.from('materials').delete().eq('id', row.id);
        await supabase.storage.from('materials').remove([path]);
        setBusy(false);
        return setError(lmErr.message);
      }
    }

    setBusy(false);
    setForm({ ...emptyForm(), target: form.target, group_id: form.group_id });
    setFile(null);
    setFileKey((k) => k + 1);
    setMsg(t('lib.added'));
    load();
  }

  async function remove(m) {
    if (!window.confirm(t('lib.confirmDelete'))) return;
    setError(''); setMsg('');
    await supabase.from('lesson_materials').delete().eq('material_id', m.id);
    if (m.file_path) await supabase.storage.from('materials').remove([m.file_path]);
    const { error: err } = await supabase.from('materials').delete().eq('id', m.id);
    if (err) return setError(err.message);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const label = (m) => {
    if (m.group_id) return t('lib.forGroup', { name: m.groups?.name || '' });
    if (m.student_id) return t('lib.forStudent', { name: m.profiles?.full_name || '' });
    if (m.lesson_id) return t('lib.forLesson', { name: lessonNames[m.lesson_id] || '' });
    return t('lib.libraryOnly');
  };

  return (
    <>
      <h1>{t('nav.materials')}</h1>

      <div className="card">
        <h2>{t('lib.add')}</h2>
        <form onSubmit={submit}>
          <label>{t('lib.file')}</label>
          <input key={fileKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <p className="muted">{t('lib.fileHint', { n: MAX_MB })}</p>

          <label>{t('lib.name')}</label>
          <input value={form.title} onChange={set('title')} />

          <div className="grid-2">
            <div>
              <label>{t('lib.assignTo')}</label>
              <select value={form.target} onChange={set('target')}>
                <option value="group">{t('lib.t.group')}</option>
                <option value="student">{t('lib.t.student')}</option>
                <option value="lesson">{t('lib.t.lesson')}</option>
                <option value="none">{t('lib.t.none')}</option>
              </select>
            </div>

            {(form.target === 'group' || form.target === 'lesson') && (
              <div>
                <label>{t('lesson.group')}</label>
                <select
                  value={form.group_id}
                  onChange={(e) => setForm({ ...form, group_id: e.target.value, lesson_id: '' })}
                >
                  <option value="">{t('lesson.chooseGroup')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {form.target === 'student' && (
              <div>
                <label>{t('students.title')}</label>
                <select value={form.student_id} onChange={set('student_id')}>
                  <option value="">{t('lib.chooseStudent')}</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
            )}

            {form.target === 'lesson' && (
              <>
                <div>
                  <label>{t('att.lesson')}</label>
                  <select value={form.lesson_id} onChange={set('lesson_id')}>
                    <option value="">{t('lib.chooseLesson')}</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>{fmtDateTime(l.starts_at, lang)} — {l.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{t('mat.kind')}</label>
                  <select value={form.kind} onChange={set('kind')}>
                    {KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {form.target === 'lesson' && <p className="muted">{t('lib.lessonHint')}</p>}
          {error && <div className="error">{error}</div>}
          {msg && <div className="success">{msg}</div>}
          <button className="btn btn-auto" disabled={busy}>{busy ? t('lib.uploading') : t('lib.upload')}</button>
        </form>
      </div>

      <h2>{t('lib.list')}</h2>
      {items.length === 0 && <p className="muted">{t('lib.empty')}</p>}
      {items.map((m) => (
        <div className="card row space-between" key={m.id}>
          <div>
            <strong>{m.title}</strong>
            <div className="muted">{label(m)} · {fmtDateTime(m.created_at, lang)}</div>
          </div>
          <div className="row">
            <FileLink path={m.file_path} name={null} />
            <button className="link" onClick={() => remove(m)}>{t('mat.delete')}</button>
          </div>
        </div>
      ))}
    </>
  );
}
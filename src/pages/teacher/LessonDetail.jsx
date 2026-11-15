import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { toLocalInput } from '../../lib/dates';
import StatusBadge from '../../components/StatusBadge';
import JoinButton from '../../components/JoinButton';
import LessonMaterialItem from '../../components/LessonMaterialItem';

const KINDS = ['vocabulary', 'grammar', 'reading', 'exercise', 'listening', 'speaking', 'writing', 'notes'];
const URL_OK = /^https?:\/\//i;

export default function LessonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('upcoming');
  const [groups, setGroups] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newMat, setNewMat] = useState({ kind: 'vocabulary', title: '', content: '' });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [{ data: l }, { data: g }, { data: m }] = await Promise.all([
      supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
      supabase.from('groups').select('id, name').order('created_at'),
      supabase.from('lesson_materials').select('*').eq('lesson_id', id).order('sort_order').order('title'),
    ]);
    if (!l) { setNotFound(true); setLoading(false); return; }
    setForm({
      group_id: l.group_id, title: l.title, topic: l.topic || '', objectives: l.objectives || '',
      starts_at: toLocalInput(l.starts_at), duration_min: l.duration_min,
      meeting_url: l.meeting_url || '', homework_note: l.homework_note || '',
    });
    setStatus(l.status);
    setGroups(g || []);
    setMaterials(m || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setError(''); setMsg('');
    if (form.meeting_url.trim() && !URL_OK.test(form.meeting_url.trim())) return setError(t('lesson.linkInvalid'));
    if (isNaN(new Date(form.starts_at))) return setError(t('lesson.chooseDays'));
    const { error: err } = await supabase.from('lessons').update({
      group_id: form.group_id,
      title: form.title.trim(),
      topic: form.topic.trim() || null,
      objectives: form.objectives.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      duration_min: Number(form.duration_min) || 60,
      meeting_url: form.meeting_url.trim() || null,
      homework_note: form.homework_note.trim() || null,
    }).eq('id', id);
    if (err) return setError(err.message);
    setMsg(t('lesson.saved'));
  }

  async function changeStatus(next) {
    setError(''); setMsg('');
    const { error: err } = await supabase.from('lessons').update({ status: next }).eq('id', id);
    if (err) return setError(err.message);
    setStatus(next);
  }

  async function deleteLesson() {
    if (!window.confirm(t('lesson.confirmDelete'))) return;
    const paths = materials.filter((m) => m.file_path).map((m) => m.file_path);
    if (paths.length) await supabase.storage.from('materials').remove(paths);
    const { error: err } = await supabase.from('lessons').delete().eq('id', id);
    if (err) return setError(err.message);
    navigate('/teacher/lessons');
  }

  async function addMaterial(e) {
    e.preventDefault();
    setError('');
    if (!newMat.title.trim()) return;
    setBusy(true);

    let file_path = null;
    let file_type = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      file_path = `lessons/${id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('materials').upload(file_path, file);
      if (upErr) { setError(upErr.message); setBusy(false); return; }
      file_type = file.type || null;
    }

    const { error: err } = await supabase.from('lesson_materials').insert({
      lesson_id: id,
      kind: newMat.kind,
      title: newMat.title.trim(),
      content: newMat.content.trim() || null,
      file_path, file_type,
      sort_order: materials.length,
    });
    if (err) {
      if (file_path) await supabase.storage.from('materials').remove([file_path]);
      setError(err.message);
      setBusy(false);
      return;
    }
    setNewMat({ kind: newMat.kind, title: '', content: '' });
    setFile(null);
    setFileKey((k) => k + 1);
    setBusy(false);
    load();
  }

  async function deleteMaterial(m) {
    if (!window.confirm(t('mat.confirmDelete'))) return;
    if (m.file_path) await supabase.storage.from('materials').remove([m.file_path]);
    await supabase.from('lesson_materials').delete().eq('id', m.id);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (notFound) return <p className="muted">{t('lesson.notFound')}</p>;

  const open = status === 'upcoming' || status === 'in_progress';

  return (
    <>
      <p><Link className="link" to="/teacher/lessons">← {t('lesson.back')}</Link></p>
      <h1>{form.title}</h1>

      <div className="card">
        <h2>{t('lesson.statusTitle')}</h2>
        <p><StatusBadge status={status} /></p>
        <p className="muted">{status === 'completed' ? t('lesson.completedHint') : t('lesson.lockedHint')}</p>
        <div className="row">
          {status === 'upcoming' && (
            <button className="btn btn-light btn-auto" onClick={() => changeStatus('in_progress')}>
              {t('lesson.markStarted')}
            </button>
          )}
          {open && (
            <button className="btn btn-auto" onClick={() => changeStatus('completed')}>
              {t('lesson.markCompleted')}
            </button>
          )}
          {open && (
            <button className="btn btn-danger btn-auto" onClick={() => changeStatus('cancelled')}>
              {t('lesson.cancel')}
            </button>
          )}
          {!open && (
            <button className="btn btn-light btn-auto" onClick={() => changeStatus('upcoming')}>
              {t('lesson.reopen')}
            </button>
          )}
          <JoinButton lesson={{ status, meeting_url: form.meeting_url }} />
        </div>
      </div>

      <div className="card">
        <h2>{t('lesson.details')}</h2>
        <div className="grid-2">
          <div>
            <label>{t('lesson.group')}</label>
            <select value={form.group_id} onChange={set('group_id')}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label>{t('lesson.title')}</label>
            <input value={form.title} onChange={set('title')} />
          </div>
          <div>
            <label>{t('lesson.start')}</label>
            <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} />
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
        <label>{t('lesson.homeworkNote')}</label>
        <textarea rows="2" value={form.homework_note} onChange={set('homework_note')} />
        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <div className="row">
          <button className="btn btn-auto" onClick={save}>{t('lesson.save')}</button>
          <button className="btn btn-danger btn-auto" onClick={deleteLesson}>{t('lesson.delete')}</button>
        </div>
      </div>

      <h2>{t('mat.title')}</h2>
      {materials.length === 0 && <p className="muted">{t('mat.empty')}</p>}
      {materials.map((m) => <LessonMaterialItem key={m.id} m={m} onDelete={deleteMaterial} />)}

      <div className="card">
        <h2>{t('mat.add')}</h2>
        <form onSubmit={addMaterial}>
          <div className="grid-2">
            <div>
              <label>{t('mat.kind')}</label>
              <select value={newMat.kind} onChange={(e) => setNewMat({ ...newMat, kind: e.target.value })}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
              </select>
            </div>
            <div>
              <label>{t('mat.itemTitle')}</label>
              <input value={newMat.title} onChange={(e) => setNewMat({ ...newMat, title: e.target.value })} required />
            </div>
          </div>
          <label>{t('mat.content')}</label>
          <textarea rows="5" value={newMat.content} onChange={(e) => setNewMat({ ...newMat, content: e.target.value })} />
          <label>{t('mat.file')}</label>
          <input key={fileKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn btn-auto" disabled={busy}>{busy ? t('mat.saving') : t('mat.addBtn')}</button>
        </form>
      </div>
    </>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime, toLocalInput } from '../../lib/dates';
import { safeName } from '../../lib/files';
import { effectiveStatus, formatValue } from '../../lib/homework';
import QuestionEditor from '../../components/QuestionEditor';
import FileLink from '../../components/FileLink';

export default function HomeworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hw, setHw] = useState(null);
  const [form, setForm] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [rows, setRows] = useState([]);
  const [newFile, setNewFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: h } = await supabase.from('homework').select('*, groups(name)').eq('id', id).maybeSingle();
    if (!h) { setNotFound(true); setLoading(false); return; }

    const [q, s, gm, l] = await Promise.all([
      supabase.from('homework_questions').select('*').eq('homework_id', id).order('sort_order'),
      supabase.from('homework_submissions')
        .select('student_id, status, final_score, auto_score, is_late, file_path')
        .eq('homework_id', id),
      supabase.from('group_members').select('student_id, profiles(full_name)').eq('group_id', h.group_id),
      supabase.from('lessons').select('id, title, starts_at').eq('group_id', h.group_id)
        .order('starts_at', { ascending: false }).limit(60),
    ]);

    const subBy = {};
    (s.data || []).forEach((x) => { subBy[x.student_id] = x; });
    const list = (gm.data || [])
      .map((m) => ({ id: m.student_id, name: m.profiles?.full_name || '', sub: subBy[m.student_id] || null }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setHw(h);
    setForm({
      title: h.title, lesson_id: h.lesson_id || '', description: h.description || '',
      instructions: h.instructions || '', max_score: h.max_score,
      deadline: h.deadline ? toLocalInput(h.deadline) : '',
    });
    setQuestions(q.data || []);
    setRows(list);
    setLessons(l.data || []);
    setAllSubFiles((s.data || []).map((x) => x.file_path).filter(Boolean));
    setLoading(false);
  }, [id]);

  const [allSubFiles, setAllSubFiles] = useState([]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const locked = rows.some((r) => r.sub && ['submitted', 'checked'].includes(r.sub.status));
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  async function save() {
    setError(''); setMsg('');
    const max = Number(form.max_score);
    if (!Number.isInteger(max) || max < 1) return setError(t('hw.err.max'));

    let filePatch = {};
    let oldPath = null;
    if (newFile) {
      const path = `homework/${id}/${Date.now()}-${safeName(newFile.name)}`;
      const up = await supabase.storage.from('materials').upload(path, newFile);
      if (up.error) return setError(up.error.message);
      filePatch = { file_path: path, file_name: newFile.name };
      oldPath = hw.file_path;
    }

    const { error: err } = await supabase.from('homework').update({
      title: form.title.trim(),
      lesson_id: form.lesson_id || null,
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      max_score: max,
      ...filePatch,
    }).eq('id', id);

    if (err) {
      if (filePatch.file_path) await supabase.storage.from('materials').remove([filePatch.file_path]);
      return setError(err.message);
    }
    if (oldPath) await supabase.storage.from('materials').remove([oldPath]);
    setNewFile(null);
    setFileKey((k) => k + 1);
    setMsg(t('hw.saved'));
    load();
  }

  async function removeAttachment() {
    setError(''); setMsg('');
    const path = hw.file_path;
    const { error: err } = await supabase.from('homework').update({ file_path: null, file_name: null }).eq('id', id);
    if (err) return setError(err.message);
    if (path) await supabase.storage.from('materials').remove([path]);
    load();
  }

  async function addQuestion(q) {
    const sort = questions.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1;
    const { error: err } = await supabase.from('homework_questions').insert({ ...q, homework_id: id, sort_order: sort });
    if (err) return err.message;
    await load();
    return null;
  }

  async function deleteQuestion(qid) {
    if (!window.confirm(t('hw.confirmDeleteQuestion'))) return;
    const { error: err } = await supabase.from('homework_questions').delete().eq('id', qid);
    if (err) return setError(err.message);
    load();
  }

  async function deleteHomework() {
    if (!window.confirm(t('hw.confirmDelete'))) return;
    const paths = [hw.file_path, ...allSubFiles].filter(Boolean);
    if (paths.length) await supabase.storage.from('materials').remove(paths);
    const { error: err } = await supabase.from('homework').delete().eq('id', id);
    if (err) return setError(err.message);
    navigate('/teacher/homework');
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (notFound) return <p className="muted">{t('hw.notFound')}</p>;

  return (
    <>
      <p><Link className="link" to="/teacher/homework">← {t('lesson.back')}</Link></p>
      <h1>{hw.title}</h1>
      <p className="muted">{hw.groups?.name}</p>

      <div className="card">
        <h2>{t('hw.details')}</h2>
        <div className="grid-2">
          <div>
            <label>{t('hw.titleField')}</label>
            <input value={form.title} onChange={set('title')} />
          </div>
          <div>
            <label>{t('hw.maxScore')}</label>
            <input type="number" min="1" step="1" value={form.max_score} onChange={set('max_score')} />
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
            <label>{t('hw.deadline')}</label>
            <input type="datetime-local" value={form.deadline} onChange={set('deadline')} />
          </div>
        </div>
        <label>{t('hw.description')}</label>
        <textarea rows="2" value={form.description} onChange={set('description')} />
        <label>{t('hw.instructions')}</label>
        <textarea rows="3" value={form.instructions} onChange={set('instructions')} />

        <label>{t('hw.attachment')}</label>
        {hw.file_path && (
          <div className="row" style={{ marginBottom: 12 }}>
            <FileLink path={hw.file_path} name={hw.file_name} />
            <button type="button" className="link" onClick={removeAttachment}>{t('hw.removeFile')}</button>
          </div>
        )}
        <input key={fileKey} type="file" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />

        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <div className="row">
          <button className="btn btn-auto" onClick={save}>{t('lesson.save')}</button>
          <button className="btn btn-danger btn-auto" onClick={deleteHomework}>{t('hw.delete')}</button>
        </div>
      </div>

      <h2>{t('hw.questions')}</h2>
      {questions.length > 0 && <p className="muted">{t('hw.totalPoints', { n: totalPoints })}</p>}
      {questions.length === 0 && <p className="muted">{t('hw.noQuestions')}</p>}

      {questions.map((q, i) => {
        const manual = q.type === 'writing' || (q.type === 'short_answer' && !(q.correct_answer || []).length);
        return (
          <div className="card" key={q.id}>
            <div className="row space-between">
              <div className="row" style={{ gap: 8 }}>
                <strong>{t('hw.qn', { n: i + 1 })}</strong>
                <span className="badge">{t(`hw.type.${q.type}`)}</span>
                <span className="muted">{q.points} {t('hw.points').toLowerCase()}</span>
              </div>
              {!locked && (
                <button className="link" onClick={() => deleteQuestion(q.id)}>{t('hw.deleteQuestion')}</button>
              )}
            </div>
            <div className="pre">{q.prompt}</div>
            {q.type === 'multiple_choice' && (
              <p className="muted">{t('hw.options')}: {(q.options || []).join(' / ')}</p>
            )}
            {manual
              ? <p className="muted">{t('hw.manualGrade')}</p>
              : <div className="key-box"><strong>{t('hw.correctAnswer')}:</strong>{'\n'}{formatValue(q, q.correct_answer, t)}</div>}
          </div>
        );
      })}

      {locked ? <p className="muted">{t('hw.locked')}</p> : <QuestionEditor onAdd={addQuestion} />}

      <div className="card">
        <h2>{t('hw.submissions')}</h2>
        {rows.length === 0 && <p className="muted">{t('hw.noStudents')}</p>}
        {rows.map((r) => {
          const eff = effectiveStatus(hw, r.sub);
          return (
            <div className="row space-between list-row" key={r.id}>
              <div>
                <strong>{r.name}</strong>{' '}
                <span className={`badge hws-${eff}`}>{t(`hwstatus.${eff}`)}</span>
                {r.sub?.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
                {r.sub?.status === 'checked' && (
                  <span className="muted"> · {r.sub.final_score} / {hw.max_score}</span>
                )}
              </div>
              {r.sub && ['submitted', 'checked'].includes(r.sub.status) && (
                <Link className="btn btn-light btn-auto btn-small" to={`/teacher/homework/${id}/submissions/${r.id}`}>
                  {t('hw.review')}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { useMascot } from '../../mascot/MascotContext';
import { fmtDateTime } from '../../lib/dates';
import { safeName } from '../../lib/files';
import LessonMaterialItem from '../../components/LessonMaterialItem';
import FileLink from '../../components/FileLink';

export default function SelfStudyLesson() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { session } = useAuth();
  const { react } = useMascot();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [lesson, setLesson] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [prog, setProg] = useState(null);
  const [attStatus, setAttStatus] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState({ path: null, name: null });
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const ok = await supabase.rpc('has_self_study', { p_lesson: id });
    if (ok.error || !ok.data) { setAllowed(false); setLoading(false); return; }
    setAllowed(true);

    const [l, m, p, a] = await Promise.all([
      supabase.from('lessons').select('*, groups(name)').eq('id', id).maybeSingle(),
      supabase.from('lesson_materials').select('*').eq('lesson_id', id).order('sort_order').order('title'),
      supabase.from('self_study_progress').select('*').eq('lesson_id', id).maybeSingle(),
      supabase.from('attendance').select('status').eq('lesson_id', id).maybeSingle(),
    ]);
    setLesson(l.data);
    setMaterials(m.data || []);
    setProg(p.data || null);
    setAttStatus(a.data?.status || null);
    setText(p.data?.answer_text || '');
    setFile({ path: p.data?.file_path || null, name: p.data?.file_name || null });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setUploading(true);
    const path = `selfstudy/${session.user.id}/${id}-${Date.now()}-${safeName(f.name)}`;
    const { error: err } = await supabase.storage.from('materials').upload(path, f);
    setUploading(false);
    if (err) return setError(err.message);
    setFile({ path, name: f.name });
  }

  async function submit() {
    setError(''); setMsg('');
    setBusy(true);
    const { error: err } = await supabase.rpc('complete_self_study', {
      p_lesson: id, p_text: text, p_file_path: file.path, p_file_name: file.name,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setMsg(t('ss.done'));
    if (!prog) react('lessonDone');
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!allowed || !lesson) {
    return (
      <>
        <p><Link className="link" to="/student/selfstudy">← {t('lesson.back')}</Link></p>
        <p className="muted">{t('ss.notEnabled')}</p>
      </>
    );
  }

  const reviewed = !!prog?.reviewed_at;

  return (
    <>
      <p><Link className="link" to="/student/selfstudy">← {t('lesson.back')}</Link></p>
      <h1>{lesson.title}</h1>
      <p className="muted">{fmtDateTime(lesson.starts_at, lang)} · {lesson.groups?.name}</p>
      <p className="muted">
        {attStatus
          ? t('ss.attNote', { status: t(`att.${attStatus}`) })
          : t('ss.attNone')}
      </p>

      {lesson.homework_note && (
        <div className="card">
          <h2>{t('student.homework')}</h2>
          <div className="pre">{lesson.homework_note}</div>
        </div>
      )}

      {materials.length === 0 && <p className="muted">{t('ss.noMaterials')}</p>}
      {materials.map((m) => <LessonMaterialItem key={m.id} m={m} />)}

      <div className="card">
        <h2>{t('ss.yourWork')}</h2>

        {prog && (
          <p>
            <span className="badge status-completed">{t('ss.studied')}</span>{' '}
            <span className="muted">{t('ss.studiedOn', { date: fmtDateTime(prog.studied_at, lang) })}</span>
            {reviewed && <span className="badge"> {t('ss.reviewed')}</span>}
          </p>
        )}

        {prog?.feedback && (
          <div className="key-box">
            <strong>{t('ss.feedbackTitle')}:</strong>
            <div className="pre">{prog.feedback}</div>
          </div>
        )}

        {reviewed ? (
          <>
            {prog.answer_text && <div className="answer-box">{prog.answer_text}</div>}
            {prog.file_path && <FileLink path={prog.file_path} name={prog.file_name} />}
          </>
        ) : (
          <>
            <p className="muted">{t('ss.workHint')}</p>
            <textarea rows="8" value={text} onChange={(e) => setText(e.target.value)} />
            {file.path && (
              <div className="row" style={{ marginBottom: 12 }}>
                <FileLink path={file.path} name={file.name} />
                <button
                  type="button" className="link"
                  onClick={() => { setFile({ path: null, name: null }); setFileKey((k) => k + 1); }}
                >
                  ✕
                </button>
              </div>
            )}
            <input key={fileKey} type="file" onChange={onFile} />
            <p className="muted">{uploading ? t('hw.uploading') : t('hw.fileHint')}</p>
            {error && <div className="error">{error}</div>}
            {msg && <div className="success">{msg}</div>}
            <button className="btn btn-auto" disabled={busy || uploading} onClick={submit}>
              {prog ? t('ss.update') : t('ss.submit')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
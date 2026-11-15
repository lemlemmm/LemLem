import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { safeName } from '../../lib/files';
import { effectiveStatus, formatValue, isAnswered } from '../../lib/homework';
import QuestionInput from '../../components/QuestionInput';
import FileLink from '../../components/FileLink';
import { useMascot } from '../../mascot/MascotContext';

export default function HomeworkDo() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { session } = useAuth();
  const { react } = useMascot();
  const [loading, setLoading] = useState(true);
  const [hw, setHw] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sub, setSub] = useState(null);
  const [answers, setAnswers] = useState({});
  const [file, setFile] = useState({ path: null, name: null });
  const [fileKey, setFileKey] = useState(0);
  const [key, setKey] = useState({}); // question id -> correct answer (only after checked)
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: h } = await supabase.from('homework').select('*').eq('id', id).maybeSingle();
    if (!h) { setHw(null); setLoading(false); return; }
    const [q, s] = await Promise.all([
      supabase.from('student_homework_questions').select('*').eq('homework_id', id).order('sort_order'),
      supabase.from('homework_submissions').select('*').eq('homework_id', id).maybeSingle(),
    ]);
    setHw(h);
    setQuestions(q.data || []);
    setSub(s.data || null);
    setAnswers(s.data?.answers || {});
    setFile({ path: s.data?.file_path || null, name: s.data?.file_name || null });

    if (s.data?.status === 'checked') {
      const { data: k } = await supabase.rpc('homework_answer_key', { p_homework: id });
      const map = {};
      (k || []).forEach((r) => { map[r.question_id] = r.correct_answer; });
      setKey(map);
    } else {
      setKey({});
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setAnswer = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));

  async function persist(submit) {
    setError(''); setMsg('');
    if (submit) {
      const empty = questions.filter((q) => !isAnswered(q, answers[q.id])).length;
      const text = empty > 0 ? t('hw.confirmEmpty', { n: empty }) : t('hw.confirmSubmit');
      if (!window.confirm(text)) return;
    }
    setBusy(true);
    const { error: err } = await supabase.rpc('save_homework', {
      p_homework: id,
      p_answers: answers,
      p_submit: submit,
      p_file_path: file.path,
      p_file_name: file.name,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setMsg(submit ? t('hw.submittedMsg') : t('hw.draftSaved'));
    if (submit) react('homeworkDone');
    await load();
    if (submit) window.scrollTo({ top: 0 });
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setUploading(true);
    const path = `submissions/${session.user.id}/${id}-${Date.now()}-${safeName(f.name)}`;
    const { error: err } = await supabase.storage.from('materials').upload(path, f);
    setUploading(false);
    if (err) return setError(err.message);
    setFile({ path, name: f.name });
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!hw) return <p className="muted">{t('hw.notFound')}</p>;

  const editable = !sub || ['in_progress', 'not_started'].includes(sub.status);
  const eff = effectiveStatus(hw, sub);
  const checked = sub?.status === 'checked';

  return (
    <>
      <p><Link className="link" to="/student/homework">← {t('lesson.back')}</Link></p>
      <h1>{hw.title}</h1>
      <p>
        <span className={`badge hws-${eff}`}>{t(`hwstatus.${eff}`)}</span>
        {sub?.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
        <span className="muted">
          {' '}{hw.deadline ? t('hw.deadlineOn', { date: fmtDateTime(hw.deadline, lang) }) : t('hw.noDeadline')}
        </span>
      </p>

      {editable && eff === 'overdue' && <div className="error">{t('hw.overdueWarn')}</div>}
      {sub?.status === 'submitted' && <div className="card credentials"><strong>{t('hw.waiting')}</strong></div>}

      {checked && (
        <div className="card credentials">
          <div className="muted">{t('hw.yourScore')}</div>
          <div className="score-big">{sub.final_score} / {hw.max_score}</div>
        </div>
      )}

      {sub?.feedback && (
        <div className="card">
          <h2>{t('hw.teacherFeedback')}</h2>
          <div className="pre">{sub.feedback}</div>
        </div>
      )}

      {(hw.description || hw.instructions || hw.file_path) && (
        <div className="card">
          {hw.description && <div className="pre">{hw.description}</div>}
          {hw.instructions && (
            <>
              <h2>{t('hw.instructionsTitle')}</h2>
              <div className="pre">{hw.instructions}</div>
            </>
          )}
          <FileLink path={hw.file_path} name={hw.file_name} />
        </div>
      )}

      {questions.map((q, i) => {
        const r = sub?.results?.[q.id];
        const fullyRight = r && !r.manual && r.earned >= r.max;
        return (
          <div className="card" key={q.id}>
            <div className="row space-between">
              <strong>{t('hw.qn', { n: i + 1 })}</strong>
              {checked && r && (
                r.manual
                  ? <span className="badge">{t('hw.byTeacher')}</span>
                  : <span className={`badge ${fullyRight ? 'result-ok' : r.earned > 0 ? 'result-part' : 'result-bad'}`}>
                      {fullyRight ? `✓ ${t('hw.correct')}` : r.earned > 0
                        ? t('hw.partial', { a: r.earned, b: r.max })
                        : `✗ ${t('hw.incorrect')}`}
                    </span>
              )}
            </div>

            {(q.type !== 'gap_fill' || !editable) && <div className="pre q-prompt">{q.prompt}</div>}

            {editable ? (
              <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            ) : (
              <div className="answer-box">
                <strong>{t('hw.yourAnswer')}:</strong>{'\n'}{formatValue(q, answers[q.id], t)}
              </div>
            )}

            {checked && !fullyRight && key[q.id] !== undefined && key[q.id] !== null && q.type !== 'writing'
              && !(r?.manual) && (
              <div className="key-box">
                <strong>{t('hw.rightAnswer')}:</strong>{'\n'}{formatValue(q, key[q.id], t)}
              </div>
            )}
          </div>
        );
      })}

      {editable ? (
        <div className="card">
          <h2>{t('hw.fileTitle')}</h2>
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
          <div className="row">
            <button className="btn btn-light btn-auto" disabled={busy || uploading} onClick={() => persist(false)}>
              {t('hw.saveDraft')}
            </button>
            <button className="btn btn-auto" disabled={busy || uploading} onClick={() => persist(true)}>
              {t('hw.submit')}
            </button>
          </div>
        </div>
      ) : (
        sub?.file_path && (
          <div className="card">
            <h2>{t('hw.fileTitle')}</h2>
            <FileLink path={sub.file_path} name={sub.file_name} />
          </div>
        )
      )}
    </>
  );
}
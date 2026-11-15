import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { effectiveStatus, formatValue } from '../../lib/homework';
import FileLink from '../../components/FileLink';

export default function HomeworkSubmission() {
  const { id, studentId } = useParams();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [hw, setHw] = useState(null);
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [sub, setSub] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [h, q, s, p] = await Promise.all([
      supabase.from('homework').select('*').eq('id', id).maybeSingle(),
      supabase.from('homework_questions').select('*').eq('homework_id', id).order('sort_order'),
      supabase.from('homework_submissions').select('*').eq('homework_id', id).eq('student_id', studentId).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
    ]);
    setHw(h.data);
    setQuestions(q.data || []);
    setSub(s.data || null);
    setName(p.data?.full_name || '');
    setScore(String(s.data?.final_score ?? s.data?.auto_score ?? 0));
    setFeedback(s.data?.feedback || '');
    setLoading(false);
  }, [id, studentId]);

  useEffect(() => { load(); }, [load]);

  async function saveChecked() {
    setError(''); setMsg('');
    const n = Number(score);
    if (score === '' || isNaN(n) || n < 0 || n > hw.max_score) {
      return setError(t('hw.scoreRange', { n: hw.max_score }));
    }
    const { error: err } = await supabase.from('homework_submissions').update({
      final_score: n,
      feedback: feedback.trim() || null,
      status: 'checked',
      checked_at: new Date().toISOString(),
    }).eq('id', sub.id);
    if (err) return setError(err.message);
    setMsg(t('hw.checkedSaved'));
    load();
  }

  async function reopen() {
    setError(''); setMsg('');
    const { error: err } = await supabase.from('homework_submissions').update({
      status: 'in_progress',
      final_score: null, auto_score: null, results: null,
      checked_at: null, submitted_at: null,
      feedback: feedback.trim() || null,
    }).eq('id', sub.id);
    if (err) return setError(err.message);
    setMsg(t('hw.reopened'));
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!hw) return <p className="muted">{t('hw.notFound')}</p>;

  const eff = effectiveStatus(hw, sub);
  const canGrade = sub && ['submitted', 'checked'].includes(sub.status);

  return (
    <>
      <p><Link className="link" to={`/teacher/homework/${id}`}>← {t('lesson.back')}</Link></p>
      <h1>{name}</h1>
      <p className="muted">{hw.title}</p>
      <p>
        <span className={`badge hws-${eff}`}>{t(`hwstatus.${eff}`)}</span>
        {sub?.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
        {sub?.submitted_at && <span className="muted"> · {fmtDateTime(sub.submitted_at, lang)}</span>}
      </p>

      {!canGrade && <p className="muted">{t('hw.notSubmitted')}</p>}

      {canGrade && (
        <>
          {questions.map((q, i) => {
            const r = sub.results?.[q.id];
            const manual = r?.manual;
            const showKey = !manual && q.type !== 'writing';
            return (
              <div className="card" key={q.id}>
                <div className="row space-between">
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{t('hw.qn', { n: i + 1 })}</strong>
                    <span className="badge">{t(`hw.type.${q.type}`)}</span>
                  </div>
                  {r && (manual
                    ? <span className="badge badge-warn">{t('hw.needsTeacher')}</span>
                    : <span className={`badge ${r.earned >= r.max ? 'result-ok' : r.earned > 0 ? 'result-part' : 'result-bad'}`}>
                        {r.earned} / {r.max}
                      </span>)}
                </div>
                <div className="pre">{q.prompt}</div>
                <div className="answer-box">
                  <strong>{t('hw.studentAnswer')}:</strong>{'\n'}
                  {sub.answers?.[q.id] === undefined ? t('hw.noAnswer') : formatValue(q, sub.answers[q.id], t)}
                </div>
                {showKey && (
                  <div className="key-box">
                    <strong>{t('hw.correctAnswer')}:</strong>{'\n'}{formatValue(q, q.correct_answer, t)}
                  </div>
                )}
              </div>
            );
          })}

          {sub.file_path && (
            <div className="card">
              <h2>{t('hw.attachedFile')}</h2>
              <FileLink path={sub.file_path} name={sub.file_name} />
            </div>
          )}

          <div className="card">
            <h2>{t('hw.gradeTitle')}</h2>
            <p className="muted">{t('hw.autoScore', { n: `${sub.auto_score ?? 0} / ${hw.max_score}` })}</p>
            <label>{t('hw.finalScore')} (0 – {hw.max_score})</label>
            <input
              type="number" min="0" max={hw.max_score} step="0.5" value={score}
              onChange={(e) => setScore(e.target.value)} style={{ maxWidth: 200 }}
            />
            <label>{t('hw.feedback')}</label>
            <textarea rows="4" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            {error && <div className="error">{error}</div>}
            {msg && <div className="success">{msg}</div>}
            <div className="row">
              <button className="btn btn-auto" onClick={saveChecked}>{t('hw.markChecked')}</button>
              <button className="btn btn-light btn-auto" onClick={reopen}>{t('hw.reopen')}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
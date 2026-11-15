import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { formatValue } from '../../lib/homework';

export default function TestSubmission() {
  const { id, studentId } = useParams();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState(null);
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [sub, setSub] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [tt, q, s, p] = await Promise.all([
      supabase.from('tests').select('*').eq('id', id).maybeSingle(),
      supabase.from('test_questions').select('*').eq('test_id', id).order('sort_order'),
      supabase.from('test_submissions').select('*').eq('test_id', id).eq('student_id', studentId).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
    ]);
    setTest(tt.data);
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
    if (score === '' || isNaN(n) || n < 0 || n > test.max_score) {
      return setError(t('hw.scoreRange', { n: test.max_score }));
    }
    const { error: err } = await supabase.from('test_submissions').update({
      final_score: n,
      feedback: feedback.trim() || null,
      status: 'checked',
      checked_at: new Date().toISOString(),
    }).eq('id', sub.id);
    if (err) return setError(err.message);
    setMsg(t('hw.checkedSaved'));
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!test) return <p className="muted">{t('test.notFound')}</p>;

  const canGrade = sub && ['submitted', 'checked'].includes(sub.status);
  const tabs = sub?.violations?.tab_switches ?? 0;
  const fs = sub?.violations?.fullscreen_exits ?? 0;
  const events = Array.isArray(sub?.violations?.events) ? sub.violations.events : [];

  return (
    <>
      <p><Link className="link" to={`/teacher/tests/${id}`}>← {t('lesson.back')}</Link></p>
      <h1>{name}</h1>
      <p className="muted">{test.title}</p>

      {!canGrade && <p className="muted">{t('hw.notSubmitted')}</p>}

      {canGrade && (
        <>
          <div className="card">
            <p>
              <span className={`badge hws-${sub.status}`}>{t(`hwstatus.${sub.status}`)}</span>
              {sub.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
            </p>
            <p className="muted">
              {t('test.startedAt')}: {fmtDateTime(sub.started_at, lang)} · {t('test.submittedAt')}: {fmtDateTime(sub.submitted_at, lang)}
            </p>
            <h2>{t('test.monitoring')}</h2>
            <p>{t('test.tabSwitches', { n: tabs })} · {t('test.fsExits', { n: fs })}</p>
            {events.slice(0, 20).map((ev, i) => (
              <div className="muted" key={i}>
                {fmtDateTime(ev.t, lang)}: {t(`test.ev.${ev.type}`)}
              </div>
            ))}
            <p className="muted">{t('test.monitorNote')}</p>
          </div>

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

          <div className="card">
            <h2>{t('hw.gradeTitle')}</h2>
            <p className="muted">{t('hw.autoScore', { n: `${sub.auto_score ?? 0} / ${test.max_score}` })}</p>
            <label>{t('hw.finalScore')} (0 – {test.max_score})</label>
            <input
              type="number" min="0" max={test.max_score} step="0.5" value={score}
              onChange={(e) => setScore(e.target.value)} style={{ maxWidth: 200 }}
            />
            <label>{t('hw.feedback')}</label>
            <textarea rows="4" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            {error && <div className="error">{error}</div>}
            {msg && <div className="success">{msg}</div>}
            <button className="btn btn-auto" onClick={saveChecked}>{t('hw.markChecked')}</button>
          </div>
        </>
      )}
    </>
  );
}
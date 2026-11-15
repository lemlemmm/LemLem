import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { useMascot } from '../../mascot/MascotContext';
import { fmtDateTime } from '../../lib/dates';
import { formatValue, isAnswered } from '../../lib/homework';
import { testWindow } from '../../lib/tests';
import QuestionInput from '../../components/QuestionInput';

const EMPTY_VIOL = { tab_switches: 0, fullscreen_exits: 0, events: [] };

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsSupported = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

function enterFullscreen() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
    if (p && p.catch) p.catch(() => {});
  } catch (_) { /* not supported */ }
}

function exitFullscreen() {
  try {
    if (!fsElement()) return;
    const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.();
    if (p && p.catch) p.catch(() => {});
  } catch (_) { /* ignore */ }
}

const mmss = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export default function TestTake() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { react } = useMascot();

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('intro'); // intro | taking | done
  const [test, setTest] = useState(null);
  const [sub, setSub] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [key, setKey] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [viol, setViol] = useState(EMPTY_VIOL);
  const [warning, setWarning] = useState('');
  const [needFs, setNeedFs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const answersRef = useRef({});
  const violRef = useRef(EMPTY_VIOL);
  const endRef = useRef(0);          // end time in this computer's clock (ms)
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const fsEnteredRef = useRef(false);

  const load = useCallback(async () => {
    const { data: tt } = await supabase.from('tests').select('*').eq('id', id).maybeSingle();
    if (!tt) { setTest(null); setLoading(false); return; }
    const { data: s } = await supabase.from('test_submissions').select('*').eq('test_id', id).maybeSingle();
    setTest(tt);
    setSub(s || null);

    if (!s) { setPhase('intro'); setLoading(false); return; }

    const { data: q } = await supabase
      .from('student_test_questions').select('*').eq('test_id', id).order('sort_order');
    setQuestions(q || []);

    if (s.status === 'in_progress') {
      // Ask the server for the start time and clock, so a refresh cannot reset the timer
      const { data: info, error: err } = await supabase.rpc('start_test', { p_test: id });
      if (err) { setError(err.message); setLoading(false); return; }
      const leftMs =
        new Date(info.started_at).getTime() + info.time_limit_min * 60000 - new Date(info.server_now).getTime();
      endRef.current = Date.now() + leftMs;
      const v = { ...EMPTY_VIOL, ...(info.violations || {}) };
      v.events = Array.isArray(v.events) ? v.events : [];
      violRef.current = v;
      answersRef.current = info.answers || {};
      setViol(v);
      setAnswers(info.answers || {});
      setPhase('taking');
    } else {
      setAnswers(s.answers || {});
      setPhase('done');
      if (s.status === 'checked') {
        const { data: k } = await supabase.rpc('test_answer_key', { p_test: id });
        const map = {};
        (k || []).forEach((r) => { map[r.question_id] = r.correct_answer; });
        setKey(map);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (submittingRef.current) return;
    dirtyRef.current = false;
    await supabase.rpc('save_test_progress', {
      p_test: id, p_answers: answersRef.current, p_viol: violRef.current,
    });
  }, [id]);

  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    exitFullscreen();
    const { error: err } = await supabase.rpc('submit_test', {
      p_test: id, p_answers: answersRef.current, p_viol: violRef.current,
    });
    if (err && !String(err.message).includes('Already submitted')) {
      submittingRef.current = false; // allow another try
      setBusy(false);
      setError(err.message);
      return;
    }
    setNeedFs(false);
    setWarning('');
    await load();
    setBusy(false);
    window.scrollTo({ top: 0 });
    if (!err) react('lessonDone');
  }, [id, load, react]);

  function setAnswer(qid, val) {
    const next = { ...answersRef.current, [qid]: val };
    answersRef.current = next;
    dirtyRef.current = true;
    setAnswers(next);
  }

  async function start() {
    setError('');
    setBusy(true);
    enterFullscreen(); // must happen right inside the click
    const { error: err } = await supabase.rpc('start_test', { p_test: id });
    if (err) {
      exitFullscreen();
      setBusy(false);
      return setError(err.message);
    }
    await load();
    setBusy(false);
  }

  function confirmSubmit() {
    const empty = questions.filter((q) => !isAnswered(q, answers[q.id])).length;
    const text = empty > 0 ? t('hw.confirmEmpty', { n: empty }) : t('hw.confirmSubmit');
    if (window.confirm(text)) doSubmit();
  }

  // Countdown (server-based end time); submits automatically at zero
  useEffect(() => {
    if (phase !== 'taking') return undefined;
    const tick = () => {
      const s = Math.ceil((endRef.current - Date.now()) / 1000);
      setRemaining(Math.max(s, 0));
      if (s <= 0) doSubmit();
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [phase, doSubmit]);

  // Autosave every 10 seconds when something changed
  useEffect(() => {
    if (phase !== 'taking') return undefined;
    const iv = setInterval(() => { if (dirtyRef.current) save(); }, 10000);
    return () => clearInterval(iv);
  }, [phase, save]);

  // Warn before closing the page while taking the test
  useEffect(() => {
    if (phase !== 'taking') return undefined;
    const on = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [phase]);

  // Count tab switches and fullscreen exits
  useEffect(() => {
    if (phase !== 'taking') return undefined;

    const record = (type) => {
      const v = violRef.current;
      const next = {
        ...v,
        events: [...(v.events || []), { t: new Date().toISOString(), type }].slice(-20),
      };
      if (type === 'tab') next.tab_switches = (v.tab_switches || 0) + 1;
      else next.fullscreen_exits = (v.fullscreen_exits || 0) + 1;
      violRef.current = next;
      setViol(next);
      save();
    };

    const onVisibility = () => {
      if (document.hidden && !submittingRef.current) {
        record('tab');
        setWarning('tab');
      }
    };
    const onFullscreen = () => {
      if (fsElement()) {
        fsEnteredRef.current = true;
        setNeedFs(false);
      } else if (fsEnteredRef.current && !submittingRef.current) {
        record('fullscreen');
        setWarning('fullscreen');
        setNeedFs(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('webkitfullscreenchange', onFullscreen);

    // If the page was reloaded, ask to go fullscreen again (no violation is recorded)
    const check = setTimeout(() => {
      if (fsSupported() && !fsElement() && !submittingRef.current) setNeedFs(true);
    }, 900);

    return () => {
      clearTimeout(check);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('webkitfullscreenchange', onFullscreen);
    };
  }, [phase, save]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (!test) return <p className="muted">{t('test.notFound')}</p>;

  // ---------- 1. Instructions ----------
  if (phase === 'intro') {
    const win = testWindow(test);
    return (
      <>
        <p><Link className="link" to="/student/tests">← {t('lesson.back')}</Link></p>
        <h1>{test.title}</h1>
        {test.description && <p className="pre">{test.description}</p>}

        <div className="card">
          <h2>{t('test.rulesTitle')}</h2>
          <ul className="rules">
            <li>{t('test.rule.time', { n: test.time_limit_min })}</li>
            <li>{t('test.rule.once')}</li>
            <li>{t('test.rule.fs')}</li>
            <li>{t('test.rule.save')}</li>
          </ul>
          {test.instructions && (
            <>
              <h2>{t('hw.instructionsTitle')}</h2>
              <div className="pre">{test.instructions}</div>
            </>
          )}
        </div>

        {win === 'upcoming' && (
          <p className="error">
            {t('test.notOpen')} {test.opens_at && t('test.opensOn', { date: fmtDateTime(test.opens_at, lang) })}
          </p>
        )}
        {win === 'closed' && <p className="error">{t('test.closedMsg')}</p>}
        {error && <div className="error">{error}</div>}

        <button className="btn btn-auto" disabled={busy || win !== 'open'} onClick={start}>
          {t('test.start')}
        </button>
      </>
    );
  }

  // ---------- 3. Finished ----------
  if (phase === 'done') {
    const checked = sub?.status === 'checked';
    return (
      <>
        <p><Link className="link" to="/student/tests">← {t('lesson.back')}</Link></p>
        <h1>{test.title}</h1>
        <p>
          <span className={`badge hws-${sub.status}`}>{t(`hwstatus.${sub.status}`)}</span>
          {sub.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
          {sub.submitted_at && <span className="muted"> · {fmtDateTime(sub.submitted_at, lang)}</span>}
        </p>

        {!checked && <div className="card credentials"><strong>{t('hw.waiting')}</strong></div>}

        {checked && (
          <div className="card credentials">
            <div className="muted">{t('hw.yourScore')}</div>
            <div className="score-big">{sub.final_score} / {test.max_score}</div>
          </div>
        )}

        {sub.feedback && (
          <div className="card">
            <h2>{t('hw.teacherFeedback')}</h2>
            <div className="pre">{sub.feedback}</div>
          </div>
        )}

        {questions.map((q, i) => {
          const r = checked ? sub.results?.[q.id] : null;
          const fullyRight = r && !r.manual && r.earned >= r.max;
          return (
            <div className="card" key={q.id}>
              <div className="row space-between">
                <strong>{t('hw.qn', { n: i + 1 })}</strong>
                {r && (r.manual
                  ? <span className="badge">{t('hw.byTeacher')}</span>
                  : <span className={`badge ${fullyRight ? 'result-ok' : r.earned > 0 ? 'result-part' : 'result-bad'}`}>
                      {fullyRight ? `✓ ${t('hw.correct')}` : r.earned > 0
                        ? t('hw.partial', { a: r.earned, b: r.max })
                        : `✗ ${t('hw.incorrect')}`}
                    </span>)}
              </div>
              <div className="pre q-prompt">{q.prompt}</div>
              <div className="answer-box">
                <strong>{t('hw.yourAnswer')}:</strong>{'\n'}
                {answers[q.id] === undefined ? t('hw.noAnswer') : formatValue(q, answers[q.id], t)}
              </div>
              {checked && !fullyRight && !(r?.manual) && q.type !== 'writing'
                && key[q.id] !== undefined && key[q.id] !== null && (
                <div className="key-box">
                  <strong>{t('hw.rightAnswer')}:</strong>{'\n'}{formatValue(q, key[q.id], t)}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  // ---------- 2. Taking the test ----------
  const low = remaining !== null && remaining <= 60;
  return (
    <>
      <div className="test-bar">
        <div>
          <div className="muted">{t('test.timeLeft')}</div>
          <div className={`timer ${low ? 'low' : ''}`}>{remaining === null ? '--:--' : mmss(remaining)}</div>
        </div>
        <div className="muted test-bar-note">{t('test.autosave')}</div>
      </div>

      <h1>{test.title}</h1>

      {warning && (
        <div className="banner-warn">
          <span>{t(`test.warn.${warning}`)}</span>
          <button type="button" className="btn btn-light btn-auto btn-small" onClick={() => setWarning('')}>
            {t('test.dismiss')}
          </button>
        </div>
      )}
      {needFs && (
        <div className="banner-warn">
          <span>{t('test.needFs')}</span>
          <button type="button" className="btn btn-auto btn-small" onClick={enterFullscreen}>
            {t('test.returnFs')}
          </button>
        </div>
      )}

      {questions.map((q, i) => (
        <div className="card" key={q.id}>
          <strong>{t('hw.qn', { n: i + 1 })}</strong>
          {q.type !== 'gap_fill' && <div className="pre q-prompt">{q.prompt}</div>}
          <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
        </div>
      ))}

      {error && <div className="error">{error}</div>}
      <button className="btn btn-auto" disabled={busy} onClick={confirmSubmit}>{t('test.submitNow')}</button>
    </>
  );
}
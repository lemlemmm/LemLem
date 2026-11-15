import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { toLocalInput } from '../../lib/dates';
import { formatValue } from '../../lib/homework';
import { attemptOver } from '../../lib/tests';
import QuestionEditor from '../../components/QuestionEditor';

export default function TestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [test, setTest] = useState(null);
  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: tt } = await supabase.from('tests').select('*, groups(name)').eq('id', id).maybeSingle();
    if (!tt) { setNotFound(true); setLoading(false); return; }

    const [q, s, gm] = await Promise.all([
      supabase.from('test_questions').select('*').eq('test_id', id).order('sort_order'),
      supabase.from('test_submissions')
        .select('student_id, status, final_score, is_late, violations, started_at')
        .eq('test_id', id),
      supabase.from('group_members').select('student_id, profiles(full_name)').eq('group_id', tt.group_id),
    ]);

    const subBy = {};
    (s.data || []).forEach((x) => { subBy[x.student_id] = x; });
    const list = (gm.data || [])
      .map((m) => ({ id: m.student_id, name: m.profiles?.full_name || '', sub: subBy[m.student_id] || null }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setTest(tt);
    setForm({
      title: tt.title, description: tt.description || '', instructions: tt.instructions || '',
      max_score: tt.max_score, time_limit_min: tt.time_limit_min,
      opens_at: tt.opens_at ? toLocalInput(tt.opens_at) : '',
      closes_at: tt.closes_at ? toLocalInput(tt.closes_at) : '',
    });
    setQuestions(q.data || []);
    setRows(list);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const locked = rows.some((r) => r.sub);
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  async function save() {
    setError(''); setMsg('');
    const max = Number(form.max_score);
    const limit = Number(form.time_limit_min);
    if (!Number.isInteger(max) || max < 1) return setError(t('hw.err.max'));
    if (!Number.isInteger(limit) || limit < 1 || limit > 300) return setError(t('test.err.limit'));
    if (form.opens_at && form.closes_at && new Date(form.closes_at) <= new Date(form.opens_at)) {
      return setError(t('test.err.dates'));
    }
    const { error: err } = await supabase.from('tests').update({
      title: form.title.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      max_score: max,
      time_limit_min: limit,
      opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
      closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
    }).eq('id', id);
    if (err) return setError(err.message);
    setMsg(t('hw.saved'));
    load();
  }

  async function addQuestion(q) {
    const sort = questions.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1;
    const { error: err } = await supabase.from('test_questions').insert({ ...q, test_id: id, sort_order: sort });
    if (err) return err.message;
    await load();
    return null;
  }

  async function deleteQuestion(qid) {
    if (!window.confirm(t('hw.confirmDeleteQuestion'))) return;
    const { error: err } = await supabase.from('test_questions').delete().eq('id', qid);
    if (err) return setError(err.message);
    load();
  }

  async function deleteTest() {
    if (!window.confirm(t('test.confirmDelete'))) return;
    const { error: err } = await supabase.from('tests').delete().eq('id', id);
    if (err) return setError(err.message);
    navigate('/teacher/tests');
  }

  async function finalize(studentId) {
    if (!window.confirm(t('test.confirmFinalize'))) return;
    setError('');
    const { error: err } = await supabase.rpc('teacher_finalize_test', { p_test: id, p_student: studentId });
    if (err) return setError(err.message);
    load();
  }

  async function retake(studentId) {
    if (!window.confirm(t('test.confirmRetake'))) return;
    setError('');
    const { error: err } = await supabase
      .from('test_submissions').delete().eq('test_id', id).eq('student_id', studentId);
    if (err) return setError(err.message);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (notFound) return <p className="muted">{t('test.notFound')}</p>;

  return (
    <>
      <p><Link className="link" to="/teacher/tests">← {t('lesson.back')}</Link></p>
      <h1>{test.title}</h1>
      <p className="muted">{test.groups?.name}</p>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>{t('test.details')}</h2>
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
            <label>{t('test.timeLimit')}</label>
            <input type="number" min="1" max="300" step="1" value={form.time_limit_min} onChange={set('time_limit_min')} />
          </div>
          <div />
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
        {msg && <div className="success">{msg}</div>}
        <div className="row">
          <button className="btn btn-auto" onClick={save}>{t('lesson.save')}</button>
          <button className="btn btn-danger btn-auto" onClick={deleteTest}>{t('test.delete')}</button>
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

      {locked ? <p className="muted">{t('test.locked')}</p> : <QuestionEditor onAdd={addQuestion} />}

      <div className="card">
        <h2>{t('test.results')}</h2>
        {rows.length === 0 && <p className="muted">{t('hw.noStudents')}</p>}
        {rows.map((r) => {
          const st = r.sub?.status || 'not_started';
          const over = attemptOver(test, r.sub);
          const tabs = r.sub?.violations?.tab_switches ?? 0;
          const fs = r.sub?.violations?.fullscreen_exits ?? 0;
          return (
            <div className="list-row" key={r.id}>
              <div className="row space-between">
                <div>
                  <strong>{r.name}</strong>{' '}
                  <span className={`badge hws-${st}`}>{t(`hwstatus.${st}`)}</span>
                  {over && <span className="badge badge-warn">{t('test.timeOver')}</span>}
                  {r.sub?.is_late && <span className="badge badge-warn">{t('hw.late')}</span>}
                  {st === 'checked' && <span className="muted"> · {r.sub.final_score} / {test.max_score}</span>}
                  {(tabs > 0 || fs > 0) && (
                    <div className="muted">
                      {t('test.tabSwitches', { n: tabs })} · {t('test.fsExits', { n: fs })}
                    </div>
                  )}
                </div>
                <div className="row">
                  {['submitted', 'checked'].includes(st) && (
                    <Link className="btn btn-light btn-auto btn-small" to={`/teacher/tests/${id}/submissions/${r.id}`}>
                      {t('hw.review')}
                    </Link>
                  )}
                  {over && (
                    <button className="btn btn-auto btn-small" onClick={() => finalize(r.id)}>{t('test.finalize')}</button>
                  )}
                  {r.sub && (
                    <button className="link" onClick={() => retake(r.id)}>{t('test.retake')}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
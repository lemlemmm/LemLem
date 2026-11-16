import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LanguageContext';
import { fmtDateTime } from '../lib/dates';
import AttendanceBadge from './AttendanceBadge';
import FileLink from './FileLink';

function Review({ p, onSaved }) {
  const { t, lang } = useLang();
  const [fb, setFb] = useState(p.feedback || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setErr(''); setMsg(''); setBusy(true);
    const { error } = await supabase.from('self_study_progress')
      .update({ feedback: fb.trim() || null, reviewed_at: new Date().toISOString() })
      .eq('id', p.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(t('ss.saved'));
    onSaved();
  }

  return (
    <div className="key-box">
      <strong>{t('ss.work')}</strong>
      <span className="muted"> · {fmtDateTime(p.studied_at, lang)}</span>
      {p.answer_text && <div className="pre">{p.answer_text}</div>}
      {p.file_path && <FileLink path={p.file_path} name={p.file_name} />}
      <label style={{ marginTop: 10 }}>{t('ss.feedback')}</label>
      <textarea rows="3" value={fb} onChange={(e) => setFb(e.target.value)} />
      {err && <div className="error">{err}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="row">
        <button className="btn btn-auto btn-small" disabled={busy} onClick={save}>{t('ss.saveFeedback')}</button>
        {p.reviewed_at && <span className="muted">{t('ss.reviewedOn')}: {fmtDateTime(p.reviewed_at, lang)}</span>}
      </div>
    </div>
  );
}

export default function SelfStudyPanel({ lessonId, groupId }) {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState([]);
  const [members, setMembers] = useState([]);
  const [att, setAtt] = useState({});
  const [prog, setProg] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [a, gm, at, pr] = await Promise.all([
      supabase.from('self_study_access').select('id, student_id').eq('lesson_id', lessonId),
      supabase.from('group_members').select('student_id, profiles(full_name)').eq('group_id', groupId),
      supabase.from('attendance').select('student_id, status').eq('lesson_id', lessonId),
      supabase.from('self_study_progress').select('*').eq('lesson_id', lessonId),
    ]);
    const err = a.error || gm.error || at.error || pr.error;
    if (err) setError(err.message);
    setAccess(a.data || []);
    setMembers(
      (gm.data || [])
        .map((m) => ({ id: m.student_id, name: m.profiles?.full_name || '' }))
        .sort((x, y) => x.name.localeCompare(y.name))
    );
    const attMap = {};
    (at.data || []).forEach((x) => { attMap[x.student_id] = x; });
    const progMap = {};
    (pr.data || []).forEach((x) => { progMap[x.student_id] = x; });
    setAtt(attMap);
    setProg(progMap);
    setLoading(false);
  }, [lessonId, groupId]);

  useEffect(() => { load(); }, [load]);

  async function add(studentId) {
    setError('');
    const { error: err } = await supabase.from('self_study_access')
      .insert({ lesson_id: lessonId, student_id: studentId });
    if (err && err.code !== '23505') return setError(err.message);
    load();
  }

  async function remove(accessId) {
    setError('');
    const { error: err } = await supabase.from('self_study_access').delete().eq('id', accessId);
    if (err) return setError(err.message);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const groupRow = access.find((a) => !a.student_id);

  return (
    <div className="card">
      <h2>{t('ss.panel')}</h2>
      <p className="muted">{t('ss.hint')}</p>
      {error && <div className="error">{error}</div>}

      {groupRow ? (
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="success" style={{ margin: 0 }}>{t('ss.groupOn')}</span>
          <button className="btn btn-light btn-auto btn-small" onClick={() => remove(groupRow.id)}>
            {t('ss.disableGroup')}
          </button>
        </div>
      ) : (
        <p>
          <button className="btn btn-auto btn-small" onClick={() => add(null)}>{t('ss.enableGroup')}</button>
        </p>
      )}

      {members.length === 0 && <p className="muted">{t('ss.noStudents')}</p>}
      {members.map((m) => {
        const own = access.find((a) => a.student_id === m.id);
        const p = prog[m.id];
        return (
          <div className="list-row" key={m.id}>
            <div className="row space-between">
              <div className="row" style={{ gap: 8 }}>
                <strong>{m.name}</strong>
                {att[m.id] && <AttendanceBadge status={att[m.id].status} />}
                {p && <span className="badge status-completed">{t('ss.studied')}</span>}
              </div>
              <div className="row">
                {groupRow && <span className="muted">{t('ss.viaGroup')}</span>}
                {!groupRow && own && (
                  <>
                    <span className="badge">{t('ss.enabled')}</span>
                    <button className="link" onClick={() => remove(own.id)}>{t('ss.remove')}</button>
                  </>
                )}
                {!groupRow && !own && (
                  <button className="btn btn-light btn-auto btn-small" onClick={() => add(m.id)}>
                    {t('ss.enableStudent')}
                  </button>
                )}
              </div>
            </div>
            {p && <Review key={p.id + (p.reviewed_at || '')} p={p} onSaved={load} />}
          </div>
        );
      })}
    </div>
  );
}
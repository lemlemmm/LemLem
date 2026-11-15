import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import AttendanceBadge from '../../components/AttendanceBadge';

const STATUSES = ['present', 'excused', 'unexcused', 'rescheduled'];

export default function Attendance() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});   // student_id -> attendance row
  const [packages, setPackages] = useState({}); // student_id -> active package balance
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');

  // 1. Groups
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('groups').select('id, name').order('created_at');
      setGroups(data || []);
      if (data?.length) setGroupId(data[0].id);
      setLoading(false);
    })();
  }, []);

  // 2. Lessons of the chosen group (newest first); pick the most recent past lesson
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, starts_at, status')
        .eq('group_id', groupId)
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: false });
      const list = data || [];
      setLessons(list);
      const limit = Date.now() + 60 * 60 * 1000;
      const pick = list.find((l) => new Date(l.starts_at).getTime() <= limit) || list[list.length - 1];
      setLessonId(pick?.id || '');
    })();
  }, [groupId]);

  // 3. Students, attendance, packages and history for the chosen lesson
  const loadSheet = useCallback(async () => {
    if (!groupId || !lessonId) {
      setStudents([]); setRecords({}); setPackages({}); setAudit([]);
      return;
    }
    const { data: gm } = await supabase
      .from('group_members')
      .select('student_id, profiles(full_name)')
      .eq('group_id', groupId);
    const list = (gm || [])
      .map((m) => ({ id: m.student_id, name: m.profiles?.full_name || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(list);
    const ids = list.map((s) => s.id);

    const [att, bal, aud] = await Promise.all([
      supabase.from('attendance').select('id, student_id, status, package_id').eq('lesson_id', lessonId),
      ids.length
        ? supabase.from('package_balance').select('*').in('student_id', ids).eq('is_active', true)
        : Promise.resolve({ data: [] }),
      supabase
        .from('attendance_audit')
        .select('id, student_id, old_status, new_status, changed_at')
        .eq('lesson_id', lessonId)
        .order('changed_at', { ascending: false }),
    ]);

    const rec = {};
    (att.data || []).forEach((a) => { rec[a.student_id] = a; });
    const pk = {};
    (bal.data || []).forEach((b) => { pk[b.student_id] = b; });
    setRecords(rec);
    setPackages(pk);
    setAudit(aud.data || []);
  }, [groupId, lessonId]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  async function mark(studentId, status) {
    setError('');
    const existing = records[studentId];
    if (existing?.status === status) return;
    let err;
    if (existing) {
      const patch = { status };
      if (!existing.package_id && packages[studentId]) patch.package_id = packages[studentId].package_id;
      ({ error: err } = await supabase.from('attendance').update(patch).eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('attendance').insert({
        lesson_id: lessonId,
        student_id: studentId,
        status,
        package_id: packages[studentId]?.package_id || null,
      }));
    }
    if (err) return setError(err.message);
    setSavedId(studentId);
    setTimeout(() => setSavedId(''), 1500);
    loadSheet();
  }

  async function markAllPresent() {
    setError('');
    const rows = students
      .filter((s) => !records[s.id])
      .map((s) => ({
        lesson_id: lessonId,
        student_id: s.id,
        status: 'present',
        package_id: packages[s.id]?.package_id || null,
      }));
    if (rows.length === 0) return;
    const { error: err } = await supabase.from('attendance').insert(rows);
    if (err) return setError(err.message);
    loadSheet();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (groups.length === 0) {
    return (<><h1>{t('nav.attendance')}</h1><p className="muted">{t('att.noGroups')}</p></>);
  }

  const nameOf = (sid) => students.find((s) => s.id === sid)?.name || '—';

  return (
    <>
      <h1>{t('nav.attendance')}</h1>

      <div className="card grid-2">
        <div>
          <label>{t('lesson.group')}</label>
          <select
            value={groupId}
            onChange={(e) => { setGroupId(e.target.value); setLessonId(''); setLessons([]); }}
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label>{t('att.lesson')}</label>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{fmtDateTime(l.starts_at, lang)} — {l.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card legend">
        {STATUSES.map((st) => (
          <p key={st}><AttendanceBadge status={st} /> {t(`att.hint.${st}`)}</p>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {lessons.length === 0 && <p className="muted">{t('att.noLessons')}</p>}
      {lessonId && students.length === 0 && <p className="muted">{t('att.noStudents')}</p>}

      {lessonId && students.length > 0 && (
        <>
          <p>
            <button className="btn btn-light btn-auto btn-small" onClick={markAllPresent}>
              {t('att.markAll')}
            </button>
          </p>

          {students.map((s) => {
            const pkg = packages[s.id];
            const rec = records[s.id];
            return (
              <div className="card" key={s.id}>
                <div className="row space-between">
                  <div>
                    <strong>{s.name}</strong>
                    <div>
                      {!pkg && (
                        <Link className="badge badge-warn" to={`/teacher/payments/${s.id}`}>{t('att.noPackage')}</Link>
                      )}
                      {pkg && Number(pkg.remaining_lessons) <= 0 && (
                        <Link className="badge badge-warn" to={`/teacher/payments/${s.id}`}>{t('att.packageFinished')}</Link>
                      )}
                      {pkg && Number(pkg.remaining_lessons) > 0 && (
                        <span className="muted">{t('att.left', { n: pkg.remaining_lessons })}</span>
                      )}
                    </div>
                  </div>
                  <div className="row">
                    {savedId === s.id && <span className="success-inline">✓ {t('att.saved')}</span>}
                    <select
                      className="att-select"
                      value={rec?.status || ''}
                      onChange={(e) => mark(s.id, e.target.value)}
                    >
                      {!rec && <option value="" disabled>{t('att.notMarked')}</option>}
                      {STATUSES.map((st) => <option key={st} value={st}>{t(`att.${st}`)}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="card">
            <h2>{t('att.history')}</h2>
            {audit.length === 0 && <p className="muted">{t('att.historyEmpty')}</p>}
            {audit.map((a) => (
              <div className="list-row" key={a.id}>
                <strong>{nameOf(a.student_id)}</strong>:{' '}
                {a.old_status ? t(`att.${a.old_status}`) : t('att.notMarked')} → {t(`att.${a.new_status}`)}
                <div className="muted">{fmtDateTime(a.changed_at, lang)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
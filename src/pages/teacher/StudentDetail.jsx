import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { callStudentFunction } from '../../lib/studentApi';
import { genPassword } from '../../lib/util';

export default function StudentDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const { profile: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    const [{ data: p }, { data: st }, { data: gm }, { data: g }, { data: n }] = await Promise.all([
      supabase.from('profiles').select('full_name, email, username').eq('id', id).single(),
      supabase.from('students').select('english_level, lesson_price').eq('id', id).maybeSingle(),
      supabase.from('group_members').select('group_id').eq('student_id', id),
      supabase.from('groups').select('id, name').order('created_at'),
      supabase.from('teacher_notes').select('id, note, created_at').eq('student_id', id).order('created_at', { ascending: false }),
    ]);
    setInfo({
      full_name: p?.full_name || '',
      email: p?.email || '',
      username: p?.username || '',
      english_level: st?.english_level || 'A1',
      lesson_price: st?.lesson_price ?? 2000,
    });
    setGroupId(gm?.[0]?.group_id || '');
    setGroups(g || []);
    setNotes(n || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setInfo({ ...info, [k]: e.target.value });

  async function save() {
    setError(''); setMsg('');
    const r1 = await supabase.from('profiles').update({ full_name: info.full_name.trim() }).eq('id', id);
    const r2 = await supabase.from('students').upsert({
      id, english_level: info.english_level, lesson_price: Number(info.lesson_price) || 0,
    });
    // Transfer: remove old membership(s), add the chosen group
    const r3 = await supabase.from('group_members').delete().eq('student_id', id);
    let r4 = {};
    if (groupId) r4 = await supabase.from('group_members').insert({ group_id: groupId, student_id: id });
    const err = r1.error || r2.error || r3.error || r4.error;
    if (err) return setError(err.message);
    setMsg(t('students.saved'));
  }

  async function addNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    const { error } = await supabase.from('teacher_notes').insert({ student_id: id, note: newNote.trim() });
    if (error) return setError(error.message);
    setNewNote('');
    load();
  }

  async function deleteNote(noteId) {
    await supabase.from('teacher_notes').delete().eq('id', noteId);
    load();
  }

  async function resetPassword() {
    setError(''); setMsg('');
    const password = genPassword();
    try {
      await callStudentFunction({ action: 'reset_password', student_id: id, password });
      setNewPassword(password);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <p><Link className="link" to="/teacher/students">← {t('students.back')}</Link></p>
      <h1>{info.full_name}</h1>
            <p>
        <Link className="btn btn-light btn-auto btn-small" to={`/teacher/payments/${id}`}>
          {t('students.payments')}
        </Link>
            </p>
      <p>
        <Link className="btn btn-light btn-auto btn-small" to={`/teacher/progress/${id}`}>
          {t('nav.progress')}
        </Link>
      </p>
      <div className="card">
        <div className="grid-2">
          <div>
            <label>{t('students.fullName')}</label>
            <input value={info.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label>{t('students.email')}</label>
            <input value={info.email} disabled />
            <small className="muted">{t('students.emailNote')}</small>
          </div>
          <div>
            <label>{t('students.username')}</label>
            <input value={info.username} disabled />
          </div>
          <div>
            <label>{t('students.group')}</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{t('students.noGroup')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label>{t('students.level')}</label>
            <input value={info.english_level} onChange={set('english_level')} />
          </div>
          <div>
            <label>{t('students.price')}</label>
            <input type="number" min="0" value={info.lesson_price} onChange={set('lesson_price')} />
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <button className="btn btn-auto" onClick={save}>{t('students.saveChanges')}</button>
      </div>

      <div className="card">
        <h2>{t('students.resetPassword')}</h2>
        {newPassword && (
          <p className="success">{t('students.resetDone')} <code>{newPassword}</code></p>
        )}
        <button className="btn btn-light btn-auto" onClick={resetPassword}>{t('students.resetPassword')}</button>
      </div>

      <div className="card">
        <h2>{t('students.notes')}</h2>
        <form onSubmit={addNote}>
          <textarea rows="3" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <button className="btn btn-auto">{t('students.addNote')}</button>
        </form>
        {notes.map((n) => (
          <div className="list-row" key={n.id}>
            <div>{n.note}</div>
            <div className="row space-between">
              <small className="muted">{new Date(n.created_at).toLocaleString()}</small>
              <button className="link" onClick={() => deleteNote(n.id)}>{t('students.deleteNote')}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
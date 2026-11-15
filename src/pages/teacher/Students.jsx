import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { callStudentFunction } from '../../lib/studentApi';
import { genPassword } from '../../lib/util';

const emptyForm = () => ({
  full_name: '', email: '', username: '', password: genPassword(),
  group_id: '', english_level: 'A1', lesson_price: 2000,
});

export default function Students() {
  const { t } = useLang();
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, username, group_members(groups(name))')
        .eq('role', 'student')
        .order('full_name'),
      supabase.from('groups').select('id, name').order('created_at'),
    ]);
    setStudents(s || []);
    setGroups(g || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    const f = { ...form, username: form.username.trim(), email: form.email.trim(), full_name: form.full_name.trim() };
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(f.username) || f.password.length < 8) {
      return setError(t('students.formError'));
    }
    setBusy(true);
    try {
      await callStudentFunction({ action: 'create', ...f, group_id: f.group_id || null });
      setCreated({ username: f.username, email: f.email, password: f.password });
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <div className="row space-between">
        <h1>{t('students.title')}</h1>
        {!showForm && (
          <button className="btn btn-auto" onClick={() => { setShowForm(true); setCreated(null); }}>
            + {t('students.add')}
          </button>
        )}
      </div>

      {created && (
        <div className="card credentials">
          <p className="success">{t('students.created')}</p>
          <p><strong>{t('students.username')}:</strong> {created.username}</p>
          <p><strong>{t('students.email')}:</strong> {created.email}</p>
          <p><strong>{t('students.tempPassword')}:</strong> <code>{created.password}</code></p>
          <button className="btn btn-light btn-auto" onClick={() => setCreated(null)}>{t('students.close')}</button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2>{t('students.add')}</h2>
          <form onSubmit={submit}>
            <div className="grid-2">
              <div>
                <label>{t('students.fullName')}</label>
                <input value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div>
                <label>{t('students.email')}</label>
                <input type="email" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label>{t('students.username')}</label>
                <input value={form.username} onChange={set('username')} required />
                <small className="muted">{t('students.usernameHint')}</small>
              </div>
              <div>
                <label>{t('students.tempPassword')}</label>
                <input value={form.password} onChange={set('password')} required />
                <button type="button" className="link" onClick={() => setForm({ ...form, password: genPassword() })}>
                  {t('students.generate')}
                </button>
              </div>
              <div>
                <label>{t('students.group')}</label>
                <select value={form.group_id} onChange={set('group_id')}>
                  <option value="">{t('students.noGroup')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t('students.level')}</label>
                <input value={form.english_level} onChange={set('english_level')} />
              </div>
              <div>
                <label>{t('students.price')}</label>
                <input type="number" min="0" value={form.lesson_price} onChange={set('lesson_price')} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn btn-auto" disabled={busy}>{t('students.create')}</button>
              <button type="button" className="btn btn-light btn-auto" onClick={() => { setShowForm(false); setError(''); }}>
                {t('groups.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {students.length === 0 && !showForm && <p className="muted">{t('students.empty')}</p>}

      {students.map((s) => (
        <div className="card row space-between" key={s.id}>
          <div>
            <strong>{s.full_name}</strong>
            <div className="muted">
              {s.username} · {s.email}
              {s.group_members?.[0]?.groups?.name && <> · <span className="badge">{s.group_members[0].groups.name}</span></>}
            </div>
          </div>
          <Link className="btn btn-light btn-auto btn-small" to={`/teacher/students/${s.id}`}>
            {t('students.open')}
          </Link>
        </div>
      ))}
    </>
  );
}
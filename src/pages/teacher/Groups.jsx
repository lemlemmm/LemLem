import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';

export default function Groups() {
  const { t } = useLang();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState('A1');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, level, group_members(student_id, profiles(full_name))')
      .order('created_at');
    if (error) setError(error.message);
    else setGroups(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    const { error } = await supabase.from('groups').insert({ name: name.trim(), level: level.trim() || 'A1' });
    if (error) return setError(error.message);
    setName('');
    setLevel('A1');
    load();
  }

  function startEdit(g) {
    setEditId(g.id);
    setEditName(g.name);
    setEditLevel(g.level);
  }

  async function saveEdit(id) {
    const { error } = await supabase.from('groups').update({ name: editName.trim(), level: editLevel.trim() }).eq('id', id);
    if (error) return setError(error.message);
    setEditId(null);
    load();
  }

  async function deleteGroup(id) {
    if (!window.confirm(t('groups.confirmDelete'))) return;
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return setError(error.message);
    load();
  }

  async function removeMember(groupId, studentId) {
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('student_id', studentId);
    if (error) return setError(error.message);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('groups.title')}</h1>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>{t('groups.new')}</h2>
        <form onSubmit={createGroup} className="grid-2">
          <div>
            <label>{t('groups.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>{t('groups.level')}</label>
            <input value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
          <button className="btn btn-auto">{t('groups.create')}</button>
        </form>
      </div>

      {groups.length === 0 && <p className="muted">{t('groups.empty')}</p>}

      {groups.map((g) => (
        <div className="card" key={g.id}>
          {editId === g.id ? (
            <div className="grid-2">
              <div>
                <label>{t('groups.name')}</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label>{t('groups.level')}</label>
                <input value={editLevel} onChange={(e) => setEditLevel(e.target.value)} />
              </div>
              <div className="row">
                <button className="btn btn-auto" onClick={() => saveEdit(g.id)}>{t('groups.save')}</button>
                <button className="btn btn-light btn-auto" onClick={() => setEditId(null)}>{t('groups.cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="row space-between">
              <h2 style={{ margin: 0 }}>
                {g.name} <span className="badge">{g.level}</span>
              </h2>
              <div className="row">
                <button className="btn btn-light btn-auto btn-small" onClick={() => startEdit(g)}>{t('groups.edit')}</button>
                <button className="btn btn-danger btn-auto btn-small" onClick={() => deleteGroup(g.id)}>{t('groups.delete')}</button>
              </div>
            </div>
          )}

          <p className="muted" style={{ marginTop: 16 }}>{t('groups.members')} ({g.group_members.length})</p>
          {g.group_members.length === 0 && <p className="muted">{t('groups.noMembers')}</p>}
          {g.group_members.map((m) => (
            <div className="row space-between list-row" key={m.student_id}>
              <span>{m.profiles?.full_name}</span>
              <button className="link" onClick={() => removeMember(g.id, m.student_id)}>{t('groups.remove')}</button>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import StatusBadge from '../../components/StatusBadge';

const STATUSES = ['upcoming', 'in_progress', 'completed', 'cancelled'];

export default function Lessons() {
  const { t, lang } = useLang();
  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: g }] = await Promise.all([
        supabase.from('lessons').select('id, title, starts_at, status, group_id, groups(name)'),
        supabase.from('groups').select('id, name').order('created_at'),
      ]);
      setLessons(l || []);
      setGroups(g || []);
      setLoading(false);
    })();
  }, []);

  const asc = statusFilter === 'upcoming' || statusFilter === 'in_progress';
  const shown = lessons
    .filter((l) => (!groupFilter || l.group_id === groupFilter) && (!statusFilter || l.status === statusFilter))
    .sort((a, b) => (asc ? 1 : -1) * (new Date(a.starts_at) - new Date(b.starts_at)));

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.lessons')}</h1>
      <div className="card grid-2">
        <div>
          <label>{t('lesson.filterGroup')}</label>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">{t('lesson.all')}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label>{t('lesson.filterStatus')}</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('lesson.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 && <p className="muted">{t('lesson.empty')}</p>}

      {shown.map((l) => (
        <div className="card row space-between" key={l.id}>
          <div>
            <strong>{l.title}</strong>
            <div className="muted">
              {fmtDateTime(l.starts_at, lang)} · {l.groups?.name}
            </div>
            <StatusBadge status={l.status} />
          </div>
          <Link className="btn btn-light btn-auto btn-small" to={`/teacher/lessons/${l.id}`}>
            {t('lesson.open')}
          </Link>
        </div>
      ))}
    </>
  );
}
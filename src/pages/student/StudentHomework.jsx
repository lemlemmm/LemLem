import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { effectiveStatus } from '../../lib/homework';

export default function StudentHomework() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      // Row Level Security returns only this student's group homework and own submissions
      const [h, s] = await Promise.all([
        supabase.from('homework').select('id, title, deadline, max_score, created_at'),
        supabase.from('homework_submissions').select('homework_id, status, final_score, is_late'),
      ]);
      const subBy = {};
      (s.data || []).forEach((x) => { subBy[x.homework_id] = x; });
      const list = (h.data || []).map((hw) => {
        const sub = subBy[hw.id] || null;
        return { ...hw, sub, eff: effectiveStatus(hw, sub) };
      });
      const pending = (r) => ['not_started', 'in_progress', 'overdue'].includes(r.eff);
      list.sort((a, b) => {
        if (pending(a) !== pending(b)) return pending(a) ? -1 : 1;
        if (pending(a)) {
          return new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31');
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setItems(list);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.homework')}</h1>
      {items.length === 0 && <p className="muted">{t('hw.noHomework')}</p>}
      {items.map((h) => (
        <div className="card row space-between" key={h.id}>
          <div>
            <strong>{h.title}</strong>
            <div className="muted">
              {h.deadline ? t('hw.deadlineOn', { date: fmtDateTime(h.deadline, lang) }) : t('hw.noDeadline')}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge hws-${h.eff}`}>{t(`hwstatus.${h.eff}`)}</span>
              {h.sub?.status === 'checked' && (
                <strong> {t('hw.score')}: {h.sub.final_score} / {h.max_score}</strong>
              )}
            </div>
          </div>
          <Link className="btn btn-light btn-auto btn-small" to={`/student/homework/${h.id}`}>
            {t('hw.start')}
          </Link>
        </div>
      ))}
    </>
  );
}
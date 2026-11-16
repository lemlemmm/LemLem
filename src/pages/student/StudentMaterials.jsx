import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import Attachment from '../../components/Attachment';

export default function StudentMaterials() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Row Level Security returns only materials assigned to this student's group or to them
    supabase.from('materials')
      .select('id, title, file_path, file_type, created_at, student_id, groups(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.materials')}</h1>
      {items.length === 0 && <p className="muted">{t('lib.studentEmpty')}</p>}
      {items.map((m) => (
        <div className="card" key={m.id}>
          <div className="row space-between">
            <strong>{m.title}</strong>
            <span className="badge">{m.student_id ? t('lib.personal') : m.groups?.name}</span>
          </div>
          <div className="muted" style={{ marginBottom: 8 }}>{fmtDateTime(m.created_at, lang)}</div>
          <Attachment path={m.file_path} name={null} type={m.file_type} />
        </div>
      ))}
    </>
  );
}
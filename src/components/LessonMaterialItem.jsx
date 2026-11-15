import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LanguageContext';

export default function LessonMaterialItem({ m, onDelete }) {
  const { t } = useLang();
  const [err, setErr] = useState('');

  async function openFile() {
    setErr('');
    const w = window.open('', '_blank'); // opened first so phones don't block it
    const { data, error } = await supabase.storage.from('materials').createSignedUrl(m.file_path, 120);
    if (error || !data?.signedUrl) {
      if (w) w.close();
      setErr(error?.message || 'Could not open the file');
      return;
    }
    if (w) { w.opener = null; w.location.href = data.signedUrl; }
    else window.location.href = data.signedUrl;
  }

  return (
    <div className="card">
      <div className="row space-between">
        <div className="row">
          <span className="badge">{t(`kind.${m.kind}`)}</span>
          <strong>{m.title}</strong>
        </div>
        {onDelete && <button className="link" onClick={() => onDelete(m)}>{t('mat.delete')}</button>}
      </div>
      {m.content && <div className="pre">{m.content}</div>}
      {m.file_path && (
        <button className="btn btn-light btn-auto btn-small" onClick={openFile}>
          📎 {t('mat.openFile')}
        </button>
      )}
      {err && <div className="error">{err}</div>}
    </div>
  );
}
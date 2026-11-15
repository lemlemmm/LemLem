import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { openStorageFile } from '../lib/files';

export default function FileLink({ path, name }) {
  const { t } = useLang();
  const [err, setErr] = useState('');
  if (!path) return null;

  async function open() {
    setErr('');
    try { await openStorageFile(path); } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <button type="button" className="btn btn-light btn-auto btn-small" onClick={open}>
        📎 {name || t('mat.openFile')}
      </button>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
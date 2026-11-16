import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { useMascot } from '../mascot/MascotContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { exportCsv, EXPORT_KINDS } from '../lib/exportData';

export default function Settings() {
  const { profile } = useAuth();
  const { t } = useLang();
  const { prefs, updatePrefs, reduced } = useMascot();
  const [working, setWorking] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  async function backup(kind) {
    setError(''); setDone(''); setWorking(kind);
    try {
      await exportCsv(kind);
      setDone(kind);
    } catch (e) {
      setError(e.message);
    }
    setWorking('');
  }

  return (
    <>
      <h1>{t('nav.settings')}</h1>
      <div className="card">
        <h2>{t('settings.account')}</h2>
        <p><strong>{profile?.full_name}</strong></p>
        <p className="muted">{profile?.email} · {t(`settings.role.${profile?.role}`)}</p>
      </div>
      <div className="card">
        <h2>{t('settings.language')}</h2>
        <LanguageSwitcher />
      </div>
      <div className="card">
        <h2>{t('mascot.settings')}</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.mascot_enabled}
            onChange={(e) => updatePrefs({ mascot_enabled: e.target.checked })}
          />
          {t('mascot.show')}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.animations_enabled && !reduced}
            disabled={!prefs.mascot_enabled || reduced}
            onChange={(e) => updatePrefs({ animations_enabled: e.target.checked })}
          />
          {t('mascot.animate')}
        </label>
        {reduced && <p className="muted">{t('mascot.reduced')}</p>}
      </div>

      {profile?.role === 'teacher' && (
        <div className="card">
          <h2>{t('backup.title')}</h2>
          <p className="muted">{t('backup.hint')}</p>
          <div className="row">
            {EXPORT_KINDS.map((k) => (
              <button
                key={k}
                className="btn btn-light btn-auto btn-small"
                disabled={!!working}
                onClick={() => backup(k)}
              >
                {working === k ? t('backup.preparing') : t(`backup.${k}`)}
              </button>
            ))}
          </div>
          {done && <div className="success" style={{ marginTop: 12 }}>{t('backup.done')}: {t(`backup.${done}`)}</div>}
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      )}
    </>
  );
}
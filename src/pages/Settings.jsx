import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { useMascot } from '../mascot/MascotContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Settings() {
  const { profile } = useAuth();
  const { t } = useLang();
  const { prefs, updatePrefs, reduced } = useMascot();

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
    </>
  );
}
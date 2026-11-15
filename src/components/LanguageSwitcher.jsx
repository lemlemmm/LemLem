import { LANGS } from '../i18n/translations';
import { useLang } from '../i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-btn ${lang === l.code ? 'active' : ''}`}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
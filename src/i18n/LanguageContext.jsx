import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations, LANGS } from './translations';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const LanguageContext = createContext(null);
const valid = (c) => LANGS.some((l) => l.code === c);

export function LanguageProvider({ children }) {
  const { profile, refreshProfile } = useAuth();
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('lang');
    return valid(saved) ? saved : 'en';
  });

  // When the profile loads, use the language saved in it
  useEffect(() => {
    if (profile?.language && valid(profile.language)) {
      setLangState(profile.language);
      localStorage.setItem('lang', profile.language);
    }
  }, [profile?.language]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    async (code) => {
      if (!valid(code)) return;
      setLangState(code);
      localStorage.setItem('lang', code);
      if (profile) {
        await supabase.from('profiles').update({ language: code }).eq('id', profile.id);
        await refreshProfile();
      }
    },
    [profile, refreshProfile]
  );

  const t = useCallback(
    (key, params = {}) => {
      let text = translations[lang]?.[key] ?? translations.en[key] ?? key;
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
      return text;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
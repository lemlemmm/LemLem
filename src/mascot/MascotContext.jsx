import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { REACTIONS, CLICK_MESSAGES } from './config';

const MascotContext = createContext(null);
const DEFAULTS = { mascot_enabled: true, animations_enabled: true };

// Pages where the mascot must stay quiet (doing homework now, tests later)
const QUIET = /^\/student\/(homework|tests)\/[^/]+/;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function readLocal() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('mascotPrefs') || '{}') }; }
  catch { return DEFAULTS; }
}

export function MascotProvider({ children }) {
  const { profile } = useAuth();
  const { t } = useLang();
  const { pathname } = useLocation();
  const userId = profile?.id;

  const [prefs, setPrefsState] = useState(readLocal);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [reaction, setReaction] = useState(null);
  const [bubble, setBubble] = useState(null);
  const reactionTimer = useRef(null);
  const bubbleTimer = useRef(null);

  // Follow the device's "reduce motion" setting
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Load this user's saved preferences
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('mascot_preferences')
      .select('mascot_enabled, animations_enabled')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const next = data || DEFAULTS;
        setPrefsState(next);
        localStorage.setItem('mascotPrefs', JSON.stringify(next));
      });
  }, [userId]);

  const updatePrefs = useCallback(async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    localStorage.setItem('mascotPrefs', JSON.stringify(next));
    if (userId) await supabase.from('mascot_preferences').upsert({ user_id: userId, ...next });
  }, [prefs, userId]);

  const say = useCallback((text) => {
    clearTimeout(bubbleTimer.current);
    setBubble({ text, id: Date.now() });
    bubbleTimer.current = setTimeout(() => setBubble(null), 5000);
  }, []);

  const hideBubble = useCallback(() => {
    clearTimeout(bubbleTimer.current);
    setBubble(null);
  }, []);

  // react('homeworkDone') etc. (see REACTIONS in config.js)
  const react = useCallback((name, vars = {}) => {
    const r = REACTIONS[name];
    if (!r) return;
    clearTimeout(reactionTimer.current);
    setReaction({ state: r.state, id: Date.now() });
    reactionTimer.current = setTimeout(() => setReaction(null), 3500);
    if (r.msg) say(t(r.msg, vars));
  }, [say, t]);

  // Click on the mascot
  const poke = useCallback(() => {
    clearTimeout(reactionTimer.current);
    setReaction({ state: 'happy', id: Date.now() });
    reactionTimer.current = setTimeout(() => setReaction(null), 2500);
    say(t(pick(CLICK_MESSAGES)));
  }, [say, t]);

  const enabled = prefs.mascot_enabled;
  const quiet = QUIET.test(pathname);
  const firstName = (profile?.full_name || '').split(' ')[0];

   // Greet once per browser session (never on quiet pages). After 7+ days away: "welcome back"
  useEffect(() => {
    if (!userId || !enabled || quiet) return undefined;
    if (sessionStorage.getItem('mascotGreeted') === userId) return undefined;
    const id = setTimeout(() => {
      sessionStorage.setItem('mascotGreeted', userId);
      let away = false;
      try {
        const last = Number(localStorage.getItem(`lastVisit:${userId}`) || 0);
        away = last > 0 && Date.now() - last > 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem(`lastVisit:${userId}`, String(Date.now()));
      } catch (_) { /* storage unavailable */ }
      react(away ? 'welcomeBack' : 'greet', { name: firstName });
    }, 1200);
    return () => clearTimeout(id);
  }, [userId, enabled, quiet, react, firstName]);
  
  return (
    <MascotContext.Provider
      value={{
        prefs, updatePrefs, enabled, reduced, quiet,
        animate: enabled && prefs.animations_enabled && !reduced,
        reaction, bubble, hideBubble, react, poke,
      }}
    >
      {children}
    </MascotContext.Provider>
  );
}

export const useMascot = () => useContext(MascotContext);
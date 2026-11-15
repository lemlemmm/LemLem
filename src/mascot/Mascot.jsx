import { useEffect, useRef, useState } from 'react';
import { useMascot } from './MascotContext';
import { useLang } from '../i18n/LanguageContext';
import { SPRITE_FILES, SPRITE_SCALE, BASE_HEIGHT, STATES } from './config';

const rand = (a, b) => a + Math.random() * (b - a);

export default function Mascot() {
  const { enabled, animate, quiet, reaction, bubble, hideBubble, poke } = useMascot();
  const { t } = useLang();
  const [vw, setVw] = useState(window.innerWidth);
  const [x, setX] = useState(null);       // horizontal position in px
  const [dur, setDur] = useState(0);      // seconds the slide takes
  const [mode, setMode] = useState('idle');
  const [broken, setBroken] = useState({}); // pictures that failed to load
  const xRef = useRef(null);

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => { xRef.current = x; }, [x]);

  // Load all pictures once so poses switch without flicker
  useEffect(() => {
    Object.values(SPRITE_FILES).forEach((src) => { const i = new Image(); i.src = src; });
  }, []);

  const mobile = vw <= 800;
  const base = mobile ? BASE_HEIGHT.mobile : BASE_HEIGHT.desktop;
  const width = Math.round(base * 0.8);
  // Walking only on desktop, with animations on, and never on quiet pages
  const canMove = enabled && animate && !mobile && !quiet;
  const min = (mobile ? 0 : 250) + 16; // stay clear of the sidebar
  const max = Math.max(min, vw - width - 16);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    const later = (fn, ms) => { timer = setTimeout(fn, ms); };

    // Static: sit in the bottom-right corner
    if (!canMove) {
      setDur(0);
      setX(max);
      setMode(reaction ? reaction.state : quiet ? 'sitting' : 'idle');
      return () => clearTimeout(timer);
    }

    const cur = xRef.current;
    if (cur === null || cur < min || cur > max) { setDur(0); setX(max); }

    // A reaction (greeting, celebration...) takes over until it ends
    if (reaction) {
      setMode(reaction.state);
      return () => clearTimeout(timer);
    }

    const rest = () => later(step, rand(5000, 11000));
    const back = (ms) => later(() => { setMode('idle'); rest(); }, ms);

    function step() {
      const roll = Math.random();
      if (roll < 0.5) {
        const target = rand(min, max);
        const dist = Math.abs(target - (xRef.current ?? max));
        const run = Math.random() < 0.2;
        const secs = Math.max(1, dist / (run ? 240 : 60));
        setDur(secs);
        setMode(run ? 'running' : 'walking');
        setX(target);
        back(secs * 1000 + 100);
        return;
      }
      const options = [['jumping', 1200], ['sitting', 6000], ['studying', 8000], ['sleeping', 9000]];
      if (roll < 0.9) {
        const [m, ms] = options[Math.floor(rand(0, options.length))];
        setMode(m);
        back(ms);
        return;
      }
      setMode('peeking');
      back(4000);
    }

    setMode('idle');
    rest();
    return () => clearTimeout(timer);
  }, [enabled, canMove, quiet, reaction, min, max]);

  if (!enabled) return null;

  const [spriteKey, motion] = STATES[mode] || STATES.idle;
  const height = Math.round(base * SPRITE_SCALE[spriteKey]);
  const bubbleLeft = x !== null && x < vw / 2;

  return (
    <div
      className={`mascot-wrap ${animate ? 'mascot-anim' : ''}`}
      style={{
        transform: `translateX(${x ?? 0}px)`,
        transition: `transform ${dur}s linear`,
        opacity: x === null ? 0 : 1,
      }}
    >
      {bubble && (
        <div
          className={`mascot-bubble ${bubbleLeft ? 'left' : 'right'}`}
          role="status"
          onClick={hideBubble}
        >
          {bubble.text}
        </div>
      )}
      <button type="button" className="mascot-btn" onClick={poke} aria-label={t('mascot.name')}>
        {broken[spriteKey] ? (
          <span style={{ fontSize: height * 0.6 }}>🐹</span>
        ) : (
          <img
            className={`mascot-img ${motion}`}
            src={SPRITE_FILES[spriteKey]}
            alt=""
            draggable="false"
            style={{ height }}
            onError={() => setBroken((b) => ({ ...b, [spriteKey]: true }))}
          />
        )}
      </button>
    </div>
  );
}
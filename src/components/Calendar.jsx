import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import {
  localeFor, startOfDay, addDays, startOfWeek, isSameDay, fmtTime, monthGrid,
} from '../lib/dates';

export default function Calendar({ lessons, onSelect }) {
  const { t, lang } = useLang();
  const loc = localeFor(lang);
  const [view, setView] = useState('week');
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const today = startOfDay(new Date());

  const lessonsOn = (day) =>
    lessons
      .filter((l) => isSameDay(new Date(l.starts_at), day))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  function shift(dir) {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
  }

  let title;
  if (view === 'day') {
    title = cursor.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } else if (view === 'week') {
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    title = `${s.toLocaleDateString(loc, { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else {
    title = cursor.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  }

  const chip = (l, showGroup) => (
    <button key={l.id} type="button" className={`chip chip-${l.status}`} onClick={() => onSelect(l)}>
      <strong>{fmtTime(l.starts_at, lang)}</strong> {l.title}
      {showGroup && l.groups?.name && <span className="chip-group">{l.groups.name}</span>}
    </button>
  );

  const weekStart = startOfWeek(cursor);
  const dowNames = Array.from({ length: 7 }, (_, i) =>
    addDays(startOfWeek(today), i).toLocaleDateString(loc, { weekday: 'short' })
  );

  return (
    <div className="card">
      <div className="cal-toolbar">
        <div className="seg">
          <button type="button" className="seg-btn" onClick={() => shift(-1)}>‹</button>
          <button type="button" className="seg-btn" onClick={() => setCursor(today)}>{t('cal.today')}</button>
          <button type="button" className="seg-btn" onClick={() => shift(1)}>›</button>
        </div>
        <div className="cal-title">{title}</div>
        <div className="seg">
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              type="button"
              className={`seg-btn ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {t(`cal.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {view === 'day' && (
        lessonsOn(cursor).length === 0
          ? <p className="muted">{t('cal.noLessons')}</p>
          : lessonsOn(cursor).map((l) => chip(l, true))
      )}

      {view === 'week' && (
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
            <div key={d.getTime()} className={`cal-col ${isSameDay(d, today) ? 'today' : ''}`}>
              <div className="cal-col-head">{d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric' })}</div>
              {lessonsOn(d).map((l) => chip(l, true))}
            </div>
          ))}
        </div>
      )}

      {view === 'month' && (
        <div className="cal-month">
          {dowNames.map((n) => <div key={n} className="cal-dow">{n}</div>)}
          {monthGrid(cursor).map((d) => (
            <div
              key={d.getTime()}
              className={`cal-cell ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${isSameDay(d, today) ? 'today' : ''}`}
              onClick={() => { setCursor(d); setView('day'); }}
            >
              <div className="cal-num">{d.getDate()}</div>
              {lessonsOn(d).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`chip chip-sm chip-${l.status}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(l); }}
                >
                  {fmtTime(l.starts_at, lang)}<span className="chip-title"> {l.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export const localeFor = (lang) => ({ en: 'en-GB', ru: 'ru-RU', kk: 'kk-KZ' }[lang] || 'en-GB');

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Weeks start on Monday
export const startOfWeek = (d) => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// 42 days (6 weeks) covering the month of date d
export function monthGrid(d) {
  const first = startOfWeek(startOfMonth(d));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export const fmtTime = (iso, lang) =>
  new Date(iso).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (iso, lang) =>
  new Date(iso).toLocaleDateString(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' });

export const fmtDateTime = (iso, lang) =>
  new Date(iso).toLocaleString(localeFor(lang), {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

// ISO string -> value for <input type="datetime-local"> (in the browser's time zone)
export function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// weekdays: 0 = Monday ... 6 = Sunday. Returns Date objects.
export function recurringDates(startValue, weekdays, weeks) {
  const start = new Date(startValue);
  const first = startOfDay(start);
  const base = startOfWeek(start);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    [...weekdays].sort((a, b) => a - b).forEach((d) => {
      const day = addDays(base, w * 7 + d);
      if (day < first) return;
      const when = new Date(day);
      when.setHours(start.getHours(), start.getMinutes(), 0, 0);
      out.push(when);
    });
  }
  return out;
}
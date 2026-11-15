import { localeFor } from './dates';

export const fmtMoney = (n, lang) =>
  `${Number(n || 0).toLocaleString(localeFor(lang), { maximumFractionDigits: 2 })} ₸`;

// 'YYYY-MM-DD' (a date column) -> readable date, without time zone shifts
export function fmtDay(str, lang) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeFor(lang), {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Today's date as 'YYYY-MM-DD' in the browser's time zone
export function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
import { fmtMoney } from './money';
import { fmtDateTime } from './dates';

// Turns a notification row into text in the viewer's language
export function notifTitle(n, t, lang) {
  const d = n.data || {};
  const params = { ...d };
  if (d.amount != null) params.amount = fmtMoney(d.amount, lang);
  if (d.when) params.when = fmtDateTime(d.when, lang);
  const key = `notif.${n.type}`;
  const text = t(key, params);
  return text === key ? n.title : text;
}
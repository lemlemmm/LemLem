export const QTYPES = [
  'multiple_choice', 'true_false', 'gap_fill', 'matching', 'ordering', 'short_answer', 'writing',
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle that differs from the original order whenever that is possible
export function shuffleDifferent(arr) {
  if (arr.length < 2 || new Set(arr).size < 2) return [...arr];
  let out = shuffle(arr);
  for (let k = 0; k < 30 && out.every((v, i) => v === arr[i]); k++) out = shuffle(arr);
  return out;
}

// Status shown to people: adds "overdue" when the deadline has passed
export function effectiveStatus(hw, sub) {
  const st = sub?.status || 'not_started';
  if ((st === 'not_started' || st === 'in_progress') && hw.deadline && new Date(hw.deadline) < new Date()) {
    return 'overdue';
  }
  return st;
}

export function isAnswered(q, v) {
  if (v === undefined || v === null) return false;
  if (q.type === 'multiple_choice') return typeof v === 'number';
  if (q.type === 'true_false') return typeof v === 'boolean';
  if (Array.isArray(v)) return v.some((x) => x !== null && x !== undefined && x !== '');
  return String(v).trim() !== '';
}

// Turns an answer (or a correct answer: same shape) into readable text
export function formatValue(q, v, t) {
  if (v === undefined || v === null || v === '') return '—';
  switch (q.type) {
    case 'multiple_choice':
      return q.options?.[v] ?? '—';
    case 'true_false':
      return v === true ? t('hw.true') : v === false ? t('hw.false') : '—';
    case 'gap_fill':
      return Array.isArray(v)
        ? v.map((x, i) => `${i + 1}) ${String(x || '—').replaceAll('|', ' / ')}`).join('    ')
        : '—';
    case 'matching':
      return Array.isArray(v) && q.options?.left
        ? q.options.left
            .map((l, i) => `${l} → ${v[i] == null ? '—' : q.options.right[v[i]] ?? '—'}`)
            .join('\n')
        : '—';
    case 'ordering':
      return Array.isArray(v) && v.length ? v.join(' / ') : '—';
    case 'short_answer':
      return Array.isArray(v) ? v.join(' / ') : String(v);
    default:
      return String(v);
  }
}
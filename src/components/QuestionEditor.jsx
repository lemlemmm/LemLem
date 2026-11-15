import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { QTYPES, shuffleDifferent } from '../lib/homework';

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

const INITIAL = {
  type: 'multiple_choice', prompt: '', points: 1,
  optionsText: '', correctIdx: 0, tf: 'true',
  gapsText: '', pairsText: '', partsText: '', acceptedText: '',
};

// Returns { q } or { error }
function build(f, t) {
  const prompt = f.prompt.trim();
  const points = Number(f.points);
  if (!prompt) return { error: t('hw.err.prompt') };
  if (!Number.isInteger(points) || points < 1) return { error: t('hw.err.points') };
  const base = { type: f.type, prompt, points, options: null, correct_answer: null };

  switch (f.type) {
    case 'multiple_choice': {
      const opts = lines(f.optionsText);
      if (opts.length < 2) return { error: t('hw.err.options') };
      const idx = Math.min(Number(f.correctIdx) || 0, opts.length - 1);
      return { q: { ...base, options: opts, correct_answer: idx } };
    }
    case 'true_false':
      return { q: { ...base, correct_answer: f.tf === 'true' } };

    case 'gap_fill': {
      const blanks = (prompt.match(/___/g) || []).length;
      const gaps = lines(f.gapsText);
      if (blanks === 0 || blanks !== gaps.length) return { error: t('hw.err.gaps') };
      return { q: { ...base, correct_answer: gaps } };
    }
    case 'matching': {
      const pairs = lines(f.pairsText).map((l) => {
        const i = l.indexOf('=');
        return i < 1 ? null : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      });
      if (pairs.length < 2 || pairs.some((p) => !p || !p[0] || !p[1])) return { error: t('hw.err.pairs') };
      const left = pairs.map((p) => p[0]);
      const rightOrig = pairs.map((p) => p[1]);
      const perm = shuffleDifferent(rightOrig.map((_, i) => i)); // perm[j] = original index shown at position j
      const right = perm.map((i) => rightOrig[i]);
      const correct = left.map((_, i) => perm.indexOf(i));
      return { q: { ...base, options: { left, right }, correct_answer: correct } };
    }
    case 'ordering': {
      const parts = lines(f.partsText);
      if (parts.length < 2) return { error: t('hw.err.parts') };
      return { q: { ...base, options: shuffleDifferent(parts), correct_answer: parts } };
    }
    case 'short_answer':
      return { q: { ...base, correct_answer: lines(f.acceptedText) } };

    default: // writing
      return { q: base };
  }
}

export default function QuestionEditor({ onAdd }) {
  const { t } = useLang();
  const [f, setF] = useState(INITIAL);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    const { q, error: err } = build(f, t);
    if (err) return setError(err);
    setBusy(true);
    const dbError = await onAdd(q);
    setBusy(false);
    if (dbError) return setError(dbError);
    setF({ ...INITIAL, type: f.type });
  }

  const options = lines(f.optionsText);

  return (
    <div className="card">
      <h2>{t('hw.addQuestion')}</h2>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div>
            <label>{t('hw.questionType')}</label>
            <select value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value }); setError(''); }}>
              {QTYPES.map((q) => <option key={q} value={q}>{t(`hw.type.${q}`)}</option>)}
            </select>
          </div>
          <div>
            <label>{t('hw.points')}</label>
            <input type="number" min="1" step="1" value={f.points} onChange={set('points')} />
          </div>
        </div>

        <label>{t('hw.prompt')}</label>
        <textarea rows="3" value={f.prompt} onChange={set('prompt')} />

        {f.type === 'multiple_choice' && (
          <>
            <label>{t('hw.optionsLabel')}</label>
            <textarea rows="4" value={f.optionsText} onChange={set('optionsText')} />
            <label>{t('hw.correctOption')}</label>
            <select value={f.correctIdx} onChange={set('correctIdx')}>
              {options.length === 0 && <option value="0">—</option>}
              {options.map((o, i) => <option key={i} value={i}>{i + 1}. {o}</option>)}
            </select>
          </>
        )}

        {f.type === 'true_false' && (
          <>
            <label>{t('hw.tfCorrect')}</label>
            <select value={f.tf} onChange={set('tf')}>
              <option value="true">{t('hw.true')}</option>
              <option value="false">{t('hw.false')}</option>
            </select>
          </>
        )}

        {f.type === 'gap_fill' && (
          <>
            <p className="muted">{t('hw.hint.gap')}</p>
            <label>{t('hw.gaps')}</label>
            <textarea rows="3" value={f.gapsText} onChange={set('gapsText')} />
          </>
        )}

        {f.type === 'matching' && (
          <>
            <p className="muted">{t('hw.hint.matching')}</p>
            <label>{t('hw.pairs')}</label>
            <textarea rows="5" value={f.pairsText} onChange={set('pairsText')} placeholder="cat = кошка" />
          </>
        )}

        {f.type === 'ordering' && (
          <>
            <p className="muted">{t('hw.hint.ordering')}</p>
            <label>{t('hw.parts')}</label>
            <textarea rows="5" value={f.partsText} onChange={set('partsText')} />
          </>
        )}

        {f.type === 'short_answer' && (
          <>
            <p className="muted">{t('hw.hint.short')}</p>
            <label>{t('hw.accepted')}</label>
            <textarea rows="3" value={f.acceptedText} onChange={set('acceptedText')} />
          </>
        )}

        {f.type === 'writing' && <p className="muted">{t('hw.hint.writing')}</p>}

        {error && <div className="error">{error}</div>}
        <button className="btn btn-auto" disabled={busy}>{t('hw.addBtn')}</button>
      </form>
    </div>
  );
}
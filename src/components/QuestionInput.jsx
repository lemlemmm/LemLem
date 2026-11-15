import { useLang } from '../i18n/LanguageContext';

// The question text is shown by the parent, except for gap_fill (its text contains the inputs)
export default function QuestionInput({ q, value, onChange }) {
  const { t } = useLang();

  switch (q.type) {
    case 'multiple_choice':
      return (
        <div>
          {(q.options || []).map((o, i) => (
            <label className="choice" key={i}>
              <input type="radio" name={q.id} checked={value === i} onChange={() => onChange(i)} />
              {o}
            </label>
          ))}
        </div>
      );

    case 'true_false':
      return (
        <div>
          {[true, false].map((b) => (
            <label className="choice" key={String(b)}>
              <input type="radio" name={q.id} checked={value === b} onChange={() => onChange(b)} />
              {b ? t('hw.true') : t('hw.false')}
            </label>
          ))}
        </div>
      );

    case 'gap_fill': {
      const parts = q.prompt.split('___');
      const blanks = parts.length - 1;
      const vals = Array.from({ length: blanks }, (_, k) => (Array.isArray(value) ? value[k] : '') ?? '');
      return (
        <div className="pre">
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {i < blanks && (
                <input
                  className="gap-input"
                  value={vals[i]}
                  aria-label={String(i + 1)}
                  onChange={(e) => {
                    const next = [...vals];
                    next[i] = e.target.value;
                    onChange(next);
                  }}
                />
              )}
            </span>
          ))}
        </div>
      );
    }

    case 'matching': {
      const left = q.options?.left || [];
      const right = q.options?.right || [];
      const vals = Array.from({ length: left.length }, (_, k) => (Array.isArray(value) ? value[k] : null) ?? null);
      return (
        <div>
          {left.map((l, i) => (
            <div className="match-row" key={i}>
              <span>{l}</span>
              <select
                value={vals[i] ?? ''}
                onChange={(e) => {
                  const next = [...vals];
                  next[i] = e.target.value === '' ? null : Number(e.target.value);
                  onChange(next);
                }}
              >
                <option value="">{t('hw.choose')}</option>
                {right.map((r, j) => <option key={j} value={j}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case 'ordering': {
      const chosen = Array.isArray(value) ? value : [];
      const remaining = [...(q.options || [])];
      chosen.forEach((v) => {
        const i = remaining.indexOf(v);
        if (i > -1) remaining.splice(i, 1);
      });
      return (
        <div>
          <div className="order-chosen">
            {chosen.length === 0 && <span className="muted">{t('hw.tapParts')}</span>}
            {chosen.map((p, i) => (
              <button
                type="button" key={i} className="part-btn chosen"
                onClick={() => onChange(chosen.filter((_, k) => k !== i))}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="order-pool">
            {remaining.map((p, i) => (
              <button type="button" key={i} className="part-btn" onClick={() => onChange([...chosen, p])}>
                {p}
              </button>
            ))}
          </div>
          {chosen.length > 0 && (
            <button type="button" className="link" onClick={() => onChange([])}>{t('hw.reset')}</button>
          )}
        </div>
      );
    }

    case 'short_answer':
      return (
        <input
          value={value ?? ''}
          placeholder={t('hw.typeAnswer')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default: // writing
      return (
        <textarea
          rows="8"
          value={value ?? ''}
          placeholder={t('hw.writeHere')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
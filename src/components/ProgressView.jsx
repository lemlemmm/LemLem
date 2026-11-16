import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { loadProgress } from '../lib/progress';
import { fmtDateTime } from '../lib/dates';

function Bar({ value }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="bar">
      <div className={`bar-fill ${v < 60 ? 'low' : ''}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export default function ProgressView({ studentId, role }) {
  const { t, lang } = useLang();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    setD(null);
    setError('');
    loadProgress(studentId, role)
      .then((r) => { if (!off) setD(r); })
      .catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [studentId, role]);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <p className="muted">{t('common.loading')}</p>;

  const pct = (v) => (v == null ? t('prog.na') : `${Math.round(v)}%`);
  const hwPct = d.hw.total > 0 ? (d.hw.done / d.hw.total) * 100 : null;

  const weakText = (w) => {
    if (w.kind === 'type') {
      return t('prog.weakType', {
        type: t(`hw.type.${w.type}`), pct: Math.round(w.pct), earned: w.earned, max: w.max,
      });
    }
    if (w.kind === 'attendance') return t('prog.weakAttendance', { pct: w.pct });
    if (w.kind === 'overdue') return t('prog.weakOverdue', { n: w.n });
    return t('prog.weakHwLow');
  };

  const list = (items) => items.map((x, i) => (
    <div className="list-row" key={i}>
      <strong>{x.title}</strong> <span className="muted">· {fmtDateTime(x.when, lang)}</span>
    </div>
  ));

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">{t('prog.attendance')}</div>
          <div className="stat-value">{pct(d.attendancePct)}</div>
          <div className="muted">
            {t('prog.attendanceNote', { a: d.count.present, b: d.count.excused, c: d.count.unexcused })}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('prog.lessons')}</div>
          <div className="stat-value">{d.attended} / {d.held}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('prog.homework')}</div>
          <div className="stat-value">{pct(hwPct)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('prog.testAvg')}</div>
          <div className="stat-value">{pct(d.testAvg)}</div>
        </div>
      </div>

      <div className="card">
        <h2>{t('prog.improve')}</h2>
        {d.weak.length === 0 && <p className="muted">{t('prog.improveNone')}</p>}
        {d.weak.map((w, i) => <p key={i} className="amount-minus">• {weakText(w)}</p>)}
      </div>

      <div className="card">
        <h2>{t('prog.hwTitle')}</h2>
        {d.hw.total === 0 ? (
          <p className="muted">{t('prog.hwNone')}</p>
        ) : (
          <>
            <Bar value={hwPct} />
            <p>{t('prog.hwDone', { a: d.hw.done, b: d.hw.total })}</p>
            {d.hw.avg != null && <p>{t('prog.hwAvg', { n: Math.round(d.hw.avg) })}</p>}
            {d.hw.overdue > 0 && <p className="amount-minus">{t('prog.hwOverdue', { n: d.hw.overdue })}</p>}
          </>
        )}
      </div>

      <div className="card">
        <h2>{t('prog.testsTitle')}</h2>
        {d.tests.length === 0 && <p className="muted">{t('prog.noTests')}</p>}
        {d.tests.map((x) => (
          <div className="progress-row" key={x.id}>
            <div className="row space-between">
              <strong>{x.title}</strong>
              <span>{x.score} / {x.max}</span>
            </div>
            <Bar value={x.pct} />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('prog.byType')}</h2>
        <p className="muted">{t('prog.byTypeHint')}</p>
        {d.byType.length === 0 && <p className="muted">{t('prog.noType')}</p>}
        {d.byType.map((x) => (
          <div className="progress-row" key={x.type}>
            <div className="row space-between">
              <span>{t(`hw.type.${x.type}`)}</span>
              <strong>{Math.round(x.pct)}%</strong>
            </div>
            <Bar value={x.pct} />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('prog.grammar')}</h2>
        {d.grammar.length === 0 ? <p className="muted">{t('prog.none')}</p> : list(d.grammar)}
        <h2 style={{ marginTop: 20 }}>{t('prog.topics')}</h2>
        {d.topics.length === 0 ? <p className="muted">{t('prog.none')}</p> : list(d.topics)}
      </div>

      <div className="card">
        <h2>{t('prog.vocab')}: {d.vocab.length}</h2>
        <p className="muted">{t('prog.vocabNote')}</p>
        {d.vocab.length === 0 ? <p className="muted">{t('prog.none')}</p> : list(d.vocab)}
      </div>
    </>
  );
}
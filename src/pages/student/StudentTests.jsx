import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtDateTime } from '../../lib/dates';
import { testWindow } from '../../lib/tests';

export default function StudentTests() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      // Row Level Security returns only this student's group tests and own attempts
      const [tt, s] = await Promise.all([
        supabase.from('tests')
          .select('id, title, opens_at, closes_at, time_limit_min, max_score, created_at'),
        supabase.from('test_submissions').select('test_id, status, final_score'),
      ]);
      const subBy = {};
      (s.data || []).forEach((x) => { subBy[x.test_id] = x; });
      const list = (tt.data || []).map((x) => ({ ...x, sub: subBy[x.id] || null, win: testWindow(x) }));
      const pending = (r) => !r.sub || r.sub.status === 'in_progress';
      list.sort((a, b) => {
        if (pending(a) !== pending(b)) return pending(a) ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setItems(list);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.tests')}</h1>
      {items.length === 0 && <p className="muted">{t('test.noTests')}</p>}
      {items.map((x) => {
        const st = x.sub?.status;
        let action = t('test.view');
        if (st === 'in_progress') action = t('test.resume');
        else if (st) action = t('test.seeResult');
        else if (x.win === 'open') action = t('test.start');
        return (
          <div className="card row space-between" key={x.id}>
            <div>
              <strong>{x.title}</strong>
              <div className="muted">
                {t('test.min', { n: x.time_limit_min })}
                {x.closes_at ? ` · ${t('test.closesOn', { date: fmtDateTime(x.closes_at, lang) })}` : ''}
                {!x.sub && x.win === 'upcoming' && x.opens_at
                  ? ` · ${t('test.opensOn', { date: fmtDateTime(x.opens_at, lang) })}` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                {st ? (
                  <span className={`badge hws-${st}`}>{t(`hwstatus.${st}`)}</span>
                ) : (
                  <span className={`badge ${x.win === 'open' ? 'status-completed' : x.win === 'closed' ? 'status-cancelled' : ''}`}>
                    {t(`test.win.${x.win}`)}
                  </span>
                )}
                {st === 'checked' && (
                  <strong> {t('hw.score')}: {x.sub.final_score} / {x.max_score}</strong>
                )}
              </div>
            </div>
            <Link className="btn btn-light btn-auto btn-small" to={`/student/tests/${x.id}`}>{action}</Link>
          </div>
        );
      })}
    </>
  );
}
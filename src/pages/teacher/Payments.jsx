import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { localeFor } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';

export default function Payments() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [byMonth, setByMonth] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [stRes, balRes, payRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, group_members(groups(name))')
          .eq('role', 'student').order('full_name'),
        supabase.from('package_balance').select('*'),
        supabase.from('payments').select('amount, paid_on'),
      ]);
      const err = stRes.error || balRes.error || payRes.error;
      if (err) { setError(err.message); setLoading(false); return; }

      const bal = balRes.data || [];
      const list = (stRes.data || []).map((st) => {
        const mine = bal.filter((x) => x.student_id === st.id);
        return {
          id: st.id,
          name: st.full_name,
          group: st.group_members?.[0]?.groups?.name || '',
          active: mine.find((x) => x.is_active) || null,
          debt: mine.reduce((sum, x) => sum + Number(x.outstanding_debt), 0),
        };
      }).sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name));

      const months = {};
      (payRes.data || []).forEach((p) => {
        const k = p.paid_on.slice(0, 7);
        months[k] = (months[k] || 0) + Number(p.amount);
      });

      setRows(list);
      setByMonth(months);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const d = new Date();
  const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(localeFor(lang), { month: 'long', year: 'numeric' });
  };
  const monthList = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const debtors = rows.filter((r) => r.debt > 0);
  const totalDebt = debtors.reduce((sum, r) => sum + r.debt, 0);

  return (
    <>
      <h1>{t('nav.payments')}</h1>
      {error && <div className="error">{error}</div>}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">{t('pay.income')}</div>
          <div className="stat-value">{fmtMoney(byMonth[thisMonth] || 0, lang)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('pay.totalDebt')}</div>
          <div className={`stat-value ${totalDebt > 0 ? 'danger' : ''}`}>{fmtMoney(totalDebt, lang)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('pay.withDebt')}</div>
          <div className="stat-value">{debtors.length}</div>
        </div>
      </div>

      <h2>{t('pay.students')}</h2>
      {rows.length === 0 && <p className="muted">{t('pay.noStudents')}</p>}
      {rows.map((r) => (
        <div className="card row space-between" key={r.id}>
          <div>
            <strong>{r.name}</strong> {r.group && <span className="badge">{r.group}</span>}
            <div className="muted">
              {r.active
                ? `${fmtMoney(r.active.total_paid, lang)} / ${fmtMoney(r.active.total_cost, lang)} · ${t('pay.remaining')}: ${r.active.remaining_lessons}`
                : t('pay.noPackage')}
            </div>
          </div>
          <div className="row">
            <strong className={r.debt > 0 ? 'amount-minus' : ''}>
              {t('pay.debt')}: {fmtMoney(Math.max(r.debt, 0), lang)}
            </strong>
            <Link className="btn btn-light btn-auto btn-small" to={`/teacher/payments/${r.id}`}>
              {t('students.open')}
            </Link>
          </div>
        </div>
      ))}

      <div className="card">
        <h2>{t('pay.byMonth')}</h2>
        {monthList.length === 0 && <p className="muted">{t('pay.noPayments')}</p>}
        {monthList.map(([key, sum]) => (
          <div className="row space-between list-row" key={key}>
            <span style={{ textTransform: 'capitalize' }}>{monthLabel(key)}</span>
            <strong>{fmtMoney(sum, lang)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
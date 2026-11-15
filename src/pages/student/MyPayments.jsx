import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtMoney, fmtDay } from '../../lib/money';
import { fmtDateTime } from '../../lib/dates';
import BalanceCards from '../../components/BalanceCards';
import AttendanceBadge from '../../components/AttendanceBadge';

export default function MyPayments() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    (async () => {
      // Row Level Security guarantees these return only this student's own records
      const [pk, pay, adj, att] = await Promise.all([
        supabase.from('package_balance').select('*').order('started_on', { ascending: false }),
        supabase.from('payments').select('id, amount, paid_on, method, comment')
          .order('paid_on', { ascending: false }),
        supabase.from('financial_adjustments').select('id, amount, reason, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('attendance').select('id, status, lessons(title, starts_at)'),
      ]);
      setPackages(pk.data || []);
      setPayments(pay.data || []);
      setAdjustments(adj.data || []);
      setAttendance(
        (att.data || []).sort(
          (a, b) => new Date(b.lessons?.starts_at || 0) - new Date(a.lessons?.starts_at || 0)
        )
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const active = packages.find((x) => x.is_active) || packages[0] || null;
  const totalDebt = packages.reduce((sum, b) => sum + Number(b.outstanding_debt), 0);

  return (
    <>
      <h1>{t('nav.payments')}</h1>

      {active ? <BalanceCards b={active} /> : <p className="muted">{t('pay.noPackage')}</p>}
      {packages.length > 1 && (
        <p><strong>{t('pay.totalDebtAll')}: {fmtMoney(Math.max(totalDebt, 0), lang)}</strong></p>
      )}

      <div className="card">
        <h2>{t('pay.history')}</h2>
        {payments.length === 0 && <p className="muted">{t('pay.noPayments')}</p>}
        {payments.map((p) => (
          <div className="list-row" key={p.id}>
            <div className="row space-between">
              <strong>{fmtMoney(p.amount, lang)}</strong>
              <span className="muted">{fmtDay(p.paid_on, lang)} · {t(`pay.method.${p.method}`)}</span>
            </div>
            {p.comment && <div className="muted">{p.comment}</div>}
          </div>
        ))}
        {adjustments.map((a) => (
          <div className="list-row" key={a.id}>
            <div className="row space-between">
              <strong className={a.amount > 0 ? 'amount-plus' : 'amount-minus'}>
                {a.amount > 0 ? t('pay.reducedDebt') : t('pay.increasedDebt')}: {fmtMoney(Math.abs(a.amount), lang)}
              </strong>
              <span className="muted">{fmtDateTime(a.created_at, lang)}</span>
            </div>
            {a.reason && <div className="muted">{a.reason}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t('pay.attHistory')}</h2>
        {attendance.length === 0 && <p className="muted">{t('pay.noAtt')}</p>}
        {attendance.map((a) => (
          <div className="row space-between list-row" key={a.id}>
            <span>
              <strong>{a.lessons?.title || '—'}</strong>
              {a.lessons?.starts_at && <span className="muted"> · {fmtDateTime(a.lessons.starts_at, lang)}</span>}
            </span>
            <AttendanceBadge status={a.status} />
          </div>
        ))}
      </div>
    </>
  );
}
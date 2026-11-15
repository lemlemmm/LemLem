import { useLang } from '../i18n/LanguageContext';
import { fmtMoney } from '../lib/money';

// b = one row from the package_balance view
export default function BalanceCards({ b }) {
  const { t, lang } = useLang();
  const debt = Number(b.outstanding_debt);
  const remaining = Number(b.remaining_lessons);
  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-label">{t('pay.totalCost')}</div>
        <div className="stat-value">{fmtMoney(b.total_cost, lang)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t('pay.paid')}</div>
        <div className="stat-value">{fmtMoney(b.total_paid, lang)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t('pay.debt')}</div>
        <div className={`stat-value ${debt > 0 ? 'danger' : ''}`}>{fmtMoney(Math.max(debt, 0), lang)}</div>
        {debt < 0 && <div className="muted">{t('pay.overpaid', { n: fmtMoney(-debt, lang) })}</div>}
      </div>
      <div className="stat">
        <div className="stat-label">{t('pay.used')}</div>
        <div className="stat-value">{b.completed_lessons} / {b.total_lessons}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t('pay.remaining')}</div>
        <div className={`stat-value ${remaining <= 0 ? 'danger' : ''}`}>{remaining}</div>
      </div>
    </div>
  );
}
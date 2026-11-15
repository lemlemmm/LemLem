import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import { fmtMoney, fmtDay, todayLocal } from '../../lib/money';
import { fmtDateTime } from '../../lib/dates';
import BalanceCards from '../../components/BalanceCards';
import AttendanceBadge from '../../components/AttendanceBadge';

const METHODS = ['cash', 'kaspi', 'other'];

export default function StudentPayments() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(2000);
  const [packages, setPackages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [pay, setPay] = useState({ amount: '', paid_on: todayLocal(), method: 'cash', comment: '', package_id: '' });
  const [adj, setAdj] = useState({ direction: 'reduce', amount: '', reason: '', package_id: '' });
  const [pkgForm, setPkgForm] = useState({ total_lessons: 12, price_per_lesson: 2000 });

  const load = useCallback(async () => {
    const [pRes, stRes, pkRes, payRes, adjRes, attRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', id).maybeSingle(),
      supabase.from('students').select('lesson_price').eq('id', id).maybeSingle(),
      supabase.from('package_balance').select('*').eq('student_id', id).order('started_on', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', id)
        .order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('financial_adjustments').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('id, status, lessons(title, starts_at)').eq('student_id', id),
    ]);
    setName(pRes.data?.full_name || '');
    setDefaultPrice(stRes.data?.lesson_price ?? 2000);
    const pk = pkRes.data || [];
    setPackages(pk);
    const active = pk.find((x) => x.is_active);
    if (active) setPkgForm({ total_lessons: active.total_lessons, price_per_lesson: active.price_per_lesson });
    setPayments(payRes.data || []);
    setAdjustments(adjRes.data || []);
    setAttendance(
      (attRes.data || []).sort(
        (a, b) => new Date(b.lessons?.starts_at || 0) - new Date(a.lessons?.starts_at || 0)
      )
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const active = packages.find((x) => x.is_active) || null;
  const payPkg = pay.package_id || active?.package_id || packages[0]?.package_id || '';
  const adjPkg = adj.package_id || active?.package_id || packages[0]?.package_id || '';
  const pkgLabel = (b) =>
    t('pay.packageFrom', { date: fmtDay(b.started_on, lang) }) + (b.is_active ? '' : ` (${t('pay.closed')})`);

  async function addPayment(e) {
    e.preventDefault();
    setError(''); setMsg('');
    const amount = Number(pay.amount);
    if (!(amount > 0)) return setError(t('pay.invalidAmount'));
    const { error: err } = await supabase.from('payments').insert({
      student_id: id,
      package_id: payPkg || null,
      amount,
      paid_on: pay.paid_on || todayLocal(),
      method: pay.method,
      comment: pay.comment.trim() || null,
    });
    if (err) return setError(err.message);
    setPay({ ...pay, amount: '', comment: '' });
    setMsg(t('pay.recorded'));
    load();
  }

  async function addAdjustment(e) {
    e.preventDefault();
    setError(''); setMsg('');
    const amount = Number(adj.amount);
    if (!(amount > 0)) return setError(t('pay.invalidAmount'));
    const { error: err } = await supabase.from('financial_adjustments').insert({
      student_id: id,
      package_id: adjPkg || null,
      amount: adj.direction === 'reduce' ? amount : -amount, // positive reduces debt
      reason: adj.reason.trim(),
    });
    if (err) return setError(err.message);
    setAdj({ ...adj, amount: '', reason: '' });
    setMsg(t('pay.saved'));
    load();
  }

  async function savePackage() {
    setError(''); setMsg('');
    const total = parseInt(pkgForm.total_lessons, 10);
    const price = Number(pkgForm.price_per_lesson);
    if (!(total >= 1) || !(price >= 0)) return setError(t('pay.invalidPackage'));
    const { error: err } = await supabase
      .from('packages')
      .update({ total_lessons: total, price_per_lesson: price })
      .eq('id', active.package_id);
    if (err) return setError(err.message);
    setMsg(t('pay.saved'));
    load();
  }

  async function startPackage() {
    if (!window.confirm(t('pay.confirmNew'))) return;
    setError(''); setMsg('');
    const { error: err } = await supabase.rpc('start_new_package', {
      p_student: id,
      p_total: active?.total_lessons ?? 12,
      p_price: active?.price_per_lesson ?? defaultPrice,
    });
    if (err) return setError(err.message);
    setPay((p) => ({ ...p, package_id: '' }));
    setAdj((a) => ({ ...a, package_id: '' }));
    setMsg(t('pay.saved'));
    load();
  }

    async function sendReminder() {
    setError(''); setMsg('');
    const debt = packages.reduce((sum, b) => sum + Number(b.outstanding_debt), 0);
    const { error: err } = await supabase.from('notifications').insert({
      user_id: id,
      type: 'payment_reminder',
      title: 'Payment reminder',
      link: '/student/payments',
      data: { amount: debt },
    });
    if (err) return setError(err.message);
    setMsg(t('notif.reminded'));
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  const pkgSelect = (value, onChange) =>
    packages.length > 1 && (
      <div>
        <label>{t('pay.package')}</label>
        <select value={value} onChange={onChange}>
          {packages.map((b) => <option key={b.package_id} value={b.package_id}>{pkgLabel(b)}</option>)}
        </select>
      </div>
    );

  return (
    <>
      <p><Link className="link" to="/teacher/payments">← {t('students.back')}</Link></p>
      <h1>{name}</h1>
      <p>
        <Link className="link" to={`/teacher/students/${id}`}>{t('students.open')}: {t('students.title')}</Link>
      </p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
            {packages.reduce((sum, b) => sum + Number(b.outstanding_debt), 0) > 0 && (
        <p>
          <button className="btn btn-light btn-auto btn-small" onClick={sendReminder}>
            🔔 {t('notif.remind')}
          </button>
        </p>
      )}

      <h2>{t('pay.package')}</h2>
      {active ? (
        <>
          <BalanceCards b={active} />
          <div className="card">
            <h2>{t('pay.editPackage')}</h2>
            <div className="grid-2">
              <div>
                <label>{t('pay.lessonsInPackage')}</label>
                <input type="number" min="1" value={pkgForm.total_lessons}
                  onChange={(e) => setPkgForm({ ...pkgForm, total_lessons: e.target.value })} />
              </div>
              <div>
                <label>{t('pay.pricePerLesson')}</label>
                <input type="number" min="0" value={pkgForm.price_per_lesson}
                  onChange={(e) => setPkgForm({ ...pkgForm, price_per_lesson: e.target.value })} />
              </div>
            </div>
            <p className="muted">{t('pay.packageWarn')}</p>
            <div className="row">
              <button className="btn btn-auto" onClick={savePackage}>{t('pay.savePackage')}</button>
              <button className="btn btn-light btn-auto" onClick={startPackage}>{t('pay.startPackage')}</button>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <p className="muted">{t('pay.noPackage')}</p>
          <button className="btn btn-auto" onClick={startPackage}>{t('pay.startPackage')}</button>
        </div>
      )}

      {packages.length > 0 && (
        <>
          <div className="card">
            <h2>{t('pay.addPayment')}</h2>
            <form onSubmit={addPayment}>
              <div className="grid-2">
                <div>
                  <label>{t('pay.amount')}</label>
                  <input type="number" min="1" step="any" value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
                </div>
                <div>
                  <label>{t('pay.date')}</label>
                  <input type="date" value={pay.paid_on}
                    onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} required />
                </div>
                <div>
                  <label>{t('pay.method')}</label>
                  <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                    {METHODS.map((m) => <option key={m} value={m}>{t(`pay.method.${m}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t('pay.comment')}</label>
                  <input value={pay.comment} onChange={(e) => setPay({ ...pay, comment: e.target.value })} />
                </div>
                {pkgSelect(payPkg, (e) => setPay({ ...pay, package_id: e.target.value }))}
              </div>
              <button className="btn btn-auto">{t('pay.record')}</button>
            </form>
          </div>

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
          </div>

          <div className="card">
            <h2>{t('pay.adjust')}</h2>
            <p className="muted">{t('pay.adjustHint')}</p>
            <form onSubmit={addAdjustment}>
              <div className="grid-2">
                <div>
                  <label>{t('pay.adjust')}</label>
                  <select value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value })}>
                    <option value="reduce">{t('pay.reduce')}</option>
                    <option value="increase">{t('pay.increase')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('pay.amount')}</label>
                  <input type="number" min="1" step="any" value={adj.amount}
                    onChange={(e) => setAdj({ ...adj, amount: e.target.value })} required />
                </div>
                <div>
                  <label>{t('pay.reason')}</label>
                  <input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required />
                </div>
                {pkgSelect(adjPkg, (e) => setAdj({ ...adj, package_id: e.target.value }))}
              </div>
              <button className="btn btn-light btn-auto">{t('pay.addAdjust')}</button>
            </form>
            {adjustments.length > 0 && <h2 style={{ marginTop: 20 }}>{t('pay.adjustments')}</h2>}
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
        </>
      )}

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
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';

export default function PasswordForm({ intro }) {
  const { t } = useLang();
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('password.min'));
    if (password !== confirm) return setError(t('password.mismatch'));

    setBusy(true);
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(pwError.message);
      setBusy(false);
      return;
    }
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', session.user.id);
    await refreshProfile();
    setBusy(false);
    navigate('/', { replace: true });
  }

  return (
    <form onSubmit={handleSubmit}>
      {intro && <p>{intro}</p>}
      <label>{t('password.new')}</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      <label>{t('password.confirm')}</label>
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>{t('password.save')}</button>
    </form>
  );
}
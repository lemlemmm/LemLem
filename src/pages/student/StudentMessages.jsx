import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../i18n/LanguageContext';
import ChatThread from '../../components/ChatThread';

export default function StudentMessages() {
  const { t } = useLang();
  const [cid, setCid] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('open_conversation').then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setCid(data);
    });
  }, []);

  return (
    <>
      <h1>{t('nav.messages')}</h1>
      {error && <div className="error">{error}</div>}
      {!cid && !error && <p className="muted">{t('common.loading')}</p>}
      {cid && <ChatThread conversationId={cid} />}
    </>
  );
}
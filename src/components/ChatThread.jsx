import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { useNotify } from '../notify/NotifyContext';
import { fmtDateTime } from '../lib/dates';
import { safeName } from '../lib/files';
import Attachment from './Attachment';

const MAX_MB = 10;

export default function ChatThread({ conversationId }) {
  const { t, lang } = useLang();
  const { profile } = useAuth();
  const { refresh } = useNotify();
  const me = profile.id;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef(null);

  const markRead = useCallback(async () => {
    await supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
    refresh();
  }, [conversationId, refresh]);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) { setError(err.message); setLoading(false); return; }
    const list = (data || []).reverse();
    setMessages(list);
    setLoading(false);
    if (!document.hidden && list.some((m) => m.sender_id !== me && !m.read_at)) markRead();
  }, [conversationId, me, markRead]);

  useEffect(() => { load(); }, [load]);

  // Live updates, plus a check every 15 seconds as a backup
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => load()
      )
      .subscribe();
    const interval = setInterval(load, 15000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  // Scroll to the newest message when the number of messages changes
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    setError('');
    const body = text.trim();
    if (!body && !file) return;
    if (file && file.size > MAX_MB * 1024 * 1024) return setError(t('chat.tooBig', { n: MAX_MB }));

    setBusy(true);
    let file_path = null;
    let file_name = null;
    let file_type = null;
    if (file) {
      file_path = `chat/${conversationId}/${Date.now()}-${safeName(file.name)}`;
      const up = await supabase.storage.from('materials').upload(file_path, file);
      if (up.error) { setBusy(false); return setError(up.error.message); }
      file_name = file.name;
      file_type = file.type || null;
    }

    const { error: err } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: me,
      body: body || null,
      file_path, file_name, file_type,
    });
    if (err) {
      if (file_path) await supabase.storage.from('materials').remove([file_path]);
      setBusy(false);
      return setError(err.message);
    }
    setText('');
    setFile(null);
    setFileKey((k) => k + 1);
    setBusy(false);
    load();
  }

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <div className="chat-box" ref={boxRef}>
        {messages.length === 0 && <p className="muted">{t('chat.empty')}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
              {m.body && <div>{m.body}</div>}
              {m.file_path && <Attachment path={m.file_path} name={m.file_name} type={m.file_type} />}
              <div className="bubble-meta">
                {fmtDateTime(m.created_at, lang)}
                {mine && ` · ${m.read_at ? t('chat.read') : t('chat.sent')}`}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="card">
        <textarea
          rows="3"
          value={text}
          placeholder={t('chat.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        <label>{t('chat.attach', { n: MAX_MB })}</label>
        <input
          key={fileKey}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.mp3,.m4a,.wav"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-auto" disabled={busy}>{t('chat.send')}</button>
      </form>
    </>
  );
}
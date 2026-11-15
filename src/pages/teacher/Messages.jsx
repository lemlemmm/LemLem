import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { useNotify } from '../../notify/NotifyContext';
import { fmtDateTime } from '../../lib/dates';
import ChatThread from '../../components/ChatThread';

function ConversationList() {
  const { t, lang } = useLang();
  const { profile } = useAuth();
  const { unreadMessages } = useNotify(); // refreshes the list when new messages arrive
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const [st, cv, un] = await Promise.all([
        supabase.from('profiles').select('id, full_name, group_members(groups(name))').eq('role', 'student'),
        supabase.from('conversations').select('id, student_id, last_message_at'),
        supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', profile.id),
      ]);
      const convBy = {};
      (cv.data || []).forEach((c) => { convBy[c.student_id] = c; });
      const unreadBy = {};
      (un.data || []).forEach((m) => { unreadBy[m.conversation_id] = (unreadBy[m.conversation_id] || 0) + 1; });

      const list = (st.data || []).map((s) => {
        const c = convBy[s.id];
        return {
          id: s.id,
          name: s.full_name,
          group: s.group_members?.[0]?.groups?.name || '',
          last: c?.last_message_at || null,
          unread: c ? unreadBy[c.id] || 0 : 0,
        };
      }).sort((a, b) => {
        if (a.last && b.last) return new Date(b.last) - new Date(a.last);
        if (a.last) return -1;
        if (b.last) return 1;
        return a.name.localeCompare(b.name);
      });
      setRows(list);
      setLoading(false);
    })();
  }, [profile.id, unreadMessages]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{t('nav.messages')}</h1>
      {rows.length === 0 && <p className="muted">{t('chat.noStudents')}</p>}
      {rows.map((r) => (
        <Link className="card row space-between block-link" to={`/teacher/messages/${r.id}`} key={r.id}>
          <div>
            <strong>{r.name}</strong> {r.group && <span className="badge">{r.group}</span>}
            <div className="muted">
              {r.last ? fmtDateTime(r.last, lang) : t('chat.noMessages')}
            </div>
          </div>
          {r.unread > 0 && <span className="count">{r.unread}</span>}
        </Link>
      ))}
    </>
  );
}

function TeacherChat({ studentId }) {
  const { t } = useLang();
  const [cid, setCid] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    setCid(null);
    (async () => {
      const [c, p] = await Promise.all([
        supabase.rpc('open_conversation', { p_student: studentId }),
        supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
      ]);
      if (off) return;
      if (c.error) return setError(c.error.message);
      setCid(c.data);
      setName(p.data?.full_name || '');
    })();
    return () => { off = true; };
  }, [studentId]);

  return (
    <>
      <p><Link className="link" to="/teacher/messages">← {t('chat.back')}</Link></p>
      <h1>{name}</h1>
      {error && <div className="error">{error}</div>}
      {!cid && !error && <p className="muted">{t('common.loading')}</p>}
      {cid && <ChatThread conversationId={cid} />}
    </>
  );
}

export default function Messages() {
  const { studentId } = useParams();
  return studentId ? <TeacherChat studentId={studentId} /> : <ConversationList />;
}
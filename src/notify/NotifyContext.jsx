import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useMascot } from '../mascot/MascotContext';

const NotifyContext = createContext(null);

export function NotifyProvider({ children }) {
  const { profile } = useAuth();
  const { react, quiet } = useMascot();
  const me = profile?.id;

  const [items, setItems] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Latest values for the live listener (so it does not reconnect on every change)
  const reactRef = useRef(react);
  const quietRef = useRef(quiet);
  useEffect(() => { reactRef.current = react; }, [react]);
  useEffect(() => { quietRef.current = quiet; }, [quiet]);

  const refresh = useCallback(async () => {
    if (!me) return;
    const [n, m] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', me)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('messages').select('id', { count: 'exact', head: true })
        .is('read_at', null).neq('sender_id', me),
    ]);
    setItems(n.data || []);
    setUnreadMessages(m.count || 0);
  }, [me]);

  useEffect(() => {
    if (!me) { setItems([]); setUnreadMessages(0); return undefined; }
    refresh();

    const channel = supabase
      .channel(`notify-${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
        (payload) => {
          refresh();
          // The mascot never interrupts homework or tests
          if (!quietRef.current) {
            reactRef.current(payload.new?.type === 'message_new' ? 'newMessage' : 'newNotice');
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refresh())
      .subscribe();

    const interval = setInterval(refresh, 60000); // backup if live updates are unavailable
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [me, refresh]);

  const markRead = useCallback(async (id) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', me);
  }, [me]);

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', me).eq('is_read', false);
  }, [me]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <NotifyContext.Provider
      value={{ items, unreadCount, unreadMessages, refresh, markRead, markAllRead }}
    >
      {children}
    </NotifyContext.Provider>
  );
}

export const useNotify = () => useContext(NotifyContext);
import { supabase } from './supabase';
import { downloadCsv } from './csv';

// Reads every row (Supabase returns at most 1000 per request)
async function all(build) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

const EXPORTS = {
  students: async () => {
    const [p, s, gm] = await Promise.all([
      all(() => supabase.from('profiles').select('id, full_name, username, email').eq('role', 'student').order('id')),
      all(() => supabase.from('students').select('id, english_level, enrollment_date, lesson_price').order('id')),
      all(() => supabase.from('group_members').select('student_id, groups(name)').order('student_id')),
    ]);
    const sBy = {}; s.forEach((x) => { sBy[x.id] = x; });
    const gBy = {}; gm.forEach((x) => { gBy[x.student_id] = x.groups?.name || ''; });
    return p.map((x) => ({
      name: x.full_name, username: x.username, email: x.email, group: gBy[x.id] || '',
      level: sBy[x.id]?.english_level || '', enrolled: sBy[x.id]?.enrollment_date || '',
      price_per_lesson: sBy[x.id]?.lesson_price ?? '',
    }));
  },

  payments: async () => {
    const [pay, adj] = await Promise.all([
      all(() => supabase.from('payments')
        .select('id, paid_on, amount, method, comment, profiles(full_name)').order('id')),
      all(() => supabase.from('financial_adjustments')
        .select('id, created_at, amount, reason, profiles(full_name)').order('id')),
    ]);
    const rows = [
      ...pay.map((x) => ({
        date: x.paid_on, student: x.profiles?.full_name || '', type: 'payment',
        amount: x.amount, method: x.method, comment: x.comment || '',
      })),
      ...adj.map((x) => ({
        date: String(x.created_at).slice(0, 10), student: x.profiles?.full_name || '', type: 'adjustment',
        amount: x.amount, method: '', comment: x.reason || '',
      })),
    ];
    return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },

  attendance: async () => {
    const data = await all(() => supabase.from('attendance')
      .select('id, status, profiles(full_name), lessons(title, starts_at)').order('id'));
    return data
      .map((x) => ({
        lesson_date: x.lessons?.starts_at || '', lesson: x.lessons?.title || '',
        student: x.profiles?.full_name || '', status: x.status,
      }))
      .sort((a, b) => String(a.lesson_date).localeCompare(String(b.lesson_date)));
  },

  balances: async () => {
    const [b, p] = await Promise.all([
      all(() => supabase.from('package_balance').select('*').order('package_id')),
      all(() => supabase.from('profiles').select('id, full_name').eq('role', 'student').order('id')),
    ]);
    const name = {}; p.forEach((x) => { name[x.id] = x.full_name; });
    return b.map((x) => ({
      student: name[x.student_id] || '', started: x.started_on, active: x.is_active,
      lessons_total: x.total_lessons, lessons_used: x.completed_lessons, lessons_left: x.remaining_lessons,
      price_per_lesson: x.price_per_lesson, total_cost: x.total_cost, total_paid: x.total_paid,
      debt: x.outstanding_debt,
    }));
  },

  lessons: async () => {
    const data = await all(() => supabase.from('lessons')
      .select('id, title, starts_at, duration_min, status, groups(name)').order('id'));
    return data
      .map((x) => ({
        date: x.starts_at, title: x.title, group: x.groups?.name || '',
        minutes: x.duration_min, status: x.status,
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },
};

export async function exportCsv(kind) {
  const rows = await EXPORTS[kind]();
  downloadCsv(`aisha-apai-${kind}-${today()}.csv`, rows);
}

export const EXPORT_KINDS = Object.keys(EXPORTS);
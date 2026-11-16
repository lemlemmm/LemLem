import { supabase } from './supabase';

const NIL = '00000000-0000-0000-0000-000000000000';
const DONE = ['submitted', 'checked'];

// Works for both roles: Row Level Security limits a student to their own records.
// role = 'teacher' | 'student' (decides which question tables can be read)
export async function loadProgress(studentId, role) {
  const gm = await supabase.from('group_members').select('group_id').eq('student_id', studentId);
  if (gm.error) throw new Error(gm.error.message);
  const groupIds = (gm.data || []).map((x) => x.group_id);
  const gids = groupIds.length ? groupIds : [NIL];

  const [att, hw, hs, ts, ls] = await Promise.all([
    supabase.from('attendance').select('status').eq('student_id', studentId),
    supabase.from('homework').select('id, title, deadline, max_score').in('group_id', gids),
    supabase.from('homework_submissions')
      .select('homework_id, status, final_score, results').eq('student_id', studentId),
    supabase.from('test_submissions')
      .select('test_id, status, final_score, results, tests(title, max_score)').eq('student_id', studentId),
    supabase.from('lessons')
      .select('id, title, topic, starts_at, lesson_materials(kind, title)')
      .in('group_id', gids).eq('status', 'completed').order('starts_at'),
  ]);
  [att, hw, hs, ts, ls].forEach((r) => { if (r.error) throw new Error(r.error.message); });

  // ----- Attendance -----
  const count = { present: 0, excused: 0, unexcused: 0, rescheduled: 0 };
  (att.data || []).forEach((a) => { count[a.status] = (count[a.status] || 0) + 1; });
  const denom = count.present + count.excused + count.unexcused;
  const attendancePct = denom > 0 ? (count.present / denom) * 100 : null;

  // ----- Homework -----
  const hwList = hw.data || [];
  const subBy = {};
  (hs.data || []).forEach((s) => { subBy[s.homework_id] = s; });
  const isDone = (h) => DONE.includes(subBy[h.id]?.status);
  const hwDone = hwList.filter(isDone).length;
  const hwOverdue = hwList.filter((h) => h.deadline && new Date(h.deadline) < new Date() && !isDone(h)).length;
  const hwScores = hwList
    .filter((h) => subBy[h.id]?.status === 'checked' && h.max_score > 0)
    .map((h) => (Number(subBy[h.id].final_score) / h.max_score) * 100);
  const hwAvg = hwScores.length ? hwScores.reduce((a, b) => a + b, 0) / hwScores.length : null;

  // ----- Tests -----
  const testsChecked = (ts.data || [])
    .filter((s) => s.status === 'checked' && s.tests)
    .map((s) => ({
      id: s.test_id,
      title: s.tests.title,
      score: Number(s.final_score),
      max: s.tests.max_score,
      pct: s.tests.max_score > 0 ? (Number(s.final_score) / s.tests.max_score) * 100 : null,
    }));
  const withPct = testsChecked.filter((x) => x.pct != null);
  const testAvg = withPct.length ? withPct.reduce((a, b) => a + b.pct, 0) / withPct.length : null;

  // ----- Results by question type (graded answers only) -----
  const hwIds = hwList.map((h) => h.id);
  const testIds = (ts.data || []).filter((s) => s.status === 'checked').map((s) => s.test_id);
  const [hq, tq] = await Promise.all([
    hwIds.length
      ? supabase.from(role === 'teacher' ? 'homework_questions' : 'student_homework_questions')
          .select('id, type').in('homework_id', hwIds)
      : { data: [] },
    testIds.length
      ? supabase.from(role === 'teacher' ? 'test_questions' : 'student_test_questions')
          .select('id, type').in('test_id', testIds)
      : { data: [] },
  ]);
  const typeOf = {};
  [...(hq.data || []), ...(tq.data || [])].forEach((q) => { typeOf[q.id] = q.type; });

  const acc = {};
  const addResults = (results) => {
    Object.entries(results || {}).forEach(([qid, r]) => {
      if (!r || r.manual) return;
      const type = typeOf[qid];
      if (!type) return;
      if (!acc[type]) acc[type] = { earned: 0, max: 0 };
      acc[type].earned += Number(r.earned) || 0;
      acc[type].max += Number(r.max) || 0;
    });
  };
  (hs.data || []).filter((s) => s.status === 'checked' && hwIds.includes(s.homework_id))
    .forEach((s) => addResults(s.results));
  (ts.data || []).filter((s) => s.status === 'checked').forEach((s) => addResults(s.results));

  const byType = Object.entries(acc)
    .filter(([, v]) => v.max > 0)
    .map(([type, v]) => ({
      type,
      earned: Math.round(v.earned * 10) / 10,
      max: Math.round(v.max * 10) / 10,
      pct: (v.earned / v.max) * 100,
    }))
    .sort((a, b) => a.pct - b.pct);

  // ----- Topics, grammar, vocabulary (from completed lessons) -----
  const lessons = ls.data || [];
  const topics = [];
  const grammar = [];
  const vocab = [];
  lessons.forEach((l) => {
    if (l.topic && l.topic.trim()) topics.push({ title: l.topic.trim(), when: l.starts_at });
    (l.lesson_materials || []).forEach((m) => {
      if (m.kind === 'grammar') grammar.push({ title: m.title, when: l.starts_at });
      if (m.kind === 'vocabulary') vocab.push({ title: m.title, when: l.starts_at });
    });
  });

  // ----- Areas to improve -----
  const weak = [];
  byType.filter((x) => x.max >= 3 && x.pct < 60).forEach((x) => weak.push({ kind: 'type', ...x }));
  if (attendancePct != null && denom >= 3 && attendancePct < 80) {
    weak.push({ kind: 'attendance', pct: Math.round(attendancePct) });
  }
  if (hwOverdue > 0) weak.push({ kind: 'overdue', n: hwOverdue });
  if (hwList.length >= 3 && hwDone / hwList.length < 0.7) weak.push({ kind: 'hwlow' });

  return {
    count, attendancePct,
    held: lessons.length, attended: count.present,
    hw: { total: hwList.length, done: hwDone, overdue: hwOverdue, avg: hwAvg },
    tests: testsChecked, testAvg,
    byType, topics, grammar, vocab, weak,
  };
}
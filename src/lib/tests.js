// 'upcoming' | 'open' | 'closed' (based on opening and closing times)
export function testWindow(test) {
  const now = Date.now();
  if (test.opens_at && now < new Date(test.opens_at).getTime()) return 'upcoming';
  if (test.closes_at && now > new Date(test.closes_at).getTime()) return 'closed';
  return 'open';
}

// A started attempt whose time ran out (plus 90 seconds of tolerance) but was never submitted
export const attemptOver = (test, sub) =>
  !!sub && sub.status === 'in_progress' &&
  Date.now() > new Date(sub.started_at).getTime() + test.time_limit_min * 60000 + 90000;
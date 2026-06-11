interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string; // 'YYYY-MM-DD'
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Call once when the user lands on /tutor.
 * Updates localStorage and returns the current streak state + whether
 * the streak just incremented today (used to trigger a celebration).
 */
export function updateStreak(): { data: StreakData; justIncremented: boolean } {
  if (typeof window === 'undefined') {
    return { data: { currentStreak: 1, longestStreak: 1, lastVisitDate: today() }, justIncremented: false };
  }

  const raw = localStorage.getItem('chronos_streak');
  const t = today();

  if (!raw) {
    const data: StreakData = { currentStreak: 1, longestStreak: 1, lastVisitDate: t };
    localStorage.setItem('chronos_streak', JSON.stringify(data));
    return { data, justIncremented: true };
  }

  const stored: StreakData = JSON.parse(raw);

  // Already visited today — nothing changes
  if (stored.lastVisitDate === t) {
    return { data: stored, justIncremented: false };
  }

  let newStreak: number;
  if (stored.lastVisitDate === yesterday()) {
    // Consecutive day — extend streak
    newStreak = stored.currentStreak + 1;
  } else {
    // Gap of 2+ days — streak resets
    newStreak = 1;
  }

  const data: StreakData = {
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, stored.longestStreak),
    lastVisitDate: t,
  };
  localStorage.setItem('chronos_streak', JSON.stringify(data));
  return { data, justIncremented: true };
}

export function readStreak(): StreakData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('chronos_streak');
  return raw ? JSON.parse(raw) : null;
}

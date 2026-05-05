export function setPoints(reps, lift) {
  if (reps == null || reps < lift.repsMin) return 0;
  const rangeSize = lift.repsMax - lift.repsMin;
  return Math.min(reps - lift.repsMin, rangeSize);
}

export function liftScore(sets, lift) {
  return sets.reduce((sum, set) => sum + setPoints(set.reps, lift), 0);
}

export function maxLiftScore(lift) {
  return lift.sets * (lift.repsMax - lift.repsMin);
}

export function isLiftMax(sets, lift) {
  return liftScore(sets, lift) === maxLiftScore(lift);
}

export function shouldLevelUp(liftState) {
  return liftState.streakAtMax >= 2;
}

export function nextWeight(liftState, lift) {
  if (shouldLevelUp(liftState)) {
    return liftState.weight + lift.increment;
  }
  return liftState.weight;
}

export function applyDeload(weight) {
  const reduced = weight * 0.8;
  return Math.round(reduced / 2.5) * 2.5;
}

export function weeklyScore(sessions, weekStart, weekEnd) {
  return Object.entries(sessions)
    .filter(([date]) => date >= weekStart && date <= weekEnd)
    .reduce((total, [, session]) => {
      return total + Object.values(session.lifts || {})
        .reduce((s, e) => s + (e ? (e.score || 0) : 0), 0);
    }, 0);
}

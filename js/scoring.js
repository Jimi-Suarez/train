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

export function sumReps(reps) {
  if (!reps) return 0;
  return reps.reduce((a, b) => a + b, 0);
}

export function sessionState(currentReps, lastReps) {
  if (!lastReps) return 'baseline';
  const curr = sumReps(currentReps);
  const last = sumReps(lastReps);
  if (curr > last) return 'win';
  if (curr === last) return 'hold';
  return 'miss';
}

export function hitTopOfRangeAllSets(currentReps, repsMax) {
  if (!currentReps || currentReps.length === 0) return false;
  return currentReps.every(r => r >= repsMax);
}

export function shouldSuggestDeload(currentReps, repsMin) {
  if (!currentReps || currentReps.length === 0) return false;
  return currentReps.some(r => r < repsMin);
}

export function applyDeload(weight) {
  const reduced = weight * 0.8;
  return Math.round(reduced / 2.5) * 2.5;
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

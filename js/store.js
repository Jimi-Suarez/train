import { computeRatio } from './isak.js';
import { liftById } from './programme.js';

const ROOT_KEY = 'train.jimi.v1';
let state = null;

function defaultState() {
  return {
    version: 1,
    lifts: {},
    sessions: {},
    meals: {},
    isak: {},
    reviews: {},
    habits: {},
    photos: {},
    disruptions: {},
    settings: {
      proteinTarget: 150,
      kcalTarget: 2050,
      accountabilityContact: null,
      startedAt: null,
    },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch {
    state = defaultState();
  }
  return state;
}

function save() {
  localStorage.setItem(ROOT_KEY, JSON.stringify(state));
}

export function getState() {
  if (!state) load();
  return state;
}

export function seedFirstSession() {
  const DATE = '2026-05-04';
  const s = getState();
  if (s.sessions[DATE]) return;

  const squatEntry = {
    date: DATE,
    sets: [
      { weight: 95, reps: 8, increment: 5, points: 0 },
      { weight: 95, reps: 8, increment: 5, points: 0 },
      { weight: 95, reps: 8, increment: 5, points: 0 },
    ],
    score: 0,
    max: 8,   // squat: 4 sets × (10−8)
    deload: false,
    warmupSkipped: false,
    weight: 95,
  };

  const ohpEntry = {
    date: DATE,
    sets: [
      { weight: 45, reps: 8, increment: 2.5, points: 0 },
      { weight: 45, reps: 8, increment: 2.5, points: 0 },
      { weight: 45, reps: 8, increment: 2.5, points: 0 },
    ],
    score: 0,
    max: 6,   // standing-press: 3 sets × (10−8)
    deload: false,
    warmupSkipped: false,
    weight: 45,
  };

  s.sessions[DATE] = {
    sessionId: 'legs',
    startedAt:   new Date(DATE + 'T06:00:00').getTime(),
    completedAt: new Date(DATE + 'T07:00:00').getTime(),
    deload: false,
    lifts: { squat: squatEntry, 'standing-press': ohpEntry },
    deferred: [],
    note: 'First session. Subbed programme — pull-ups 3×2 and rollouts 3×6.',
  };

  if (!s.lifts['squat']) {
    s.lifts['squat'] = { weight: 95, level: 1, streakAtMax: 0, lastSession: squatEntry, history: [squatEntry] };
  }
  if (!s.lifts['standing-press']) {
    s.lifts['standing-press'] = { weight: 45, level: 1, streakAtMax: 0, lastSession: ohpEntry, history: [ohpEntry] };
  }

  save();
}

export function seedLiftWeights() {
  const WEIGHTS = {
    'incline-bb':        62.5,
    'pullup':            0,
    'bicep-curl':        40,
    'lat-raise':         7.5,
    'face-pull':         27.5,
    'squat':             95,
    'standing-press':    45,
    'deadlift':          120,
    'cable-row':         70,
    'db-row':            35,
    'rdl':               70,
    'bb-row':            65,
    'db-shoulder-press': 22,
    'leg-press':         120,
    'leg-curl':          35,
    'back-ext':          0,
    'flat-db':           22,
    'cable-fly':         12,
    'tricep-pushdown':   25,
    'plank':             30,
  };

  const s = getState();
  let changed = false;

  // Force-correct pullup to bodyweight regardless of existing value
  s.lifts['pullup'] = {
    weight: 0,
    level: s.lifts['pullup']?.level || 1,
    streakAtMax: s.lifts['pullup']?.streakAtMax || 0,
    lastSession: s.lifts['pullup']?.lastSession || null,
    history: s.lifts['pullup']?.history || [],
  };
  changed = true;

  for (const [id, weight] of Object.entries(WEIGHTS)) {
    if (!s.lifts[id]) {
      s.lifts[id] = { weight, level: 1, streakAtMax: 0, lastSession: null, history: [] };
      changed = true;
    }
  }
  if (changed) save();
}

export function seedIfEmpty(seedData) {
  const s = getState();
  if (!s.isak || Object.keys(s.isak).length === 0) {
    s.isak = seedData.isak;
    if (!s.settings.startedAt) {
      s.settings.startedAt = Object.keys(seedData.isak).sort()[0];
    }
    save();
  }
}

export function migrateToLastReps() {
  const s = getState();
  if (s.settings.migratedToLastReps) return;

  // All completed sessions, newest first
  const completedSessions = Object.entries(s.sessions)
    .filter(([, session]) => session.completedAt)
    .sort(([a], [b]) => b.localeCompare(a));

  for (const [liftId, liftState] of Object.entries(s.lifts)) {
    if (!liftState) continue;

    const lift = liftById(liftId);
    let lastReps = null;
    let consecutiveTopOfRange = 0;

    // Find most recent completed session that recorded this lift
    for (const [, session] of completedSessions) {
      const entry = (session.lifts || {})[liftId];
      if (entry && Array.isArray(entry.sets) && entry.sets.length > 0) {
        lastReps = entry.sets.map(set => set.reps);
        if (lift) {
          consecutiveTopOfRange = lastReps.every(r => r >= lift.repsMax) ? 1 : 0;
        }
        break;
      }
    }

    // Mark the first (oldest) history entry as baseline — no prior data existed to compare against
    const history = (liftState.history || []).map((entry, i) =>
      i === 0 ? { ...entry, state: 'baseline' } : entry
    );

    // Keep lastSession in sync if there is only one history entry
    let lastSession = liftState.lastSession;
    if (lastSession && history.length === 1) {
      lastSession = { ...lastSession, state: 'baseline' };
    }

    s.lifts[liftId] = { ...liftState, lastReps, consecutiveTopOfRange, history, lastSession };
  }

  s.settings.migratedToLastReps = true;
  save();

  console.log('[migration] lift baselines set:', Object.fromEntries(
    Object.entries(s.lifts).map(([id, l]) => [id, l.lastReps])
  ));
}

// --- Lifts ---

export function getLift(liftId) {
  return getState().lifts[liftId] || null;
}

export function setLift(liftId, data) {
  const s = getState();
  s.lifts[liftId] = { ...(s.lifts[liftId] || {}), ...data };
  save();
}

export function initLift(liftId, weight) {
  const s = getState();
  if (!s.lifts[liftId]) {
    s.lifts[liftId] = { weight, level: 1, streakAtMax: 0, lastSession: null, history: [] };
    save();
  }
}

// --- Sessions ---

export function getSession(date) {
  return getState().sessions[date] || null;
}

export function setSession(date, data) {
  const s = getState();
  s.sessions[date] = { ...(s.sessions[date] || {}), ...data };
  save();
}

export function getAllSessions() {
  return getState().sessions;
}

// --- Meals ---

export function getMeals(date) {
  return getState().meals[date] || null;
}

export function setMeal(date, mealId, stateVal) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date][mealId] = stateVal;
  save();
}

export function setBites(date, count) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].bites = count;
  save();
}

export function setFamilyMeal(date, replacingMealId) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].familyMeal = replacingMealId ? { replacing: replacingMealId } : null;
  if (replacingMealId) s.meals[date][replacingMealId] = 'replaced';
  save();
}

export function getAllMeals() {
  return getState().meals;
}

// --- ISAK ---

export function getISAK(date) {
  return getState().isak[date] || null;
}

export function setISAK(date, data) {
  const s = getState();
  s.isak[date] = { ...(s.isak[date] || {}), ...data };
  if (s.isak[date].waist && s.isak[date].height) {
    s.isak[date].ratio = computeRatio(s.isak[date]);
  }
  save();
}

export function getAllISAK() {
  return getState().isak || {};
}

// --- Reviews ---

export function getReview(week) {
  return getState().reviews[week] || null;
}

export function setReview(week, data) {
  const s = getState();
  s.reviews[week] = { ...(s.reviews[week] || {}), ...data };
  save();
}

// --- Habits ---

export function getHabits(date) {
  return getState().habits[date] || {};
}

export function setHabit(date, key, value) {
  const s = getState();
  if (!s.habits[date]) s.habits[date] = {};
  s.habits[date][key] = value;
  save();
}

// --- Photos ---

export function getPhoto(yearMonth) {
  return getState().photos[yearMonth] || null;
}

export function setPhoto(yearMonth, data) {
  const s = getState();
  s.photos[yearMonth] = data;
  save();
}

export function getAllPhotos() {
  return getState().photos || {};
}

// --- Disruptions ---

export function setDisruption(date, data) {
  const s = getState();
  s.disruptions[date] = data;
  save();
}

export function getAllDisruptions() {
  return getState().disruptions || {};
}

// --- Settings ---

export function getSetting(key) {
  return getState().settings[key];
}

export function setSetting(key, value) {
  const s = getState();
  s.settings[key] = value;
  save();
}

// --- Export / Import / Reset ---

export function exportJSON() {
  return JSON.stringify(getState(), null, 2);
}

export function importJSON(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.version) throw new Error('Invalid backup file');
  state = parsed;
  save();
}

export function wipeAll() {
  localStorage.removeItem(ROOT_KEY);
  state = defaultState();
}

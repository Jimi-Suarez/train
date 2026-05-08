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
      nextSessionIndex: 0,
    },
  };
}

export function load() {
  try {
    let raw = localStorage.getItem(ROOT_KEY);
    if (!raw) {
      const backup = localStorage.getItem(ROOT_KEY + '.backup');
      if (backup) {
        console.warn('[store] Main key missing — recovering from backup');
        localStorage.setItem(ROOT_KEY, backup);
        raw = backup;
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = defaultState();
      state = {
        ...def,
        ...parsed,
        settings: { ...def.settings, ...(parsed.settings || {}) },
      };
    } else {
      state = defaultState();
    }
  } catch {
    state = defaultState();
  }
  if (state.settings.nextSessionIndex === undefined) {
    state.settings.nextSessionIndex = 2;
    save();
  }
  return state;
}

function save() {
  const serialised = JSON.stringify(state);
  try {
    localStorage.setItem(ROOT_KEY, serialised);
    localStorage.setItem(ROOT_KEY + '.backup', serialised);
  } catch (err) {
    console.error('[store] localStorage save failed:', err);
    return;
  }
  const readBack = localStorage.getItem(ROOT_KEY);
  if (readBack === null || readBack !== serialised) {
    console.warn('[store] Save verification failed — data may not be persisting');
    const backup = localStorage.getItem(ROOT_KEY + '.backup');
    if (backup === serialised) console.log('[store] Backup key has the correct data');
  }
}

export function getState() {
  if (!state) load();
  return state;
}

export function seedHistoricalSessions() {
  const s = getState();

  // Clean up the May 4 empty shell — that wasn't a real programme session
  if (s.sessions['2026-05-04'] && Object.keys(s.sessions['2026-05-04'].lifts || {}).length === 0) {
    delete s.sessions['2026-05-04'];
  }

  const SEED = [
    {
      date: '2026-05-06', sessionId: 'pull',
      startedAt: '2026-05-06T06:00:00', completedAt: '2026-05-06T07:00:00',
      note: null,
      lifts: [
        { id: 'pullup',      weight: 0,    reps: [3, 3, 3] },
        { id: 'cable-row',   weight: 70,   reps: [8, 8, 8] },
        { id: 'db-row',      weight: 35,   reps: [8, 8, 8] },
        { id: 'face-pull',   weight: 27.5, reps: [8, 8, 8] },
        { id: 'bicep-curl',  weight: 40,   reps: [8, 8, 8] },
      ],
    },
    {
      date: '2026-05-08', sessionId: 'legs',
      startedAt: '2026-05-08T06:30:00', completedAt: '2026-05-08T07:30:00',
      note: 'Time-pressed. back-ext 2×8 only. Leg press at top of range.',
      lifts: [
        { id: 'squat',     weight: 100, reps: [8, 8, 6] },
        { id: 'rdl',       weight: 80,  reps: [8, 8, 8] },
        { id: 'leg-press', weight: 200, reps: [12, 12, 12] },
        { id: 'leg-curl',  weight: 46,  reps: [8, 8, 8] },
        { id: 'back-ext',  weight: 20,  reps: [8, 8] },
      ],
    },
  ];

  // Write sessions — skip only if a real session (with lifts) already exists for that date
  for (const sess of SEED) {
    const existing = s.sessions[sess.date];
    const hasLifts = existing && existing.lifts && Object.keys(existing.lifts).length > 0;
    if (hasLifts) continue;
    const liftsMap = {};
    for (const l of sess.lifts) {
      const def = liftById(l.id);
      liftsMap[l.id] = {
        date: sess.date,
        sets: l.reps.map(reps => ({ weight: l.weight, reps, increment: def ? def.increment : 2.5 })),
        deload: false, warmupSkipped: false, weight: l.weight,
        state: null, prevLastReps: null,
      };
    }
    s.sessions[sess.date] = {
      sessionId:   sess.sessionId,
      startedAt:   new Date(sess.startedAt).getTime(),
      completedAt: new Date(sess.completedAt).getTime(),
      deload: false, lifts: liftsMap, deferred: [], note: sess.note,
    };
  }

  // Collect all lift IDs that appear in any seed session
  const seedLiftIds = new Set(SEED.flatMap(sess => sess.lifts.map(l => l.id)));

  // Rebuild s.lifts for each seed lift by walking ALL sessions in date order.
  // This includes any real sessions logged after the seed data, keeping state consistent.
  for (const liftId of seedLiftIds) {
    const def = liftById(liftId);

    const allEntries = Object.keys(s.sessions).sort().flatMap(date => {
      const sess = s.sessions[date];
      if (!sess.completedAt) return [];
      const le = (sess.lifts || {})[liftId];
      if (!le || !Array.isArray(le.sets) || le.sets.length === 0) return [];
      return [{ date, weight: le.weight, reps: le.sets.map(set => set.reps) }];
    });

    if (allEntries.length === 0) continue;

    const history = [];
    let prevWeight = null;
    let prevReps   = null;

    for (const entry of allEntries) {
      const weightChanged = prevWeight !== null && entry.weight !== prevWeight;
      const prevLastReps  = weightChanged ? null : prevReps;
      const curr  = entry.reps.reduce((a, b) => a + b, 0);
      const last  = prevLastReps ? prevLastReps.reduce((a, b) => a + b, 0) : 0;
      const state = !prevLastReps ? 'baseline'
        : curr > last ? 'win' : curr === last ? 'hold' : 'miss';

      const histEntry = {
        date: entry.date,
        sets: entry.reps.map(reps => ({ weight: entry.weight, reps, increment: def ? def.increment : 2.5 })),
        deload: false, warmupSkipped: false, weight: entry.weight,
        state, prevLastReps,
      };
      history.push(histEntry);

      if (s.sessions[entry.date]?.lifts?.[liftId]) {
        s.sessions[entry.date].lifts[liftId].state        = state;
        s.sessions[entry.date].lifts[liftId].prevLastReps = prevLastReps;
      }

      prevWeight = entry.weight;
      prevReps   = entry.reps;
    }

    const lastEntry = allEntries[allEntries.length - 1];
    const lastReps  = lastEntry.reps;

    let consecutiveTopOfRange = 0;
    for (let i = allEntries.length - 1; i >= 0; i--) {
      if (allEntries[i].weight !== lastEntry.weight) break;
      if (def && allEntries[i].reps.every(r => r >= def.repsMax)) consecutiveTopOfRange++;
      else break;
    }

    s.lifts[liftId] = {
      ...(s.lifts[liftId] || {}),
      weight:               lastEntry.weight,
      lastSession:          history[history.length - 1],
      history,
      lastReps,
      consecutiveTopOfRange,
    };
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
    lastSession: s.lifts['pullup']?.lastSession || null,
    history: s.lifts['pullup']?.history || [],
  };
  changed = true;

  for (const [id, weight] of Object.entries(WEIGHTS)) {
    if (!s.lifts[id]) {
      s.lifts[id] = { weight, lastSession: null, history: [] };
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
}

// --- Session rotation ---

const SESSION_SEQUENCE = ['push', 'pull', 'legs', 'full'];

export function advanceSession(completedSessionId) {
  const s = getState();
  const idx = SESSION_SEQUENCE.indexOf(completedSessionId);
  if (idx !== -1) {
    s.settings.nextSessionIndex = (idx + 1) % SESSION_SEQUENCE.length;
    save();
  }
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
    s.lifts[liftId] = { weight, lastSession: null, history: [] };
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

export function incrementFruit(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].fruit = (s.meals[date].fruit || 0) + 1;
  save();
}

export function incrementAlcohol(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].alcohol = (s.meals[date].alcohol || 0) + 1;
  save();
}

export function incrementTapa(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].tapa = (s.meals[date].tapa || 0) + 1;
  save();
}

export function decrementTapa(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].tapa = Math.max(0, (s.meals[date].tapa || 0) - 1);
  save();
}

export function decrementFruit(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].fruit = Math.max(0, (s.meals[date].fruit || 0) - 1);
  save();
}

export function decrementAlcohol(date) {
  const s = getState();
  if (!s.meals[date]) s.meals[date] = {};
  s.meals[date].alcohol = Math.max(0, (s.meals[date].alcohol || 0) - 1);
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

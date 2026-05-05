export const SESSIONS = {
  push: {
    id: 'push', name: 'Push', day: 1,
    subtitle: 'Chest · Shoulders · Triceps',
    icon: '⤒',
    note: 'Priority: upper chest and shoulders.',
    lifts: [
      { id: 'incline-bb',         name: 'Incline Barbell Press',        sets: 4, repsMin: 8,  repsMax: 10, increment: 2.5, kpi: true,  firstLift: true, restSeconds: 120, note: 'Upper chest priority. 30-45° incline. Control the descent.' },
      { id: 'db-shoulder-press',  name: 'Seated DB Shoulder Press',     sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,             restSeconds: 120, note: 'Builds shoulder width. Dumbbells at ear level to start.' },
      { id: 'cable-fly',          name: 'Cable Chest Fly (low to high)',sets: 3, repsMin: 12, repsMax: 15, increment: 2.5,             restSeconds: 90,  note: 'Cable set low, pull upward and across. Slight forward lean.' },
      { id: 'lat-raise',          name: 'Lateral Raises',               sets: 3, repsMin: 12, repsMax: 15, increment: 1,              restSeconds: 90,  note: 'Lighter weight, full control. Lead with elbows, not hands.' },
      { id: 'tricep-pushdown',    name: 'Tricep Rope Pushdown',         sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,            restSeconds: 90,  note: 'Keep elbows pinned to sides. Split the rope at the bottom.' },
    ],
  },
  pull: {
    id: 'pull', name: 'Pull', day: 2,
    subtitle: 'Back · Biceps',
    icon: '⤓',
    note: 'A strong back pulls posture up.',
    lifts: [
      { id: 'pullup',      name: 'Pull-ups / Lat Pulldown',  sets: 4, repsMin: 6,  repsMax: 10, increment: 2.5, kpi: true, firstLift: true, bodyweight: true, restSeconds: 120, note: 'Pull-ups: max reps, add weight when easy. Pulldown: 4 challenging sets. Full hang at bottom.' },
      { id: 'cable-row',   name: 'Seated Cable Row',          sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,                            restSeconds: 120, note: 'Squeeze shoulder blades at the top. Don\'t rock back.' },
      { id: 'db-row',      name: 'Single-Arm DB Row',         sets: 3, repsMin: 8,  repsMax: 10, increment: 2.5,                            restSeconds: 120, note: 'Brace on bench. Pull elbow to hip, not shoulder.' },
      { id: 'face-pull',   name: 'Face Pulls',                sets: 3, repsMin: 12, repsMax: 15, increment: 1,                             restSeconds: 90,  note: 'Shoulder health essential. Pull to forehead, elbows high.' },
      { id: 'bicep-curl',  name: 'Bicep Curl (machine/cable)', sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,                           restSeconds: 90,  note: 'No swinging. 3 seconds down. Supinate at the top.' },
    ],
  },
  legs: {
    id: 'legs', name: 'Legs', day: 3,
    subtitle: 'Squats · Hinges · Posterior',
    icon: '⤳',
    note: 'Biggest muscles = biggest calorie burn.',
    lifts: [
      { id: 'squat',     name: 'Back Squat / Goblet Squat', sets: 4, repsMin: 8,  repsMax: 10, increment: 5, kpi: true, firstLift: true, restSeconds: 180, note: 'Goblet if technique needs work. Depth over weight. Chest up.' },
      { id: 'rdl',       name: 'Romanian Deadlift',          sets: 3, repsMin: 8,  repsMax: 10, increment: 2.5,                           restSeconds: 120, note: 'Hinge at hips, soft knee. Feel the hamstring stretch.' },
      { id: 'leg-press', name: 'Leg Press',                  sets: 3, repsMin: 10, repsMax: 12, increment: 5,                             restSeconds: 120, note: 'High foot placement. Push through heels. Don\'t lock knees.' },
      { id: 'back-ext',  name: 'Back Extensions',            sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,                           restSeconds: 90,  note: 'Slow, controlled. No hyperextension at the top.' },
      { id: 'leg-curl',  name: 'Leg Curl',                   sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,                           restSeconds: 90,  note: 'Hamstring isolation. 3 seconds down. Don\'t cheat the hip.' },
    ],
  },
  full: {
    id: 'full', name: 'Full Body', day: 4,
    subtitle: 'Heavy · Functional',
    icon: '⊕',
    note: 'Heavy and functional. Your strongest session.',
    lifts: [
      { id: 'deadlift',       name: 'Deadlift',                    sets: 4, repsMin: 5, repsMax: 6,  increment: 5,   kpi: true, firstLift: true, restSeconds: 180, note: 'The king. Brace hard. Drive the floor away. Hips and shoulders rise together.' },
      { id: 'flat-db',        name: 'Flat DB Press',               sets: 3, repsMin: 8, repsMax: 10, increment: 2.5, feelerWarmup: true,          restSeconds: 120, note: 'Lower chest and overall thickness. Controlled eccentric.' },
      { id: 'bb-row',         name: 'Barbell Row',                 sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,                              restSeconds: 120, note: 'Bent over, bar to belly button. Brace and pull.' },
      { id: 'standing-press', name: 'Standing OHP (BB or DB)',      sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,                              restSeconds: 120, note: 'Standing engages core. Brace before each rep.' },
      { id: 'plank',          name: 'Plank',                       sets: 3, repsMin: 30, repsMax: 60, increment: 0, isTime: true,                 restSeconds: 60,  note: 'Reps = seconds held. Brace abs, squeeze glutes.' },
    ],
  },
};

export const DAY_SESSION = { 1: 'push', 2: 'pull', 3: 'legs', 4: 'full' };

export const KPI_LIFTS = ['incline-bb', 'deadlift', 'squat', 'pullup'];

export const DEFAULT_WEIGHTS = {
  'incline-bb':        50,
  'db-shoulder-press': 14,
  'cable-fly':         11,
  'lat-raise':          7,
  'tricep-pushdown':   20,
  'pullup':             0,
  'cable-row':         45,
  'db-row':            20,
  'face-pull':         13,
  'bicep-curl':        10,
  'squat':             55,
  'rdl':               55,
  'leg-press':         90,
  'back-ext':           0,
  'leg-curl':          35,
  'deadlift':          80,
  'flat-db':           18,
  'bb-row':            45,
  'standing-press':    18,
  'plank':             30,
};

export const SUBSTITUTIONS = {
  'incline-bb':  ['incline-db', 'machine-incline-press'],
  'pullup':      ['lat-pulldown', 'assisted-pullup'],
  'squat':       ['goblet-squat', 'leg-press'],
  'deadlift':    ['rdl', 'trap-bar-deadlift'],
  'cable-row':   ['db-row', 'bb-row'],
  'flat-db':        ['incline-bb', 'machine-press'],
  'bb-row':         ['cable-row', 'db-row'],
  'standing-press': ['db-standing-press', 'seated-bb-press'],
  'bicep-curl':     ['db-curl', 'ez-bar-curl', 'hammer-curl'],
};

export function sessionForDay(dow) {
  return DAY_SESSION[dow] ? SESSIONS[DAY_SESSION[dow]] : null;
}

export function allLifts() {
  return Object.values(SESSIONS).flatMap(s => s.lifts);
}

export function liftById(id) {
  return allLifts().find(l => l.id === id) || null;
}

export function warmupSets(workingWeight, lift) {
  if (lift.bodyweight || workingWeight <= 0) {
    return [{ label: 'Band-assisted or scapula retractions × 5' }];
  }
  const empty = 20;
  const half  = Math.round((workingWeight * 0.5) / 2.5) * 2.5;
  return [
    { weight: empty, reps: 5, label: `Empty bar (${empty}kg) × 5` },
    { weight: half,  reps: 5, label: `${half}kg × 5` },
  ];
}

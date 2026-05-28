const STORAGE_KEY = 'train.routine.v1';

export const BLOCKS = {
  gym: [
    { title: 'Launch',     sub: 'Wake · gym · shower + skincare · protein shake',                          tag: 'train'  },
    { title: 'School run', sub: 'Ella to school · Billie in carrier · Masterclass in ears · keep walking', tag: 'learn'  },
    { title: 'Breakfast',  sub: 'Cook and eat · Billie settling in',                                       tag: 'rest'   },
    { title: 'Babel',      sub: 'Billie on the mat · sit-down Spanish session',                            tag: 'learn'  },
    { title: 'Rodsuco',    sub: 'One task only · decided last night · full focus',                         tag: 'work'   },
    { title: 'Lunch',      sub: 'Proper meal · from batch cook',                                           tag: 'rest'   },
    { title: 'Babel',      sub: 'Nap 3 · sit-down session',                                               tag: 'learn'  },
    { title: 'Keyboard',   sub: 'Celia does pickup · quiet house · headphones on · just play',             tag: 'learn'  },
    { title: 'Family',     sub: 'Ella home · dinner · bath · stories · Ella bed 20:00',                    tag: 'family' },
    { title: 'Close',      sub: 'Your 45 min · kit out · task written · Babel prepped · lights out',       tag: 'rest'   },
  ],
  run: [
    { title: 'Launch',     sub: 'Wake · run 45 min · shower + skincare · protein shake',                   tag: 'train'  },
    { title: 'School run', sub: 'Ella to school · Billie in carrier · Masterclass in ears · keep walking', tag: 'learn'  },
    { title: 'Breakfast',  sub: 'Cook and eat · morning is slower · let it breathe',                       tag: 'rest'   },
    { title: 'Babel',      sub: 'Billie on the mat · sit-down Spanish session',                            tag: 'learn'  },
    { title: 'Rodsuco',    sub: 'One task only · decided last night · full focus',                         tag: 'work'   },
    { title: 'Lunch',      sub: 'Proper meal from batch cook',                                             tag: 'rest'   },
    { title: 'Babel',      sub: 'Nap 3 · sit-down session',                                               tag: 'learn'  },
    { title: 'Keyboard',   sub: 'Celia does pickup · quiet house · just play',                             tag: 'learn'  },
    { title: 'Family',     sub: 'Ella home · dinner · bath · stories · Ella bed 20:00',                    tag: 'family' },
    { title: 'Close',      sub: 'Your 45 min · kit out · task written · Babel prepped · lights out',       tag: 'rest'   },
  ],
  batch: [
    { title: 'Launch',      sub: 'Wake · gym or run · shower + skincare · protein shake',                         tag: 'train'  },
    { title: 'School run',  sub: 'Ella to school · Billie in carrier · Masterclass in ears · keep walking',        tag: 'learn'  },
    { title: 'Breakfast',   sub: 'Cook and eat · Billie settling in',                                              tag: 'rest'   },
    { title: 'Babel',       sub: 'Billie on the mat · awake window session',                                       tag: 'learn'  },
    { title: 'Rodsuco',     sub: 'One task only · full focus · non-negotiable',                                    tag: 'work'   },
    { title: 'Lunch',       sub: 'Eat from existing batch stock',                                                  tag: 'rest'   },
    { title: 'Batch cook',  sub: 'Nap 3 · Sun: big cook · Wed: mid-week refresh · interruptible',                  tag: 'rest'   },
    { title: 'Keyboard',    sub: 'Celia does pickup · quiet house · just play',                                    tag: 'learn'  },
    { title: 'Family',      sub: 'Ella home · dinner already done · batch cook pays off',                          tag: 'family' },
    { title: 'Close',       sub: 'Your 45 min · kit out · task written · Babel prepped · lights out',              tag: 'rest'   },
  ],
};

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function loadRoutineState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveRoutineState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearRoutineState() {
  localStorage.removeItem(STORAGE_KEY);
}

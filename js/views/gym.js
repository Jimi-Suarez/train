import * as store from '../store.js';
import * as time from '../time.js';
import { SESSIONS, DAY_SESSION, DEFAULT_WEIGHTS, SUBSTITUTIONS, warmupSets, liftById } from '../programme.js';
import { setPoints, liftScore, maxLiftScore, isLiftMax, shouldLevelUp, applyDeload } from '../scoring.js';

const MOBILITY_PHASES = [
  { name: '90/90 Hip Flow',           instruction: 'Rotate between positions',              seconds: 90 },
  { name: "World's Greatest Stretch",  instruction: 'Lunge + T-spine rotation, 5 each side', seconds: 90 },
  { name: 'Band Pull-Aparts',          instruction: 'Shoulder rolls, slow and controlled',    seconds: 60 },
  { name: 'Goblet Squat Hold',         instruction: 'Hold deep position, breathe',            seconds: 60 },
];

const DISRUPTION_OPTIONS = [
  { key: 'bad-sleep',    label: 'Bad sleep'    },
  { key: 'work',         label: 'Work'         },
  { key: 'family',       label: 'Family'       },
  { key: 'illness',      label: 'Illness'      },
  { key: 'travel',       label: 'Travel'       },
  { key: 'didnt-feel-it',label: "Didn't feel"  },
];

let s = null;  // gym state
let rafId = null;
let el_ref = null;

function defaultState() {
  return {
    phase: 'idle',
    sessionType: null,
    lifts: [],
    liftIndex: 0,
    setIndex: 0,
    deload: false,
    timePressedMode: false,
    selectedLifts: null,
    deferred: [],
    currentSets: [],
    mobilityIndex: 0,
    mobilityEndMs: 0,
    restEndMs: 0,
    restTotalMs: 0,
    currentWeight: 0,
    currentReps: 0,
    warmupIndex: 0,
    warmupDone: false,
    selectedDisruption: null,
    sessionNote: '',
    wakeLock: null,
  };
}

export function mount(el) {
  el_ref = el;
  if (!s || s.phase === 'idle') {
    s = defaultState();
    detectActiveSession();
  }
  render();
}

export function unmount() {
  cancelRaf();
  releaseWakeLock();
}

function detectActiveSession() {
  const todayDate = time.today();
  const session   = store.getSession(todayDate);
  if (session && session.startedAt && !session.completedAt && session._gymState) {
    const saved = session._gymState;
    const sessionDef = SESSIONS[session.sessionId];
    if (sessionDef) {
      s.phase       = saved.phase || 'lift';
      s.sessionType = session.sessionId;
      s.lifts       = sessionDef.lifts.slice();
      s.liftIndex   = saved.liftIndex || 0;
      s.setIndex    = saved.setIndex  || 0;
      s.deload      = session.deload || false;
      s.deferred    = session.deferred || [];
      s.currentSets = saved.currentSets || [];
      s.currentWeight = saved.currentWeight || currentLiftWeight();
      s.currentReps   = saved.currentReps   || topOfRange(currentLift());
    }
  }
}

// ─── Render dispatcher ───────────────────────────────────────────────────────

function render() {
  if (!el_ref) return;
  switch (s.phase) {
    case 'idle':      renderIdle();      break;
    case 'pre':       renderPre();       break;
    case 'mobility':  renderMobility();  break;
    case 'warmup':    renderWarmup();    break;
    case 'lift':      renderLift();      break;
    case 'rest':      renderRest();      break;
    case 'between':   renderBetween();   break;
    case 'summary':   renderSummary();   break;
  }
}

// ─── Idle ─────────────────────────────────────────────────────────────────────

function renderIdle() {
  const todayDate = time.today();
  const dow       = time.dayOfWeek(todayDate);
  const sessionId = DAY_SESSION[dow];
  const sessionDef = sessionId ? SESSIONS[sessionId] : null;

  let content = '';
  if (sessionDef) {
    content = `
      <div class="gym-phase-label">Today's session</div>
      <div style="font-size:28px;font-weight:700;margin:4px 0 4px">${sessionDef.icon} ${sessionDef.name} Day</div>
      <div class="text-muted text-sm" style="margin-bottom:24px">${sessionDef.subtitle}</div>
      <button class="btn btn-primary" id="start-session-btn">Start session →</button>
      <div style="height:16px"></div>
      <button class="btn btn-ghost btn-sm" id="tell-someone-btn" style="width:auto;align-self:flex-start">
        Tell someone you're training →
      </button>`;
  } else if (dow === 5) {
    content = `<div class="session-card" style="cursor:default">
        <div class="session-card-icon">◎</div>
        <div class="session-card-name">Friday flex</div>
        <div class="session-card-sub">Cardio / extra session / rest — your call.</div>
      </div>`;
  } else if (dow === 6) {
    content = `<div class="session-card" style="cursor:default">
        <div class="session-card-icon">⟳</div>
        <div class="session-card-name">Easy run · 45 min</div>
        <div class="session-card-sub">The weekend ritual. Don't skip it.</div>
      </div>`;
  } else {
    content = `<div class="session-card" style="cursor:default">
        <div class="session-card-icon">◯</div>
        <div class="session-card-name">Rest day</div>
        <div class="session-card-sub">Big day tomorrow.</div>
      </div>`;
  }

  el_ref.innerHTML = `<div class="gym-wrap">${content}</div>`;

  el_ref.querySelector('#start-session-btn')?.addEventListener('click', () => {
    s.sessionType = sessionId;
    s.lifts       = sessionDef.lifts.slice();
    s.phase       = 'pre';
    render();
  });

  el_ref.querySelector('#tell-someone-btn')?.addEventListener('click', () => {
    const text = `Going in for ${sessionDef.name} day. Back in 60.`;
    if (navigator.share) navigator.share({ text });
    else alert(text);
  });
}

// ─── Pre-session ──────────────────────────────────────────────────────────────

function renderPre() {
  const sessionDef = SESSIONS[s.sessionType];
  const liftRows = s.lifts.map(lift => {
    const liftSt = store.getLift(lift.id);
    let weight   = liftSt ? liftSt.weight : DEFAULT_WEIGHTS[lift.id] ?? 0;
    if (s.deload) weight = applyDeload(weight);
    const label  = lift.isTime ? `${lift.repsMin}–${lift.repsMax}s hold` : `${lift.repsMin}–${lift.repsMax} reps`;
    return `
      <li class="presession-item">
        <div>
          <div class="presession-lift-name">${lift.name}</div>
          <div class="presession-lift-meta">${lift.sets}×${label}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700">${weight === 0 ? 'BW' : weight + 'kg'}</span>
          ${s.deload ? '<span class="deload-badge">DELOAD</span>' : ''}
        </div>
      </li>`;
  }).join('');

  el_ref.innerHTML = `
    <div class="gym-wrap">
      <div class="gym-phase-label">${sessionDef.icon} ${sessionDef.name} Day</div>
      <div style="color:var(--text2);font-size:13px;margin-bottom:16px">${sessionDef.subtitle}</div>

      <ul class="presession-list">${liftRows}</ul>

      <div class="toggle-row" style="margin-bottom:20px">
        <label class="toggle-label" for="deload-toggle">Bad sleep last night?</label>
        <label class="toggle" for="deload-toggle">
          <input type="checkbox" id="deload-toggle" ${s.deload ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row" style="margin-bottom:24px">
        <label class="toggle-label" for="timepressed-toggle">Time-pressed mode?</label>
        <label class="toggle" for="timepressed-toggle">
          <input type="checkbox" id="timepressed-toggle" ${s.timePressedMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <button class="btn btn-primary" id="begin-btn">Start session →</button>
    </div>`;

  el_ref.querySelector('#deload-toggle').addEventListener('change', e => {
    s.deload = e.target.checked;
    renderPre();
  });

  el_ref.querySelector('#timepressed-toggle').addEventListener('change', e => {
    s.timePressedMode = e.target.checked;
  });

  el_ref.querySelector('#begin-btn').addEventListener('click', () => {
    if (s.timePressedMode) {
      pickTimePressedLifts();
      return;
    }
    startSession();
    s.phase = 'mobility';
    s.mobilityIndex = 0;
    render();
  });
}

function pickTimePressedLifts() {
  const compoundLift = s.lifts.find(l => l.firstLift);
  const others       = s.lifts.filter(l => !l.firstLift);

  const sheet = document.createElement('div');
  sheet.className = 'modal-overlay';
  sheet.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Time-pressed — pick your lifts</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
        ${compoundLift.name} is always included. Pick 1–2 more.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:12px 14px;border-radius:10px;background:var(--lime-dim);
                    border:1px solid rgba(196,255,61,.3)">
          <span style="font-size:15px;font-weight:600">${compoundLift.name}</span>
          <span style="font-size:12px;color:var(--lime);font-weight:700">INCLUDED</span>
        </div>
        ${others.map(l => `
          <button class="btn btn-ghost timepressed-lift-btn" data-lift-id="${l.id}"
                  style="justify-content:flex-start;gap:10px;text-align:left;
                         border-radius:10px;padding:12px 14px">
            <span style="font-size:15px;font-weight:500;flex:1">${l.name}</span>
            <span class="timepressed-check" style="font-size:18px;color:var(--text3)">○</span>
          </button>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--text3);text-align:center;margin-bottom:16px" id="tp-count-label">
        0 of 2 extra lifts selected
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="tp-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="tp-go-btn">Start session →</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);

  const selected = new Set();
  const MAX_EXTRA = 2;

  function updateLabel() {
    sheet.querySelector('#tp-count-label').textContent =
      `${selected.size} of ${MAX_EXTRA} extra lifts selected`;
  }

  sheet.querySelectorAll('.timepressed-lift-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.liftId;
      const check = btn.querySelector('.timepressed-check');
      if (selected.has(id)) {
        selected.delete(id);
        check.textContent = '○';
        check.style.color = 'var(--text3)';
        btn.style.borderColor = '';
        btn.style.color = '';
      } else if (selected.size < MAX_EXTRA) {
        selected.add(id);
        check.textContent = '●';
        check.style.color = 'var(--lime)';
        btn.style.borderColor = 'var(--lime)';
        btn.style.color = 'var(--lime)';
      }
      updateLabel();
    });
  });

  sheet.querySelector('#tp-cancel-btn').addEventListener('click', () => sheet.remove());
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });

  sheet.querySelector('#tp-go-btn').addEventListener('click', () => {
    const extraLifts = others.filter(l => selected.has(l.id));
    s.lifts = [compoundLift, ...extraLifts];
    sheet.remove();
    startSession();
    s.phase = 'mobility';
    s.mobilityIndex = 0;
    render();
  });
}

function startSession() {
  const todayDate = time.today();
  const existing  = store.getSession(todayDate);
  if (!existing || !existing.startedAt) {
    store.setSession(todayDate, {
      sessionId: s.sessionType,
      startedAt: Date.now(),
      completedAt: null,
      deload: s.deload,
      lifts: Object.fromEntries(s.lifts.map(l => [l.id, null])),
      deferred: [],
      note: null,
    });
  }
  requestWakeLock();
}

// ─── Mobility ─────────────────────────────────────────────────────────────────

function renderMobility() {
  cancelRaf();
  const phase = MOBILITY_PHASES[s.mobilityIndex];
  if (!phase) {
    startWarmup();
    return;
  }

  if (s.mobilityEndMs <= Date.now()) {
    s.mobilityEndMs = Date.now() + phase.seconds * 1000;
  }

  el_ref.innerHTML = `
    <div class="gym-wrap" style="text-align:center">
      <div class="gym-phase-label">General mobility</div>
      <div class="mobility-exercise">${phase.name}</div>
      <div class="mobility-instruction">${phase.instruction}</div>
      <div class="big-number text-lime" id="mob-timer" style="margin:20px 0">${phase.seconds}</div>
      <div class="mobility-progress-label">Exercise ${s.mobilityIndex + 1} of ${MOBILITY_PHASES.length}</div>
      <div class="progress-bar-wrap" style="margin-bottom:28px">
        <div class="progress-bar-fill" id="mob-bar" style="width:0%"></div>
      </div>
      <button class="btn btn-ghost" id="skip-mob-btn">Skip mobility →</button>
    </div>`;

  el_ref.querySelector('#skip-mob-btn').addEventListener('click', () => {
    cancelRaf();
    startWarmup();
  });

  tickMobility();
}

function tickMobility() {
  const remaining = Math.max(0, Math.ceil((s.mobilityEndMs - Date.now()) / 1000));
  const el_timer  = document.getElementById('mob-timer');
  const el_bar    = document.getElementById('mob-bar');
  if (el_timer) el_timer.textContent = remaining;
  if (el_bar) {
    const total = MOBILITY_PHASES[s.mobilityIndex].seconds;
    const pct   = Math.round((1 - remaining / total) * 100);
    el_bar.style.width = pct + '%';
  }

  if (remaining <= 0) {
    s.mobilityIndex++;
    s.mobilityEndMs = 0;
    render();
    return;
  }
  rafId = requestAnimationFrame(tickMobility);
}

function startWarmup() {
  s.phase = 'warmup';
  s.warmupIndex = 0;
  s.warmupDone  = false;
  render();
}

// ─── Warmup ───────────────────────────────────────────────────────────────────

function renderWarmup() {
  const lift   = s.lifts[0];
  const liftSt = store.getLift(lift.id);
  const wt     = liftSt ? liftSt.weight : DEFAULT_WEIGHTS[lift.id] ?? 0;
  const wSets  = warmupSets(wt, lift);
  const current = wSets[s.warmupIndex];

  if (!current || s.warmupIndex >= wSets.length) {
    startLift(0);
    return;
  }

  el_ref.innerHTML = `
    <div class="gym-wrap">
      <div class="gym-phase-label">${lift.name} · Warmup</div>
      <div class="warmup-set">
        <div class="warmup-set-label">Set ${s.warmupIndex + 1} of ${wSets.length}</div>
        <div class="warmup-set-detail">${current.label}</div>
        <button class="btn btn-primary" id="warmup-done-btn">Tap when done</button>
      </div>
      <button class="btn btn-ghost" style="margin-top:12px" id="skip-warmup-btn">Skip warmup →</button>
    </div>`;

  el_ref.querySelector('#warmup-done-btn').addEventListener('click', () => {
    s.warmupIndex++;
    if (s.warmupIndex >= wSets.length) {
      startLift(0);
    } else {
      render();
    }
  });

  el_ref.querySelector('#skip-warmup-btn').addEventListener('click', () => {
    startLift(0);
  });
}

// ─── Lift ─────────────────────────────────────────────────────────────────────

function startLift(index) {
  s.phase      = 'lift';
  s.liftIndex  = index;
  s.setIndex   = 0;
  s.currentSets = [];
  const lift   = s.lifts[index];
  if (!lift) { finishSession(); return; }
  const liftSt = store.getLift(lift.id);
  let weight   = liftSt ? liftSt.weight : DEFAULT_WEIGHTS[lift.id] ?? 0;
  if (s.deload) weight = applyDeload(weight);
  s.currentWeight = weight;
  s.currentReps   = topOfRange(lift);
  saveGymState();
  render();
}

function topOfRange(lift) {
  return lift ? lift.repsMax : 10;
}

function currentLift() { return s.lifts[s.liftIndex]; }
function currentLiftWeight() {
  const lift   = currentLift();
  const liftSt = lift ? store.getLift(lift.id) : null;
  return liftSt ? liftSt.weight : DEFAULT_WEIGHTS[lift?.id] ?? 0;
}

function renderLift() {
  const lift   = currentLift();
  if (!lift) { finishSession(); return; }
  const liftSt = store.getLift(lift.id);
  const streak = liftSt ? liftSt.streakAtMax : 0;
  const streakDots = '●'.repeat(streak) + '○'.repeat(2 - streak);

  const setsDone = s.currentSets.length;
  const setsDots = s.lifts[s.liftIndex] ?
    Array.from({ length: lift.sets }, (_, i) =>
      `<div class="set-dot ${i < setsDone ? 'done' : ''}"></div>`
    ).join('') : '';

  const runningScore = s.currentSets.reduce((sum, set) => sum + setPoints(set.reps, lift), 0);
  const maxScore     = maxLiftScore(lift);
  const context      = contextLine(lift, liftSt);

  const weightDisplay = s.currentWeight === 0 ? 'Bodyweight' : `${s.currentWeight} kg`;

  el_ref.innerHTML = `
    <div class="gym-wrap">
      <div class="lift-header">
        <div>
          <div class="gym-phase-label">${lift.name}</div>
          <div style="font-size:13px;color:var(--text2)">Level ${liftSt ? liftSt.level : 1} · <span class="streak-dots">${streakDots}</span></div>
        </div>
        <div class="skip-link" id="skip-lift-btn">skip lift →</div>
      </div>

      <div class="lift-context">${context}</div>

      <div class="set-input-area">
        <div class="set-label">SET ${setsDone + 1} of ${lift.sets}</div>
        <div class="set-weight-display" id="weight-display">
          ${weightDisplay} <span class="set-weight-edit-icon">✎</span>
        </div>
        <div class="rep-controls">
          <button class="rep-btn" id="rep-minus">−</button>
          <div class="rep-number" id="rep-number">${s.currentReps}</div>
          <button class="rep-btn" id="rep-plus">+</button>
        </div>
        <button class="btn btn-primary" id="set-complete-btn" style="font-size:18px;min-height:60px">
          Set complete
        </button>
      </div>

      <div class="set-footer">
        <div class="set-dots">${setsDots}</div>
        <div class="set-score-label">Score: ${runningScore} / ${maxScore}</div>
      </div>

    </div>`;

  bindLiftEvents();
}

function bindLiftEvents() {
  el_ref.querySelector('#rep-minus').addEventListener('click', () => {
    s.currentReps = Math.max(0, s.currentReps - 1);
    document.getElementById('rep-number').textContent = s.currentReps;
  });
  el_ref.querySelector('#rep-plus').addEventListener('click', () => {
    s.currentReps++;
    document.getElementById('rep-number').textContent = s.currentReps;
  });

  el_ref.querySelector('#set-complete-btn').addEventListener('click', () => {
    logSet();
  });

  el_ref.querySelector('#weight-display').addEventListener('click', () => {
    showWeightEdit();
  });

  el_ref.querySelector('#skip-lift-btn').addEventListener('click', () => {
    skipLift();
  });

}

function logSet() {
  const lift = currentLift();
  const pts  = setPoints(s.currentReps, lift);
  s.currentSets.push({ weight: s.currentWeight, reps: s.currentReps, increment: lift.increment, points: pts });

  if (s.currentSets.length >= lift.sets) {
    completeLift();
  } else {
    s.setIndex = s.currentSets.length;
    s.currentReps = topOfRange(lift);
    startRest();
  }
}

function startRest() {
  const lift = currentLift();
  s.phase       = 'rest';
  s.restTotalMs = lift.restSeconds * 1000;
  s.restEndMs   = Date.now() + s.restTotalMs;
  saveGymState();
  renderRest();
}

function renderRest() {
  cancelRaf();
  const lift = currentLift();
  const nextSetNum = s.currentSets.length + 1;
  const nextTarget = lift ? topOfRange(lift) : 0;
  const nextWeightStr = s.currentWeight === 0 ? 'BW' : `${s.currentWeight}kg`;

  el_ref.innerHTML = `
    <div class="gym-wrap rest-screen">
      <div class="rest-label">Rest</div>
      <div class="rest-time text-lime" id="rest-countdown">—</div>
      <div class="rest-bar-wrap">
        <div class="rest-bar-fill" id="rest-bar" style="width:100%"></div>
      </div>
      <div class="rest-next">
        Next: Set ${nextSetNum} of ${lift ? lift.sets : '?'} · ${nextWeightStr} · target ${nextTarget}
      </div>
      <div class="rest-controls">
        <button class="btn btn-ghost btn-sm" id="rest-plus">+30s</button>
        <button class="btn btn-ghost btn-sm" id="rest-minus">−30s</button>
        <button class="btn btn-secondary btn-sm" id="skip-rest">Skip rest</button>
      </div>
    </div>
    <div class="rest-flash" id="rest-flash"></div>`;

  el_ref.querySelector('#rest-plus').addEventListener('click',  () => { s.restEndMs += 30000; });
  el_ref.querySelector('#rest-minus').addEventListener('click', () => { s.restEndMs = Math.max(Date.now() + 1000, s.restEndMs - 30000); });
  el_ref.querySelector('#skip-rest').addEventListener('click',  () => {
    cancelRaf();
    s.phase = 'lift';
    render();
  });
  el_ref.querySelector('.rest-screen').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    cancelRaf();
    s.phase = 'lift';
    render();
  });

  tickRest();
}

function tickRest() {
  const remaining = Math.max(0, s.restEndMs - Date.now());
  const secs      = Math.ceil(remaining / 1000);
  const pct       = Math.round((remaining / s.restTotalMs) * 100);

  const el_cd  = document.getElementById('rest-countdown');
  const el_bar = document.getElementById('rest-bar');
  const el_flash = document.getElementById('rest-flash');

  if (el_cd)  el_cd.textContent  = time.formatMinSec(secs);
  if (el_bar) el_bar.style.width = pct + '%';

  if (secs === 30 && el_flash && !el_flash.dataset.amber) {
    el_flash.dataset.amber = '1';
    el_flash.className = 'rest-flash amber-flash show';
    el_flash.textContent = '30 SECONDS';
    setTimeout(() => { if (el_flash) el_flash.className = 'rest-flash'; }, 1500);
  }

  if (remaining <= 0) {
    if (el_flash) {
      el_flash.className = 'rest-flash lime-flash show';
      el_flash.textContent = 'GO';
      setTimeout(() => { if (el_flash) el_flash.className = 'rest-flash'; }, 1000);
    }
    s.phase = 'lift';
    setTimeout(() => render(), 1200);
    return;
  }

  rafId = requestAnimationFrame(tickRest);
}

// ─── Lift complete ─────────────────────────────────────────────────────────────

function completeLift() {
  cancelRaf();
  const lift   = currentLift();
  const liftSt = store.getLift(lift.id);
  const score  = liftScore(s.currentSets, lift);
  const maxS   = maxLiftScore(lift);
  const isMax  = score === maxS;

  // Build session entry
  const entry = {
    date: time.today(),
    sets: s.currentSets.slice(),
    score,
    max: maxS,
    deload: s.deload,
    warmupSkipped: s.warmupIndex === 0 && s.phase !== 'warmup',
    weight: s.currentWeight,
  };

  // Update store: session lifts
  const todayDate = time.today();
  const session   = store.getSession(todayDate) || {};
  const sessionLifts = { ...(session.lifts || {}) };
  sessionLifts[lift.id] = entry;
  store.setSession(todayDate, { lifts: sessionLifts });

  // Update lift progression
  if (!s.deload) {
    let newStreak = liftSt ? (liftSt.streakAtMax || 0) : 0;
    if (isMax) newStreak = Math.min(2, newStreak + 1);
    else newStreak = 0;

    const levelingUp = newStreak >= 2 && liftSt;
    let newWeight = liftSt ? liftSt.weight : s.currentWeight;
    let newLevel  = liftSt ? liftSt.level  : 1;

    if (levelingUp) {
      newWeight += lift.increment;
      newLevel++;
      newStreak = 0;
    }

    const history = liftSt ? [...(liftSt.history || [])] : [];
    history.push(entry);

    store.setLift(lift.id, {
      weight: newWeight,
      level: newLevel,
      streakAtMax: newStreak,
      lastSession: entry,
      history,
    });
  }

  s.phase = 'between';
  saveGymState();
  renderBetween();
}

function renderBetween() {
  const lift   = currentLift();
  const liftSt = store.getLift(lift.id);
  const todayDate = time.today();
  const session   = store.getSession(todayDate) || {};
  const entry     = (session.lifts || {})[lift.id];
  const score     = entry ? entry.score : 0;
  const maxS      = entry ? entry.max   : maxLiftScore(lift);
  const streak    = liftSt ? liftSt.streakAtMax : 0;
  const dots      = '●'.repeat(streak) + '○'.repeat(2 - streak);
  const nextLiftIdx = nextLiftIndex();
  const hasDeferred = s.deferred.length > 0;

  let nextBtn = '';
  if (nextLiftIdx !== null) {
    const nextLift = s.lifts[nextLiftIdx];
    nextBtn = `<button class="btn btn-primary" id="next-lift-btn" data-index="${nextLiftIdx}">
      Next: ${nextLift.name} →
    </button>`;
  } else if (hasDeferred) {
    const defLift = s.lifts.find(l => s.deferred.includes(l.id));
    nextBtn = defLift ? `
      <button class="btn btn-secondary" id="do-deferred-btn">${defLift.name} still open — do it now?</button>
      <div style="height:10px"></div>
      <button class="btn btn-ghost" id="end-early-btn">End session early</button>` : '';
  } else {
    nextBtn = `<button class="btn btn-primary" id="finish-btn">Finish session →</button>`;
  }

  const levelUpLine = (liftSt && liftSt.streakAtMax === 0 && entry && entry.score === entry.max)
    ? `<div class="level-up-notice">⚡ LEVEL UP NEXT SESSION — ${liftSt.weight + lift.increment}kg</div>`
    : '';

  el_ref.innerHTML = `
    <div class="gym-wrap between-lifts">
      <div class="gym-phase-label">${lift.name} · Done</div>
      <div class="lift-result-score">${score} / ${maxS} <span class="streak-dots">${dots}</span></div>
      ${levelUpLine}
      <div style="height:24px"></div>
      ${nextBtn}
    </div>`;

  el_ref.querySelector('#next-lift-btn')?.addEventListener('click', (e) => {
    startLift(parseInt(e.currentTarget.dataset.index));
  });
  el_ref.querySelector('#do-deferred-btn')?.addEventListener('click', () => {
    const defIdx = s.lifts.findIndex(l => s.deferred.includes(l.id));
    if (defIdx !== -1) {
      s.deferred = s.deferred.filter(id => id !== s.lifts[defIdx].id);
      startLift(defIdx);
    }
  });
  el_ref.querySelector('#end-early-btn')?.addEventListener('click', finishSession);
  el_ref.querySelector('#finish-btn')?.addEventListener('click', finishSession);
}

function nextLiftIndex() {
  for (let i = s.liftIndex + 1; i < s.lifts.length; i++) {
    if (!s.deferred.includes(s.lifts[i].id)) return i;
  }
  return null;
}

function skipLift() {
  const lift = currentLift();
  s.deferred.push(lift.id);
  const next = nextLiftIndex();
  if (next !== null) {
    startLift(next);
  } else if (s.deferred.length > 0) {
    s.phase = 'between';
    renderBetween();
  } else {
    finishSession();
  }
}

// ─── Session summary ──────────────────────────────────────────────────────────

function finishSession() {
  cancelRaf();
  releaseWakeLock();
  const todayDate = time.today();
  store.setSession(todayDate, { completedAt: Date.now() });
  s.phase = 'summary';
  renderSummary();
}

function renderSummary() {
  const todayDate = time.today();
  const session   = store.getSession(todayDate) || {};
  const sessionDef = SESSIONS[s.sessionType];

  let totalScore = 0, totalMax = 0;
  const liftRows = s.lifts.map(lift => {
    const entry = (session.lifts || {})[lift.id];
    const score = entry ? entry.score : 0;
    const maxS  = entry ? entry.max   : maxLiftScore(lift);
    const liftSt = store.getLift(lift.id);
    const streak = liftSt ? liftSt.streakAtMax : 0;
    const dots   = '●'.repeat(streak) + '○'.repeat(2 - streak);
    const lvlUp  = liftSt && !s.deload && entry && entry.score === entry.max && streak === 0;
    totalScore += score;
    totalMax   += maxS;
    return `
      <div class="summary-lift-row">
        <span class="summary-lift-name">${lift.name}</span>
        <span class="summary-lift-score">${score}/${maxS}</span>
        <span class="streak-dots" style="font-size:12px">${dots}</span>
        ${lvlUp ? '<span class="text-amber" style="font-size:12px">⚡</span>' : ''}
      </div>`;
  }).join('');

  const pct   = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const showDisruption = pct < 50;

  const { start, end } = time.weekStartEnd();
  const wkScore = Math.round(Object.values(store.getAllSessions()).filter((_, i) => {
    const d = Object.keys(store.getAllSessions())[i];
    return d >= start && d <= todayDate;
  }).reduce((sum, s) => sum + Object.values(s.lifts || {}).reduce((ss, e) => ss + (e ? e.score : 0), 0), 0));

  el_ref.innerHTML = `
    <div class="summary-wrap">
      <div class="gym-phase-label">${sessionDef ? sessionDef.name : 'Session'} Day · Done</div>
      <div style="font-size:32px;font-weight:700;margin:8px 0">
        ${totalScore} / ${totalMax}
        <span style="font-size:18px;color:var(--text2)">(${pct}%)</span>
      </div>
      <div class="card" style="padding:0 16px;margin-bottom:16px">
        ${liftRows}
      </div>

      ${showDisruption ? `
        <div class="section-label">What got in the way?</div>
        <div class="disruption-grid" id="disruption-grid">
          ${DISRUPTION_OPTIONS.map(d => `
            <button class="disruption-btn" data-key="${d.key}">${d.label}</button>`).join('')}
        </div>` : ''}

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        <button class="btn btn-ghost" id="accountability-btn">📤 Send accountability message</button>
        <button class="btn btn-ghost" id="add-note-btn">Add a note</button>
        <button class="btn btn-primary" id="done-btn">Done</button>
      </div>
    </div>`;

  // Disruption buttons
  el_ref.querySelectorAll('.disruption-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el_ref.querySelectorAll('.disruption-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      store.setDisruption(todayDate, { reason: btn.dataset.key, sessionId: s.sessionType });
    });
  });

  el_ref.querySelector('#accountability-btn')?.addEventListener('click', () => {
    const text = `${sessionDef ? sessionDef.name : 'Session'} day done — ${totalScore}/${totalMax}.`;
    if (navigator.share) navigator.share({ text });
    else alert(text);
  });

  el_ref.querySelector('#add-note-btn')?.addEventListener('click', () => {
    const note = prompt('Add a note:');
    if (note) store.setSession(todayDate, { note });
  });

  el_ref.querySelector('#done-btn').addEventListener('click', () => {
    s = defaultState();
    location.hash = '/today';
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contextLine(lift, liftSt) {
  if (!liftSt || !liftSt.lastSession) {
    return `First time on this lift. Pick a weight you can do for ${lift.repsMin} reps.`;
  }
  if (s.deload) {
    return `Deload day: ${s.currentWeight}kg. Just complete the reps.`;
  }
  const last    = liftSt.lastSession;
  const lastMax = last.score === last.max;
  const streak  = liftSt.streakAtMax;

  if (streak >= 2) {
    return `Two perfect sessions. New weight today: ${s.currentWeight}kg. Aim for ${lift.repsMin} reps.`;
  }
  if (lastMax) {
    return `Last time: PERFECT ${last.score}/${last.max}. Hit max again today and you level up.`;
  }
  const repsStr = (last.sets || []).map(s => s.reps).join('-');
  return `Last time: ${last.weight || s.currentWeight}kg · ${repsStr} (${last.score}pt). Same weight — push for ${lift.repsMax}s.`;
}

function showWeightEdit() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Change weight</div>
      <input class="modal-input" type="number" step="2.5" id="weight-modal-input" value="${s.currentWeight}" />
      <div class="modal-actions">
        <button class="btn btn-ghost" id="weight-cancel">Cancel</button>
        <button class="btn btn-primary" id="weight-confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#weight-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#weight-confirm').addEventListener('click', () => {
    const val = parseFloat(modal.querySelector('#weight-modal-input').value);
    if (!isNaN(val)) s.currentWeight = val;
    modal.remove();
    render();
  });
}

function saveGymState() {
  const todayDate = time.today();
  store.setSession(todayDate, {
    _gymState: {
      phase: s.phase,
      liftIndex: s.liftIndex,
      setIndex: s.setIndex,
      currentSets: s.currentSets,
      currentWeight: s.currentWeight,
      currentReps: s.currentReps,
    }
  });
}

async function requestWakeLock() {
  if ('wakeLock' in navigator && !s.wakeLock) {
    try { s.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
}

function releaseWakeLock() {
  if (s.wakeLock) { s.wakeLock.release().catch(() => {}); s.wakeLock = null; }
}

function cancelRaf() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

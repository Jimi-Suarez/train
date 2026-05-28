import * as store from '../store.js';
import * as time from '../time.js';
import * as nutrition from '../nutrition.js';
import { KPI_LIFTS } from '../programme.js';
import { loadRoutineState, saveRoutineState, clearRoutineState, BLOCKS } from './routine.js';

const KPI_NAMES = {
  'incline-bb': 'Incline',
  'deadlift':   'Deadlift',
  'squat':      'Squat',
  'pullup':     'Pull-ups',
};

const TAG_COLORS = {
  train:  'var(--accent)',
  work:   '#4a9eff',
  learn:  '#f5a623',
  family: '#ff6b6b',
  rest:   'var(--text2)',
};

export function mount(el) {
  render(el);
}

export function unmount() {}

function render(el) {
  const state      = store.getState();
  const todayDate  = time.today();
  const routine    = loadRoutineState();
  const isToday    = !!(routine && routine.date === todayDate);
  const isDone     = isToday && routine.completedIndex >= BLOCKS[routine.dayType].length;

  el.innerHTML = `
    <div style="padding:16px 16px 100px">
      ${zone1(routine, isToday, isDone, todayDate)}
      ${zone2(routine, isToday, isDone)}
      ${zone3(state, todayDate)}
    </div>`;

  bindEvents(el, state, todayDate, routine, isToday, isDone);
}

// ─── Zone 1: Right now ───────────────────────────────────────────────────────

function zone1(routine, isToday, isDone, todayDate) {
  if (!isToday)  return dayPickerHTML();
  if (isDone)    return routineDoneHTML();
  return currentBlockHTML(routine);
}

function dayPickerHTML() {
  return `
    <div style="margin-bottom:16px">
      <div class="section-label" style="margin-bottom:12px">Today</div>
      ${pickCard('gym',   'Gym day',        'Train · Rodsuco · Babel · family')}
      ${pickCard('run',   'Run day',        'Run · Rodsuco · Babel · family')}
      ${pickCard('batch', 'Batch cook day', 'Cook · Rodsuco · Babel · family')}
    </div>`;
}

function pickCard(type, title, sub) {
  return `
    <div class="routine-pick-card" data-type="${type}" style="
      background:var(--surface);border:0.5px solid var(--border);
      border-radius:14px;padding:18px 20px;margin-bottom:10px;cursor:pointer;
    ">
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
      <div style="font-size:12px;color:var(--text2)">${sub}</div>
    </div>`;
}

function currentBlockHTML(routine) {
  const block = BLOCKS[routine.dayType][routine.completedIndex];
  const tagColor = TAG_COLORS[block.tag] || 'var(--text2)';
  return `
    <div style="
      background:var(--surface);border-radius:14px;
      border-left:4px solid var(--accent);
      padding:20px 20px 20px 16px;margin-bottom:12px;
    ">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${tagColor}">${block.tag}</span>
        <button id="routine-restart" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;padding:0;line-height:1">restart</button>
      </div>
      <div style="font-size:34px;font-weight:800;color:var(--text);line-height:1.1;margin-bottom:6px">${block.title}</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.65;margin-bottom:18px">${block.sub}</div>
      <button id="done-btn" style="
        width:100%;min-height:48px;background:var(--accent);color:#fff;
        border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;
      ">Done →</button>
    </div>`;
}

function routineDoneHTML() {
  return `
    <div style="
      background:var(--surface);border-radius:14px;
      border-left:4px solid var(--accent);
      padding:20px 20px 20px 16px;margin-bottom:12px;
    ">
      <div style="font-size:34px;font-weight:800;color:var(--text);margin-bottom:6px">Day complete</div>
      <div style="font-size:12px;color:var(--text2)">Good work. See you tomorrow.</div>
    </div>`;
}

// ─── Zone 2: Progress ────────────────────────────────────────────────────────

function zone2(routine, isToday, isDone) {
  if (!isToday || isDone) return '';

  const blocks  = BLOCKS[routine.dayType];
  const total   = blocks.length;
  const done    = routine.completedIndex;
  const next    = done + 1 < total ? blocks[done + 1] : null;

  const pills = Array.from({ length: total }, (_, i) => {
    const bg = i < done ? '#d0cff0' : i === done ? 'var(--accent)' : '#eaeaef';
    return `<div style="flex:1;height:3px;border-radius:2px;background:${bg}"></div>`;
  }).join('');

  return `
    <div style="margin-bottom:16px">
      <div style="display:flex;gap:3px;margin-bottom:6px">${pills}</div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:11px;color:var(--text2)">${done} of ${total} done</span>
        <span style="font-size:11px;color:var(--text2)">${total - done} remaining</span>
      </div>
    </div>
    ${next ? `
      <div style="
        background:var(--surface);border:0.5px solid var(--border);border-radius:14px;
        padding:14px 18px;margin-bottom:16px;
        display:flex;align-items:center;justify-content:space-between;gap:12px;
      ">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text2)">${next.title}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px;line-height:1.5">${next.sub}</div>
        </div>
        <div style="color:var(--text3);font-size:18px;flex-shrink:0">›</div>
      </div>` : ''}`;
}

// ─── Zone 3: Big Four + Food ─────────────────────────────────────────────────

function zone3(state, todayDate) {
  return `
    <div class="section-label" style="margin-bottom:10px">The Big Four</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      ${KPI_LIFTS.map(id => bigFourCard(id, state.lifts[id])).join('')}
    </div>
    <div class="section-label" style="margin-bottom:10px">Today's meals</div>
    ${foodRow(state.meals[todayDate] || {})}`;
}

function resolveVariantSt(id, rawSt) {
  if (!store.VARIANT_LIFTS.has(id) || !rawSt) return { st: rawSt, variant: null };
  const bbDate = rawSt.bb?.lastSession?.date
    || (rawSt.bb?.history?.length ? rawSt.bb.history[rawSt.bb.history.length - 1].date : null);
  const dbDate = rawSt.db?.lastSession?.date
    || (rawSt.db?.history?.length ? rawSt.db.history[rawSt.db.history.length - 1].date : null);
  let variant;
  if      (!bbDate && !dbDate) variant = 'bb';
  else if (!bbDate)            variant = 'db';
  else if (!dbDate)            variant = 'bb';
  else                         variant = dbDate > bbDate ? 'db' : 'bb';
  return { st: rawSt[variant] || null, variant };
}

function bigFourCard(id, rawSt) {
  const { st, variant } = resolveVariantSt(id, rawSt);
  const weight = st ? (st.weight === 0 ? 'BW' : `${st.weight}kg`) : '—';
  const consec = st?.consecutiveTopOfRange || 0;

  const dotBg = (i) => i < consec ? (consec >= 2 ? 'var(--accent-dark)' : 'var(--accent)') : '#eaeaef';
  const dots  = [0, 1].map(i =>
    `<div style="width:5px;height:5px;border-radius:50%;background:${dotBg(i)}"></div>`
  ).join('');

  const variantTag = variant
    ? `<span style="font-size:9px;color:var(--text3);margin-left:3px">${variant.toUpperCase()}</span>`
    : '';

  return `
    <div class="big-four-card" data-lift="${id}" style="
      background:var(--surface);border:0.5px solid var(--border);
      border-radius:14px;padding:14px;cursor:pointer;
    ">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">
        ${KPI_NAMES[id] || id}${variantTag}
      </div>
      <div style="font-size:20px;font-weight:800;color:var(--text);line-height:1;margin-bottom:6px">${weight}</div>
      <div style="display:flex;gap:4px">${dots}</div>
    </div>`;
}

function foodRow(dayMeals) {
  const squares = nutrition.MEALS.map(m => {
    const st = dayMeals[m.id];
    if (st === 'eaten') {
      return `<div style="
        width:32px;height:32px;border-radius:10px;
        background:var(--accent-dim);
        display:flex;align-items:center;justify-content:center;
        font-size:13px;font-weight:700;color:var(--accent-dark);
      ">✓</div>`;
    }
    return `<div style="
      width:32px;height:32px;border-radius:10px;
      background:var(--surface);border:0.5px solid var(--border);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;color:var(--text3);
    ">·</div>`;
  }).join('');
  return `<div id="food-row" style="display:flex;gap:8px;cursor:pointer;margin-bottom:16px">${squares}</div>`;
}

// ─── Events ──────────────────────────────────────────────────────────────────

function bindEvents(el, state, todayDate, routine, isToday, isDone) {
  el.querySelectorAll('.routine-pick-card').forEach(card => {
    card.addEventListener('click', () => {
      saveRoutineState({ date: todayDate, dayType: card.dataset.type, completedIndex: 0 });
      render(el);
    });
  });

  el.querySelector('#done-btn')?.addEventListener('click', () => {
    saveRoutineState({ ...routine, completedIndex: routine.completedIndex + 1 });
    render(el);
  });

  el.querySelector('#routine-restart')?.addEventListener('click', () => {
    clearRoutineState();
    render(el);
  });

  el.querySelectorAll('.big-four-card').forEach(card => {
    card.addEventListener('click', () => {
      location.hash = `/levels?lift=${card.dataset.lift}`;
    });
  });

  el.querySelector('#food-row')?.addEventListener('click', () => {
    location.hash = '/food';
  });
}

import * as store from '../store.js';
import * as time from '../time.js';
import * as nutrition from '../nutrition.js';
import { KPI_LIFTS } from '../programme.js';
import { loadRoutineState, saveRoutineState, BLOCKS } from './routine.js';

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

const DAY_LABELS = { gym: 'Gym day', run: 'Run day', batch: 'Batch cook day' };

// Transient (not persisted): are we choosing a day type right now?
let picking = false;

export function mount(el) {
  picking = false;
  render(el);
}

export function unmount() {}

function render(el) {
  const state     = store.getState();
  const todayDate = time.today();
  const routine   = loadRoutineState();
  const isToday   = !!(routine && routine.date === todayDate);

  el.innerHTML = `
    <div style="padding:16px 16px 100px">
      ${(!isToday || picking)
        ? pickerHTML(isToday ? routine.dayType : null)
        : `${headerHTML(routine, todayDate)}${dayListHTML(routine)}`}
      ${trackersHTML(state, todayDate)}
    </div>`;

  bindEvents(el, todayDate, routine, isToday);
}

// ─── Day-type picker ─────────────────────────────────────────────────────────

function pickerHTML(currentType) {
  return `
    <div style="margin-bottom:20px">
      <div class="section-label" style="margin-bottom:12px">Today</div>
      ${pickCard('gym',   'Gym day',        'Train · Rodsuco · Babel · family', currentType)}
      ${pickCard('run',   'Run day',        'Run · Rodsuco · Babel · family',   currentType)}
      ${pickCard('batch', 'Batch cook day', 'Cook · Rodsuco · Babel · family',  currentType)}
    </div>`;
}

function pickCard(type, title, sub, currentType) {
  const sel = type === currentType;
  return `
    <div class="routine-pick-card" data-type="${type}" style="
      background:var(--surface);
      border:${sel ? '1.5px solid var(--accent)' : '0.5px solid var(--border)'};
      border-radius:14px;padding:18px 20px;margin-bottom:10px;cursor:pointer;
    ">
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
      <div style="font-size:12px;color:var(--text2)">${sub}</div>
    </div>`;
}

// ─── Snapshot header ─────────────────────────────────────────────────────────

function headerHTML(routine, todayDate) {
  const blocks = BLOCKS[routine.dayType];
  const total  = blocks.length;
  const done   = blocks.filter((_, i) => routine.states[i] === 'done').length;
  const pct    = total ? Math.round((done / total) * 100) : 0;

  return `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:15px;font-weight:600;color:var(--text)">${prettyDate(todayDate)}</span>
      <span id="daytype-chip" style="
        font-size:12px;color:var(--accent-dark);background:var(--accent-dim);
        padding:3px 10px;border-radius:999px;cursor:pointer;
      ">${DAY_LABELS[routine.dayType]}</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <div style="flex:1;height:4px;border-radius:2px;background:var(--surface2);overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--accent)"></div>
      </div>
      <span style="font-size:12px;color:var(--text2);white-space:nowrap">${done} of ${total}</span>
    </div>`;
}

// ─── The day list ────────────────────────────────────────────────────────────

function dayListHTML(routine) {
  const blocks     = BLOCKS[routine.dayType];
  const currentIdx = blocks.findIndex((_, i) => !routine.states[i]);
  const rows = blocks
    .map((b, i) => blockRow(b, i, routine.states[i], i === currentIdx))
    .join('');
  return `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:22px">${rows}</div>`;
}

function blockRow(block, i, state, isCurrent) {
  const dot = `<span style="width:6px;height:6px;border-radius:50%;background:${TAG_COLORS[block.tag] || 'var(--text2)'};flex-shrink:0"></span>`;

  if (state === 'done') {
    return row(i, `
      ${circle(`<i class="ti ti-check" style="font-size:13px;color:var(--accent-dark)"></i>`, 'var(--accent-dim)')}
      <div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--text2)">${block.title}</div></div>
      ${dot}`, '7px 4px');
  }

  if (state === 'skipped') {
    return row(i, `
      ${circle(`<i class="ti ti-minus" style="font-size:13px;color:var(--text3)"></i>`, 'var(--surface2)')}
      <div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--text3);text-decoration:line-through">${block.title}</div></div>
      ${dot}`, '7px 4px');
  }

  if (isCurrent) {
    return `
      <div class="block-row" data-i="${i}" style="
        display:flex;align-items:center;gap:11px;padding:13px 12px;cursor:pointer;
        background:var(--accent-dim);border:0.5px solid var(--accent);border-radius:12px;
      ">
        <span style="width:22px;height:22px;border-radius:50%;border:2px solid var(--accent);flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text)">${block.title}</div>
          <div style="font-size:12px;color:var(--accent-dark);margin-top:1px;line-height:1.5">${block.sub}</div>
        </div>
        <span style="font-size:12px;color:var(--accent-dark);white-space:nowrap">Done <i class="ti ti-arrow-right" style="font-size:12px;vertical-align:-1px"></i></span>
      </div>`;
  }

  // pending, not current
  return row(i, `
    <span style="width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0"></span>
    <div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--text)">${block.title}</div></div>
    ${dot}`, '7px 4px');
}

function row(i, inner, padding) {
  return `<div class="block-row" data-i="${i}" style="display:flex;align-items:center;gap:11px;padding:${padding};cursor:pointer">${inner}</div>`;
}

function circle(inner, bg) {
  return `<span style="width:22px;height:22px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${inner}</span>`;
}

function prettyDate(iso) {
  const d  = new Date(`${iso}T00:00:00`);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${wd} ${dm}`;
}

// ─── Trackers: Big Four + Food ───────────────────────────────────────────────

function trackersHTML(state, todayDate) {
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

function bindEvents(el, todayDate, routine, isToday) {
  // Pick / switch day type
  el.querySelectorAll('.routine-pick-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      if (isToday && routine.dayType === type) {
        picking = false;                       // same type → just close
      } else {
        saveRoutineState({ date: todayDate, dayType: type, states: {} });
        picking = false;
      }
      render(el);
    });
  });

  el.querySelector('#daytype-chip')?.addEventListener('click', () => {
    picking = true;
    render(el);
  });

  // Cycle a block: pending → done → skipped → pending
  el.querySelectorAll('.block-row').forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      const i   = Number(rowEl.dataset.i);
      const cur = routine.states[i];
      const next = cur === undefined ? 'done' : cur === 'done' ? 'skipped' : undefined;
      const states = { ...routine.states };
      if (next === undefined) delete states[i]; else states[i] = next;
      saveRoutineState({ ...routine, states });
      render(el);
    });
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

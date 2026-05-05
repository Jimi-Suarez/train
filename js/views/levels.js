import * as store from '../store.js';
import { SESSIONS } from '../programme.js';
import { sumReps } from '../scoring.js';
import * as time from '../time.js';

let detailLiftId = null;

export function mount(el) {
  const hash  = location.hash;
  const match = hash.match(/[?&]lift=([^&]+)/);
  if (match) detailLiftId = match[1];
  else detailLiftId = null;
  render(el);
}

export function unmount() {
  detailLiftId = null;
}

function render(el) {
  if (detailLiftId) {
    renderDetail(el, detailLiftId);
  } else {
    renderList(el);
  }
}

const STATE_BADGE = {
  win:      { label: 'WIN',      color: '#22c55e' },
  hold:     { label: 'HELD',     color: 'var(--lime)' },
  miss:     { label: 'MISS',     color: 'var(--amber)' },
  baseline: { label: 'BASELINE', color: 'var(--text2)' },
};

function resultBadge(stateVal) {
  const cfg = stateVal ? STATE_BADGE[stateVal] : null;
  if (!cfg) return '<span style="color:var(--text3)">—</span>';
  return `<span style="font-size:11px;font-weight:700;color:${cfg.color}">${cfg.label}</span>`;
}

function renderList(el) {
  const lifts = store.getState().lifts;

  const needsAttention = [];
  const closeTo        = [];

  Object.entries(lifts).forEach(([id, st]) => {
    if (!st) return;
    if (!st.lastReps) needsAttention.push(id);
    else if ((st.consecutiveTopOfRange || 0) === 1) closeTo.push(id);
  });

  el.innerHTML = `
    <div class="levels-wrap">
      ${needsAttention.length ? `
        <div class="section-label">Needs attention</div>
        <div class="card" style="padding:0 16px;margin-bottom:12px">
          ${needsAttention.map(id => needsAttentionRow(id, lifts[id])).join('')}
        </div>` : ''}

      ${closeTo.length ? `
        <div class="section-label">Closest to graduating</div>
        <div class="card" style="padding:0 16px;margin-bottom:12px">
          ${closeTo.map(id => closeToRow(id, lifts[id])).join('')}
        </div>` : ''}

      <div class="section-label">All lifts</div>
      ${Object.values(SESSIONS).map(session => `
        <div class="session-group-label">${session.name} · ${session.subtitle}</div>
        <div class="card" style="padding:0 16px;margin-bottom:4px">
          ${session.lifts.map(lift => liftRowHTML(lift.id, lifts[lift.id])).join('')}
        </div>`).join('')}
    </div>`;

  el.querySelectorAll('.level-row').forEach(row => {
    row.addEventListener('click', () => {
      detailLiftId = row.dataset.liftId;
      render(el);
    });
  });
}

function needsAttentionRow(id, st) {
  const liftDef = findLiftDef(id);
  if (!liftDef) return '';
  const weight = st ? (st.weight === 0 ? 'BW' : `${st.weight}${liftDef.isTime ? 's' : 'kg'}`) : '—';
  return `
    <div class="level-row" data-lift-id="${id}">
      <div class="level-row-name">${liftDef.name}</div>
      <div class="level-row-right" style="gap:8px">
        <span class="level-row-weight">${weight}</span>
        <span style="font-size:11px;color:var(--text2)">First session at this weight — establish baseline</span>
      </div>
    </div>`;
}

function closeToRow(id, st) {
  const liftDef = findLiftDef(id);
  if (!liftDef) return '';
  const weight = st ? (st.weight === 0 ? 'BW' : `${st.weight}${liftDef.isTime ? 's' : 'kg'}`) : '—';
  return `
    <div class="level-row" data-lift-id="${id}">
      <div class="level-row-name">${liftDef.name}</div>
      <div class="level-row-right" style="gap:8px">
        <span class="level-row-weight">${weight}</span>
        <span style="font-size:11px;color:var(--lime)">1 of 2 max sessions — one more to graduate</span>
      </div>
    </div>`;
}

function liftRowHTML(id, st) {
  const liftDef   = findLiftDef(id);
  if (!liftDef) return '';
  const weight    = st ? (st.weight === 0 ? 'BW' : `${st.weight}${liftDef.isTime ? 's' : 'kg'}`) : '—';
  const lastState = st?.lastSession?.state || null;
  const repsStr   = st?.lastReps ? st.lastReps.join(', ') : '—';
  return `
    <div class="level-row" data-lift-id="${id}">
      <div class="level-row-name">${liftDef.name}</div>
      <div class="level-row-right" style="gap:8px">
        <span class="level-row-weight">${weight}</span>
        ${resultBadge(lastState)}
        <span style="font-size:12px;color:var(--text2);min-width:56px;text-align:right">${repsStr}</span>
      </div>
    </div>`;
}

function renderDetail(el, liftId) {
  const liftDef = findLiftDef(liftId);
  const st      = store.getLift(liftId);
  if (!liftDef) { renderList(el); return; }

  const weight    = st ? (st.weight === 0 ? 'BW' : `${st.weight}kg`) : '—';
  const lastState = st?.lastSession?.state || null;
  const lastReps  = st?.lastReps || null;
  const lastTotal = sumReps(lastReps);
  const minTotal  = liftDef.repsMin * liftDef.sets;

  const mission = lastReps
    ? `Beat ${lastTotal} to win · hit ${lastTotal} to hold`
    : `Establish baseline — aim for ≥${minTotal} reps total`;

  const sessionHistory = st ? (st.history || []).slice().reverse().slice(0, 10) : [];

  el.innerHTML = `
    <div class="lift-detail-wrap">
      <div class="back-link" id="back-btn">← All lifts</div>

      <div class="lift-detail-header">
        <div style="font-size:22px;font-weight:700">${liftDef.name}</div>
        <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
          <span style="font-size:18px;font-weight:700">${weight}</span>
          ${resultBadge(lastState)}
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text2);margin-top:8px">${mission}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:6px;line-height:1.5">${liftDef.note}</div>
      </div>

      <button class="btn btn-ghost" id="bump-weight-btn" style="margin:16px 0">
        Bump weight ↑
      </button>

      ${sessionHistory.length ? `
        <div class="section-label" style="margin-top:4px">Last ${sessionHistory.length} sessions</div>
        <div class="card" style="padding:0 16px">
          ${sessionHistory.map(h => historyRowHTML(h)).join('')}
        </div>` : '<div class="text-muted text-sm" style="padding:16px 0">No sessions logged yet.</div>'}
    </div>`;

  el.querySelector('#back-btn').addEventListener('click', () => {
    detailLiftId = null;
    renderList(el);
    if (location.hash.includes('?')) {
      window.history.replaceState(null, '', location.hash.split('?')[0]);
    }
  });

  el.querySelector('#bump-weight-btn')?.addEventListener('click', () => {
    openBumpSheet(el, liftId, liftDef, st);
  });
}

function historyRowHTML(entry) {
  if (!entry) return '';
  const repsStr   = entry.sets ? entry.sets.map(s => s.reps).join(', ') : '—';
  const total     = entry.sets ? entry.sets.reduce((s, set) => s + set.reps, 0) : 0;
  const dateLabel = entry.date ? time.formatShortDate(entry.date) : '—';
  const weightStr = entry.weight === 0 ? 'BW' : `${entry.weight || '?'}kg`;
  return `
    <div class="history-row">
      <span class="history-date">${dateLabel}</span>
      <span class="history-reps">${weightStr} · ${repsStr} · ${total}</span>
      <span class="history-score">${resultBadge(entry.state || null)}</span>
    </div>`;
}

function openBumpSheet(el, liftId, liftDef, st) {
  const currentWeight = st ? st.weight : 0;
  const defaultNew    = currentWeight + liftDef.increment;
  const minTarget     = liftDef.repsMin * liftDef.sets;

  const sheet = document.createElement('div');
  sheet.className = 'modal-overlay';
  sheet.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Bump weight</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
        Currently ${currentWeight === 0 ? 'BW' : currentWeight + 'kg'}. New weight for next session:
      </div>
      <input class="modal-input" type="number" step="${liftDef.increment}" id="bump-input" value="${defaultNew}" />
      <div style="font-size:13px;color:var(--text2);margin:8px 0 20px" id="bump-mission">
        New mission at ${defaultNew}kg: establish baseline (≥${minTarget} reps)
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="bump-cancel">Cancel</button>
        <button class="btn btn-primary" id="bump-confirm">Confirm</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);

  const input   = sheet.querySelector('#bump-input');
  const mission = sheet.querySelector('#bump-mission');

  input.addEventListener('input', () => {
    const val = parseFloat(input.value) || defaultNew;
    mission.textContent = `New mission at ${val}kg: establish baseline (≥${minTarget} reps)`;
  });

  sheet.querySelector('#bump-cancel').addEventListener('click', () => sheet.remove());
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });

  sheet.querySelector('#bump-confirm').addEventListener('click', () => {
    const newWeight = parseFloat(input.value);
    if (isNaN(newWeight) || newWeight < 0) return;
    store.setLift(liftId, { weight: newWeight, lastReps: null, consecutiveTopOfRange: 0 });
    sheet.remove();
    renderDetail(el, liftId);
  });
}

function findLiftDef(id) {
  for (const session of Object.values(SESSIONS)) {
    const found = session.lifts.find(l => l.id === id);
    if (found) return found;
  }
  return null;
}

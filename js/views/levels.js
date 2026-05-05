import * as store from '../store.js';
import { SESSIONS, KPI_LIFTS } from '../programme.js';
import { maxLiftScore } from '../scoring.js';
import * as time from '../time.js';

let detailLiftId = null;

export function mount(el) {
  // Support ?lift=xxx coming from Today tap
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

function renderList(el) {
  const lifts = store.getState().lifts;

  const ready  = [];
  const close  = [];

  Object.entries(lifts).forEach(([id, st]) => {
    if (st.streakAtMax >= 2) ready.push(id);
    else if (st.streakAtMax === 1) close.push(id);
  });

  el.innerHTML = `
    <div class="levels-wrap">
      ${ready.length ? `
        <div class="section-label">⚡ Ready to level up</div>
        <div class="ready-section">
          ${ready.map(id => liftReadyRow(id, lifts[id])).join('')}
        </div>` : ''}

      ${close.length ? `
        <div class="section-label">Close — one more max</div>
        <div class="card" style="padding:0 16px;margin-bottom:12px">
          ${close.map(id => levelRowHTML(id, lifts[id])).join('')}
        </div>` : ''}

      <div class="section-label">All lifts</div>
      ${Object.values(SESSIONS).map(session => `
        <div class="session-group-label">${session.name} · ${session.subtitle}</div>
        <div class="card" style="padding:0 16px;margin-bottom:4px">
          ${session.lifts.map(lift => levelRowHTML(lift.id, lifts[lift.id])).join('')}
        </div>`).join('')}
    </div>`;

  el.querySelectorAll('.level-row').forEach(row => {
    row.addEventListener('click', () => {
      detailLiftId = row.dataset.liftId;
      render(el);
    });
  });
}

function liftReadyRow(id, st) {
  const liftDef = findLiftDef(id);
  if (!liftDef) return '';
  const nextWt = st.weight + liftDef.increment;
  return `
    <div class="level-row" data-lift-id="${id}">
      <div class="level-row-name">${liftDef.name}</div>
      <div class="level-row-right">
        <span class="text-muted text-sm">L${st.level} → L${st.level + 1}</span>
        <span class="level-badge level-up-badge">⚡ ${st.weight}→${nextWt}kg</span>
      </div>
    </div>`;
}

function levelRowHTML(id, st) {
  const liftDef = findLiftDef(id);
  if (!liftDef) return '';
  const level  = st ? st.level : 1;
  const weight = st ? (st.weight === 0 ? 'BW' : `${st.weight}${liftDef.isTime ? 's' : 'kg'}`) : '—';
  const streak = st ? st.streakAtMax : 0;
  const dots   = '●'.repeat(streak) + '○'.repeat(2 - streak);
  return `
    <div class="level-row" data-lift-id="${id}">
      <div class="level-row-name">${liftDef.name}</div>
      <div class="level-row-right">
        <span class="level-row-weight">${weight}</span>
        <span class="level-badge">L${level}</span>
        <span class="streak-dots" style="font-size:12px">${dots}</span>
      </div>
    </div>`;
}

function renderDetail(el, liftId) {
  const liftDef = findLiftDef(liftId);
  const st      = store.getLift(liftId);
  if (!liftDef) { renderList(el); return; }

  const level  = st ? st.level : 1;
  const weight = st ? (st.weight === 0 ? 'BW' : `${st.weight}kg`) : '—';
  const streak = st ? st.streakAtMax : 0;
  const dots   = '●'.repeat(streak) + '○'.repeat(2 - streak);
  const sessionHistory = st ? (st.history || []).slice().reverse().slice(0, 10) : [];

  el.innerHTML = `
    <div class="lift-detail-wrap">
      <div class="back-link" id="back-btn">← All lifts</div>

      <div class="lift-detail-header">
        <div style="font-size:22px;font-weight:700">${liftDef.name}</div>
        <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
          <span class="level-badge" style="font-size:14px">L${level}</span>
          <span style="font-size:18px;font-weight:700">${weight}</span>
          <span class="streak-dots">${dots}</span>
          ${streak >= 2 ? '<span class="level-up-badge" style="font-size:14px">⚡ Level up next session</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text2);margin-top:10px;line-height:1.5">${liftDef.note}</div>
      </div>

      <div class="section-label">Scoring: ${liftDef.sets} sets · ${liftDef.repsMin}–${liftDef.repsMax} reps · max ${maxLiftScore(liftDef)} pts</div>

      ${sessionHistory.length ? `
        <div class="section-label" style="margin-top:16px">Last ${sessionHistory.length} sessions</div>
        <div class="card" style="padding:0 16px">
          ${sessionHistory.map(h => historyRowHTML(h, liftDef)).join('')}
        </div>` : '<div class="text-muted text-sm" style="padding:16px 0">No sessions logged yet.</div>'}
    </div>`;

  el.querySelector('#back-btn').addEventListener('click', () => {
    detailLiftId = null;
    renderList(el);
    if (location.hash.includes('?')) {
      window.history.replaceState(null, '', location.hash.split('?')[0]);
    }
  });
}

function historyRowHTML(entry, liftDef) {
  if (!entry) return '';
  const repsStr = entry.sets
    ? entry.sets.map(s => s.reps).join(', ')
    : '—';
  const dateLabel = entry.date ? time.formatShortDate(entry.date) : '—';
  const isMax = entry.score >= maxLiftScore(liftDef);
  return `
    <div class="history-row">
      <span class="history-date">${dateLabel}</span>
      <span class="history-reps">${entry.weight || '?'}kg · ${repsStr}</span>
      <span class="history-score ${isMax ? 'text-lime' : ''}">${entry.score}/${maxLiftScore(liftDef)}</span>
    </div>`;
}

function findLiftDef(id) {
  for (const session of Object.values(SESSIONS)) {
    const found = session.lifts.find(l => l.id === id);
    if (found) return found;
  }
  return null;
}

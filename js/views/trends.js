import * as store from '../store.js';
import * as time from '../time.js';
import * as nutrition from '../nutrition.js';
import { SESSIONS, KPI_LIFTS } from '../programme.js';

export function mount(el) {
  const state = store.getState();
  const todayDate = time.today();

  const weeklyTally  = buildWeeklyTally(state);
  const disruptions  = buildDisruptionData(state);
  const liftProgress = buildLiftProgress(state);
  const nutritionData = buildNutritionData(state, todayDate);

  el.innerHTML = `
    <div class="trends-wrap">
      <div class="spacer-12"></div>

      <!-- Weekly tally -->
      <div class="chart-container">
        <div class="chart-title">Weekly tally</div>
        ${weeklyTallyHTML(weeklyTally)}
      </div>

      <!-- KPI lift progression -->
      <div class="section-label">KPI Lift progression</div>
      ${KPI_LIFTS.map(id => liftProgressCard(id, liftProgress[id])).join('')}

      <!-- Nutrition adherence -->
      <div class="chart-container" style="margin-top:4px">
        <div class="chart-title">Nutrition adherence (%)</div>
        ${lineChartSVG(nutritionData.map(w => ({ x: w.weekNum, y: w.pct, label: w.weekLabel })), {
          color: 'var(--amber)', emptyMsg: 'No meal data yet'
        })}
      </div>

      <!-- Disruption patterns -->
      <div class="chart-container">
        <div class="chart-title">Disruptions · last 8 weeks</div>
        ${disruptionBars(disruptions)}
      </div>
    </div>`;
}

export function unmount() {}

function buildWeeklyTally(state) {
  const weekMap = {};

  Object.entries(state.sessions).forEach(([date, session]) => {
    if (!session.completedAt) return;
    const [y, m, d] = date.split('-').map(Number);
    const weekKey = time.isoWeek(new Date(y, m - 1, d));

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = { weekKey, wins: 0, holds: 0, misses: 0, baselines: 0 };
    }

    Object.values(session.lifts || {}).forEach(entry => {
      if (!entry) return;
      const st = entry.state;
      if (st === 'win')           weekMap[weekKey].wins++;
      else if (st === 'hold')     weekMap[weekKey].holds++;
      else if (st === 'miss')     weekMap[weekKey].misses++;
      else if (st === 'baseline') weekMap[weekKey].baselines++;
    });
  });

  return Object.values(weekMap)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, 4);
}

function weeklyTallyHTML(weeks) {
  if (!weeks.length) {
    return '<div class="text-muted text-sm" style="padding:20px 0;text-align:center">No sessions yet</div>';
  }
  return weeks.map(w => {
    const wkNum = w.weekKey.split('-W')[1];
    const parts = [];
    if (w.wins  > 0) parts.push(`<span style="color:#22c55e">✓ ${w.wins} win${w.wins !== 1 ? 's' : ''}</span>`);
    if (w.holds > 0) parts.push(`<span style="color:var(--lime)">= ${w.holds} held</span>`);
    if (w.misses > 0) parts.push(`<span style="color:var(--amber)">✗ ${w.misses} missed</span>`);
    if (w.baselines > 0) parts.push(`<span style="color:var(--text2)">${w.baselines} baseline${w.baselines !== 1 ? 's' : ''}</span>`);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="font-weight:700;color:var(--text2);flex-shrink:0;min-width:64px">WEEK ${wkNum}</span>
        <span style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end">
          ${parts.length ? parts.join('') : '<span style="color:var(--text3)">no lift data</span>'}
        </span>
      </div>`;
  }).join('') + '<div style="height:4px"></div>';
}

function buildNutritionData(state, todayDate) {
  const weeks = [];
  let weekEnd = todayDate;
  for (let i = 0; i < 12; i++) {
    const { start, end } = time.weekStartEnd(new Date(...weekEnd.split('-').map((v,i) => i===1?Number(v)-1:Number(v))));
    if (start > todayDate) { weekEnd = time.addDays(start, -1); continue; }
    let total = 0, eaten = 0;
    let d = start;
    while (d <= end && d <= todayDate) {
      const dm = state.meals[d];
      if (dm) {
        nutrition.MEALS.forEach(m => {
          if (dm[m.id] != null) {
            total++;
            if (dm[m.id] === 'eaten') eaten++;
          }
        });
      }
      d = time.addDays(d, 1);
    }
    if (total === 0) { weekEnd = time.addDays(start, -1); continue; }
    const pct = Math.round((eaten / total) * 100);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [, m, day] = start.split('-').map(Number);
    weeks.unshift({ weekLabel: `${day} ${MONTHS[m-1]}`, weekNum: weeks.length, pct });
    weekEnd = time.addDays(start, -1);
  }
  return weeks;
}

function buildLiftProgress(state) {
  const result = {};
  KPI_LIFTS.forEach(id => {
    const lift = state.lifts[id];
    if (!lift) { result[id] = null; return; }
    const history = lift.history || [];
    result[id] = history.map(h => ({ date: h.date, weight: h.weight || lift.weight }));
  });
  return result;
}

function buildDisruptionData(state) {
  const disruptions = store.getAllDisruptions();
  const counts = {};
  const LABELS = {
    'bad-sleep': 'Bad sleep', 'work': 'Work', 'didnt-feel-it': "Didn't feel it",
    'family': 'Family', 'illness': 'Illness', 'travel': 'Travel',
  };
  Object.values(disruptions).forEach(d => {
    if (d.reason) counts[d.reason] = (counts[d.reason] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: LABELS[key] || key, count }));
}

function liftProgressCard(id, data) {
  const NAMES = { 'incline-bb': 'Incline Press', 'deadlift': 'Deadlift', 'squat': 'Back Squat', 'pullup': 'Pull-ups' };
  const lift  = store.getLift(id);
  if (!lift) return `<div class="card" style="margin-bottom:8px"><span class="text-muted text-sm">${NAMES[id]} — no data yet</span></div>`;

  const history = data || [];
  const firstWt = history.length ? history[0].weight : lift.weight;
  const lastWt  = lift.weight;
  const delta   = +(lastWt - firstWt).toFixed(1);

  const points = history.map((h, i) => ({ x: i, y: h.weight }));
  if (!points.length) points.push({ x: 0, y: lift.weight });

  return `
    <div class="chart-container" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="chart-title" style="margin:0">${NAMES[id]}</div>
        <div class="text-sm" style="color:${delta >= 0 ? 'var(--lime)' : 'var(--red)'};font-weight:700">
          ${firstWt}→${lastWt}kg ${delta >= 0 ? '↑' : '↓'}${Math.abs(delta)}kg
        </div>
      </div>
      ${sparklineSVG(points)}
    </div>`;
}

function disruptionBars(disruptions) {
  if (!disruptions.length) return '<div class="text-muted text-sm">No disruptions logged.</div>';
  const max = disruptions[0].count;
  return disruptions.map(d => `
    <div class="disruption-bar-row">
      <div class="disruption-bar-label">${d.label}</div>
      <div class="disruption-bar-track">
        <div class="disruption-bar-fill" style="width:${Math.round((d.count/max)*100)}%"></div>
      </div>
      <div class="disruption-bar-count">${d.count}</div>
    </div>`).join('');
}

function lineChartSVG(points, { color, emptyMsg }) {
  if (!points.length || points.every(p => p.y === 0)) {
    return `<div class="text-muted text-sm" style="padding:20px 0;text-align:center">${emptyMsg}</div>`;
  }

  const W = 320, H = 140;
  const padL = 36, padR = 12, padT = 16, padB = 28;
  const w = W - padL - padR;
  const h = H - padT - padB;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const rangeX = maxX - minX || 1;

  const px = x => padL + ((x - minX) / rangeX) * w;
  const py = y => padT + h - ((y - minY) / rangeY) * h;

  const pathD  = points.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
  const dotsEl = points.map(p =>
    `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="3.5" fill="${color}" />`
  ).join('');

  const labelsEl = points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map(p =>
    `<text x="${px(p.x).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="10" fill="var(--text3)">${p.label || ''}</text>`
  ).join('');

  const yLabels = [minY, Math.round((minY + maxY) / 2), maxY].map(v =>
    `<text x="${padL - 4}" y="${py(v).toFixed(1) + 4}" text-anchor="end" font-size="10" fill="var(--text3)">${Math.round(v)}</text>`
  ).join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round" />
      ${dotsEl}
      ${labelsEl}
      ${yLabels}
    </svg>`;
}

function sparklineSVG(points) {
  if (points.length < 2) return '';
  const W = 280, H = 48;
  const ys = points.map(p => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const px = i => 4 + (i / (points.length - 1)) * (W - 8);
  const py = y => 4 + (H - 8) - ((y - minY) / range) * (H - 8);
  const pathD = points.map((p, i) => `${i ? 'L' : 'M'} ${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" stroke="var(--lime)" stroke-width="2" fill="none" />
      <circle cx="${px(points.length-1).toFixed(1)}" cy="${py(ys[ys.length-1]).toFixed(1)}" r="3" fill="var(--lime)" />
    </svg>`;
}

import * as store from '../store.js';
import * as time from '../time.js';
import * as nutrition from '../nutrition.js';
import { SESSIONS, KPI_LIFTS, DAY_SESSION } from '../programme.js';
import { weeklyScore } from '../scoring.js';

const KPI_NAMES = {
  'incline-bb': 'Incline Press',
  'deadlift':   'Deadlift',
  'squat':      'Back Squat',
  'pullup':     'Pull-ups',
};

const GTG_MAX = 6;

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function sessionCard(dow, todayDate, sessions) {
  const session = SESSIONS[DAY_SESSION[dow]];
  const isStarted = sessions[todayDate] && sessions[todayDate].startedAt;
  const isCompleted = sessions[todayDate] && sessions[todayDate].completedAt;

  if (dow === 5) {
    return `
      <div class="session-card" id="session-card" data-action="flex">
        <div class="session-card-icon">◎</div>
        <div class="session-card-name">Friday flex</div>
        <div class="session-card-sub">choose: cardio / extra session / rest</div>
        <div class="session-card-cta">Log activity →</div>
      </div>`;
  }
  if (dow === 6) {
    return `
      <div class="session-card" id="session-card" data-action="run">
        <div class="session-card-icon">⟳</div>
        <div class="session-card-name">Easy run · 45 min</div>
        <div class="session-card-sub">The weekend ritual</div>
        <div class="session-card-cta">Log run →</div>
      </div>`;
  }
  if (dow === 0) {
    return `
      <div class="session-card" style="cursor:default">
        <div class="session-card-icon">◯</div>
        <div class="session-card-name">Rest day</div>
        <div class="session-card-sub">Big day tomorrow.</div>
      </div>`;
  }
  if (!session) return '';

  if (isCompleted) {
    const lifts = (sessions[todayDate].lifts) || {};
    let totalScore = 0, totalMax = 0;
    Object.values(lifts).forEach(entry => {
      if (entry) { totalScore += entry.score; totalMax += entry.max; }
    });
    const scoreStr = totalMax > 0 ? `${totalScore} / ${totalMax}` : '';
    return `
      <div class="session-card" id="session-card" data-action="gym">
        <div class="session-card-icon">${session.icon}</div>
        <div class="session-card-name">${session.name} Day</div>
        <div class="session-card-sub">${scoreStr}</div>
        <div class="session-card-cta" style="color:var(--lime)">Session complete ✓</div>
      </div>`;
  }

  const cta = isStarted ? 'Resume session →' : 'Start session →';
  return `
    <div class="session-card" id="session-card" data-action="gym">
      <div class="session-card-icon">${session.icon}</div>
      <div class="session-card-name">${session.name} Day</div>
      <div class="session-card-sub">${session.lifts.length} lifts · ~60 min</div>
      <div class="session-card-cta">${cta}</div>
    </div>`;
}

function bigFourRows(liftStates) {
  return KPI_LIFTS.map(id => {
    const st = liftStates[id];
    const streak = st ? (st.streakAtMax || 0) : 0;
    const dots   = '●'.repeat(streak) + '○'.repeat(2 - streak);
    const lvl    = st ? st.level : 1;
    const wt     = st ? st.weight : '—';
    const wtStr  = wt === 0 ? 'BW' : wt ? `${wt}kg` : '—';
    const ready  = st && st.streakAtMax >= 2;
    return `
      <div class="big-four-row" data-lift="${id}">
        <div class="big-four-left">
          <div class="big-four-name">${KPI_NAMES[id]}</div>
          <div class="big-four-sub">${ready ? '⚡ Ready to level up' : ''}</div>
        </div>
        <div class="big-four-right">
          <div class="big-four-weight">${wtStr}</div>
          <div class="level-badge${ready ? ' level-up-badge' : ''}">L${lvl}</div>
          <div class="streak-dots">${dots}</div>
        </div>
      </div>`;
  }).join('');
}

function weekProgressHTML(state, todayDate) {
  const { start, end } = time.weekStartEnd();
  const sessions = state.sessions;
  const completed = Object.keys(sessions)
    .filter(d => d >= start && d <= todayDate && sessions[d].completedAt)
    .length;
  const target = 4;

  let daysElapsed = 0;
  let proteinHit  = 0;
  let d = start;
  while (d <= todayDate && d <= end) {
    daysElapsed++;
    const dm = state.meals[d];
    if (dm && nutrition.computeProtein(dm) >= state.settings.proteinTarget) proteinHit++;
    d = time.addDays(d, 1);
  }
  const proteinPct  = daysElapsed > 0 ? proteinHit / daysElapsed : 0;
  const sessionPct  = completed / target;
  const combined    = Math.round(((sessionPct + proteinPct) / 2) * 100);
  const wkNum       = time.weekNumber(state.settings.startedAt);
  const proteinDisp = Math.round(proteinPct * 100);

  return { completed, target, combined, wkNum, proteinDisp };
}

export function mount(el) {
  const state    = store.getState();
  const todayDate = time.today();
  const dow      = time.dayOfWeek(todayDate);
  const [y, m, d] = todayDate.split('-').map(Number);
  const dateLabel = `${DAY_LABELS[dow]} · ${d} ${MONTH_LABELS[m - 1]}`;

  const { completed, target, combined, wkNum, proteinDisp } = weekProgressHTML(state, todayDate);

  const { start } = time.weekStartEnd();
  const wkScore = weeklyScore(state.sessions, start, todayDate);

  const currentMeal = nutrition.currentMealWindow();
  const dayMeals    = state.meals[todayDate] || {};

  // Banners
  const isSunday  = dow === 0;
  const isMonday  = dow === 1;
  const lastWeekData = isMonday ? computeLastWeekVerdict(state, todayDate) : null;
  const monDismissed = isMonday && (store.getHabits(todayDate).lastWeekBannerDismissed);

  el.innerHTML = `
    <div class="today-wrap">
      <div class="why-hint" id="why-hint">↓ pull for the why</div>

      <div class="today-date">${dateLabel}</div>
      <div class="today-week-row">
        <div class="today-week-label">${wkNum ? `Week ${wkNum}` : ''}</div>
        <div class="today-week-pct">${combined}%</div>
      </div>
      <div class="progress-bar-wrap" style="margin-bottom:6px">
        <div class="progress-bar-fill" style="width:${combined}%"></div>
      </div>
      <div class="today-week-meta">
        ${completed} of ${target} sessions · ${proteinDisp}% protein · ${wkScore} pts this week
      </div>

      ${isSunday ? `
        <div class="banner banner-sunday" id="sunday-banner">
          <div class="banner-label">Sunday · 3 minutes for the weekly review</div>
          <div class="banner-link" id="open-review-link">Open review →</div>
        </div>` : ''}

      ${isMonday && lastWeekData && !monDismissed ? `
        <div class="banner banner-monday" id="monday-banner">
          <div class="banner-label">Last week · The verdict</div>
          <div class="banner-text">${lastWeekData.text}</div>
          <span class="banner-link" id="dismiss-monday">Dismiss ✕</span>
        </div>` : ''}

      <div class="spacer-12"></div>
      <div class="section-label">The Big Four</div>
      <div class="card" style="padding:0 16px">
        ${bigFourRows(state.lifts)}
      </div>

      <div class="section-label" style="margin-top:16px">Today</div>
      ${sessionCard(dow, todayDate, state.sessions)}

      ${gtgCardHTML(store.getHabits(todayDate).gtg || 0)}

      ${currentMeal && dayMeals[currentMeal.id] == null ? `
        <div class="meal-block" id="next-meal-block" data-meal="${currentMeal.id}">
          <div class="meal-block-label">Next meal</div>
          <div class="meal-block-name">${currentMeal.name}</div>
          <div class="meal-actions">
            <button class="meal-action-btn eaten" data-meal="${currentMeal.id}" data-state="eaten">✓ Eaten</button>
            <button class="meal-action-btn cheat" data-meal="${currentMeal.id}" data-state="cheat">⚠ Cheat</button>
            <button class="meal-action-btn skipped" data-meal="${currentMeal.id}" data-state="skipped">✕ Skip</button>
          </div>
        </div>` : ''}

      <div class="meals-summary-row" id="meals-summary-row">
        <div>
          <div class="section-label" style="margin-bottom:6px">Today's meals</div>
          <div style="display:flex;align-items:center;gap:10px">
            ${mealDotsHTML(dayMeals)}
            <span class="text-muted text-sm">${countEaten(dayMeals)} of ${nutrition.MEALS.length} on plan</span>
          </div>
        </div>
        <div class="text-lime text-sm">See all →</div>
      </div>
    </div>`;

  bindEvents(el, state, todayDate, dow);
}

function gtgCardHTML(count) {
  const done = count >= GTG_MAX;
  const dots = Array.from({ length: GTG_MAX }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;flex-shrink:0;
       background:${i < count ? 'var(--lime)' : 'var(--surface2)'};
       border:2px solid ${i < count ? 'var(--lime)' : 'var(--border)'}"></div>`
  ).join('');
  return `
    <div class="card" id="gtg-card" style="cursor:pointer;margin-bottom:12px">
      <div class="section-label" style="margin-bottom:4px">Pull-up Builder</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Grease the Groove · 1 rep · never grind</div>
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" id="gtg-btn"
                style="width:auto;pointer-events:none"
                ${done ? 'disabled' : ''}>
          ${done ? 'Done for today ✓' : '+ Log set'}
        </button>
        <div id="gtg-dots" style="display:flex;gap:6px;align-items:center">${dots}</div>
        <span id="gtg-label" class="text-muted text-sm">${count} of ${GTG_MAX}</span>
      </div>
    </div>`;
}

function updateGtg(todayDate) {
  const count  = store.getHabits(todayDate).gtg || 0;
  const done   = count >= GTG_MAX;
  const btn    = document.getElementById('gtg-btn');
  const dotsEl = document.getElementById('gtg-dots');
  const labelEl = document.getElementById('gtg-label');
  if (!btn || !dotsEl || !labelEl) return;

  btn.textContent = done ? 'Done for today ✓' : '+ Log set';
  btn.disabled    = done;

  dotsEl.innerHTML = Array.from({ length: GTG_MAX }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;flex-shrink:0;
       background:${i < count ? 'var(--lime)' : 'var(--surface2)'};
       border:2px solid ${i < count ? 'var(--lime)' : 'var(--border)'}"></div>`
  ).join('');

  labelEl.textContent = `${count} of ${GTG_MAX}`;
}

function mealDotsHTML(dayMeals) {
  return nutrition.MEALS.map(m => {
    const st = dayMeals[m.id];
    const cls = st === 'eaten' ? 'eaten' : st === 'cheat' ? 'cheat' : st === 'skipped' ? 'skipped' : st === 'replaced' ? 'replaced' : '';
    return `<div class="meal-dot ${cls}"></div>`;
  }).join('');
}

function countEaten(dayMeals) {
  return nutrition.MEALS.filter(m => dayMeals[m.id] === 'eaten').length;
}

function computeLastWeekVerdict(state, todayDate) {
  const { start: wkStart } = time.weekStartEnd(new Date(
    ...todayDate.split('-').map((v,i) => i === 1 ? Number(v)-1 : Number(v))
  ));
  const prevSun = time.addDays(wkStart, -1);
  const prevMon = time.addDays(prevSun, -6);

  let total = 0, eaten = 0;
  let d = prevMon;
  while (d <= prevSun) {
    const dm = state.meals[d] || {};
    total += 5;
    nutrition.MEALS.forEach(m => { if (dm[m.id] === 'eaten') eaten++; });
    d = time.addDays(d, 1);
  }
  const pct = total > 0 ? Math.round((eaten / total) * 100) : 0;
  const text = pct >= 85 ? `${pct}% on plan. Strong week.`
             : pct >= 70 ? `${pct}% on plan. On the line.`
             : `${pct}% on plan. Reset this week.`;
  return { pct, text };
}

function bindEvents(el, state, todayDate, dow) {
  // Why hint
  el.querySelector('#why-hint')?.addEventListener('click', () => {
    document.getElementById('why-overlay').classList.add('open');
  });

  // Session card
  el.querySelector('#session-card')?.addEventListener('click', (e) => {
    const action = e.currentTarget.dataset.action;
    if (action === 'gym') location.hash = '/gym';
    else if (action === 'run') openRunLog();
    else if (action === 'flex') location.hash = '/gym';
  });

  // Big Four tap → Levels with lift detail
  el.querySelectorAll('.big-four-row').forEach(row => {
    row.addEventListener('click', () => {
      location.hash = `/levels?lift=${row.dataset.lift}`;
    });
  });

  // Meal buttons
  el.querySelectorAll('.meal-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setMeal(todayDate, btn.dataset.meal, btn.dataset.state);
      mount(el);
    });
  });

  // Meals summary → food
  el.querySelector('#meals-summary-row')?.addEventListener('click', () => {
    location.hash = '/food';
  });

  // Sunday review
  el.querySelector('#open-review-link')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-review'));
  });

  // Monday dismiss
  el.querySelector('#dismiss-monday')?.addEventListener('click', () => {
    store.setHabit(todayDate, 'lastWeekBannerDismissed', true);
    el.querySelector('#monday-banner')?.remove();
  });

  // GTG card — tap anywhere to log a set
  el.querySelector('#gtg-card')?.addEventListener('click', () => {
    const current = store.getHabits(todayDate).gtg || 0;
    if (current >= GTG_MAX) return;
    store.setHabit(todayDate, 'gtg', current + 1);
    updateGtg(todayDate);
  });
}

function openRunLog() {
  const todayDate = time.today();
  const existing  = store.getHabits(todayDate).run;

  const sheet = document.createElement('div');
  sheet.className = 'modal-overlay';
  sheet.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Log run</div>
      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">Distance (km)</div>
        <input class="modal-input" type="number" step="0.1" min="0" id="run-km-input"
               value="${existing ? existing.distance : ''}" placeholder="e.g. 5.5" style="margin-bottom:0" />
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">How did it feel?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${[['😌','Comfortable'],['😐','Neutral'],['😣','Tough']].map(([emoji, label]) => `
            <button class="run-mood-btn btn btn-ghost" data-mood="${emoji}"
                    style="flex-direction:column;gap:4px;min-height:56px;font-size:13px;
                           ${existing && existing.mood === emoji ? 'border-color:var(--lime);color:var(--lime)' : ''}">
              <span style="font-size:22px">${emoji}</span>${label}
            </button>`).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="run-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="run-save-btn">Save run</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);

  let selectedMood = existing ? existing.mood : '😌';
  sheet.querySelector(`[data-mood="${selectedMood}"]`)?.style.setProperty('border-color', 'var(--lime)');

  sheet.querySelectorAll('.run-mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.run-mood-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.color = '';
      });
      btn.style.borderColor = 'var(--lime)';
      btn.style.color = 'var(--lime)';
      selectedMood = btn.dataset.mood;
    });
  });

  sheet.querySelector('#run-cancel-btn').addEventListener('click', () => sheet.remove());

  sheet.querySelector('#run-save-btn').addEventListener('click', () => {
    const km = parseFloat(sheet.querySelector('#run-km-input').value);
    if (!km || km <= 0) {
      sheet.querySelector('#run-km-input').style.borderColor = 'var(--red)';
      return;
    }
    store.setHabit(todayDate, 'run', { distance: km, mood: selectedMood });
    sheet.remove();
  });

  sheet.addEventListener('click', e => {
    if (e.target === sheet) sheet.remove();
  });

  sheet.querySelector('#run-km-input').focus();
}

export function unmount() {}

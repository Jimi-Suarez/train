import * as store from '../store.js';
import * as time from '../time.js';
import * as nutrition from '../nutrition.js';

let currentDate = null;

export function mount(el) {
  if (!currentDate) currentDate = time.today();
  render(el);
}

export function unmount() {
  currentDate = null;
}

function render(el) {
  const state    = store.getState();
  const todayStr = time.today();
  const dayMeals = store.getMeals(currentDate) || {};
  const tapas    = dayMeals.tapa    || 0;
  const bites    = dayMeals.bites   || 0;
  const fruit    = dayMeals.fruit   || 0;
  const alcohol  = dayMeals.alcohol || 0;
  const protein  = nutrition.computeProtein(dayMeals);
  const target   = state.settings.proteinTarget;
  const proteinPct = Math.min(100, Math.round((protein / target) * 100));

  const [y, m, d]  = currentDate.split('-').map(Number);
  const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dow         = time.dayOfWeek(currentDate);
  const isToday     = currentDate === todayStr;
  const dateLabel   = isToday ? 'Today' : `${DAYS[dow]} ${d} ${MONTHS[m-1]}`;

  const lastWeek = computeLastWeek(state);

  el.innerHTML = `
    <div class="food-wrap">

      ${lastWeekPanelHTML(lastWeek)}

      <div class="day-nav">
        <button class="day-nav-btn" id="prev-day">‹</button>
        <div class="day-nav-label">${dateLabel}</div>
        <button class="day-nav-btn" id="next-day" ${isToday ? 'disabled' : ''}>›</button>
      </div>

      <div class="card food-summary">
        <div class="food-summary-row">
          <span class="food-summary-label">Protein</span>
          <span class="food-summary-value">${protein}g / ${target}g</span>
        </div>
        <div class="progress-bar-wrap" style="margin-bottom:10px">
          <div class="progress-bar-fill ${proteinPct >= 80 ? '' : proteinPct >= 60 ? 'amber' : 'red'}"
               style="width:${proteinPct}%"></div>
        </div>
        <div class="food-summary-row">
          <span class="food-summary-label">Meals</span>
          <div style="display:flex;align-items:center;gap:8px">
            ${mealDotsHTML(dayMeals)}
            <span class="text-muted text-sm">${countEaten(dayMeals)} of ${nutrition.MEALS.length} on plan</span>
          </div>
        </div>
        <div class="food-summary-row" style="margin-top:4px">
          <span class="food-summary-label">Tapas</span>
          <span class="food-summary-value">${tapas > 0 ? tapas : '—'}</span>
        </div>
        <div class="food-summary-row" style="margin-top:4px">
          <span class="food-summary-label">Bites</span>
          <span class="food-summary-value">${'🍪'.repeat(Math.min(bites, 10))}${bites > 10 ? ` ×${bites}` : ''} ${bites > 0 ? `(${bites})` : '—'}</span>
        </div>
      </div>

      <div class="card" style="padding:0 16px">
        ${nutrition.MEALS.map(meal => mealRowHTML(meal, dayMeals)).join('')}
      </div>

      <div class="food-extras">
        <button class="extra-btn" id="family-meal-btn">🍽️ Family meal</button>
        <button class="extra-btn" id="tapa-btn">🥨 Tapa <span style="color:var(--lime)">${tapas > 0 ? `×${tapas}` : ''}</span></button>
        <button class="extra-btn" id="bite-btn">🍪 Bite <span style="color:var(--lime)">${bites > 0 ? `×${bites}` : ''}</span></button>
        <button class="extra-btn" id="fruit-btn">🍎 Fruit <span style="color:var(--lime)">${fruit > 0 ? `×${fruit}` : ''}</span></button>
        <button class="extra-btn" id="alcohol-btn">🍷 Alcohol <span style="color:var(--lime)">${alcohol > 0 ? `×${alcohol}` : ''}</span></button>
      </div>
    </div>`;

  bindEvents(el, todayStr);
}

function mealRowHTML(meal, dayMeals) {
  const st = dayMeals[meal.id] || null;
  const isActive = (target) => st === target ? 'active ' + target : '';
  const NOW = new Date();
  const [wh, wm] = meal.windowStart.split(':').map(Number);
  const inWindow = NOW.getHours() === wh || (NOW.getHours() * 60 + NOW.getMinutes() >= wh * 60 + wm - 30
                    && NOW.getHours() * 60 + NOW.getMinutes() <= wh * 60 + wm + 90);

  return `
    <div class="meal-row">
      <div class="meal-row-left">
        <div class="meal-row-time">${meal.time}</div>
        <div class="meal-row-name ${inWindow && !st ? 'active' : ''}">${meal.name}
          ${meal.protein ? `<span class="text-muted text-xs"> · ${meal.protein}g protein</span>` : ''}
        </div>
        ${st === 'replaced' ? '<div class="text-muted text-xs">Family meal</div>' : ''}
      </div>
      <div class="meal-state-btns">
        <button class="meal-state-btn ${isActive('eaten')}"   data-meal="${meal.id}" data-state="eaten">✓</button>
        <button class="meal-state-btn ${isActive('skipped')}" data-meal="${meal.id}" data-state="skipped">✕</button>
      </div>
    </div>`;
}

function mealDotsHTML(dayMeals) {
  return nutrition.MEALS.map(m => {
    const st = dayMeals[m.id];
    const cls = st === 'eaten' ? 'eaten' : st === 'skipped' ? 'skipped' : st === 'replaced' ? 'replaced' : '';
    return `<div class="meal-dot ${cls}"></div>`;
  }).join('');
}

function countEaten(dayMeals) {
  return nutrition.MEALS.filter(m => dayMeals[m.id] === 'eaten').length;
}

function computeLastWeek(state) {
  const { start: wkStart } = time.weekStartEnd();
  const prevSun = time.addDays(wkStart, -1);
  const prevMon = time.addDays(prevSun, -6);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, pm, pd] = prevMon.split('-').map(Number);
  const [, sm, sd] = prevSun.split('-').map(Number);
  const rangeLabel = `${pd} ${MONTHS[pm-1]} – ${sd} ${MONTHS[sm-1]}`;

  let days = 0;
  let eaten = 0, skipped = 0, familyCount = 0;
  let totalTapas = 0, totalBites = 0, totalFruit = 0, totalAlcohol = 0;

  let d = prevMon;
  while (d <= prevSun) {
    days++;
    const dm = state.meals[d] || {};
    nutrition.MEALS.forEach(meal => {
      const st = dm[meal.id];
      if (st === 'eaten')    eaten++;
      if (st === 'skipped')  skipped++;
      if (st === 'replaced') familyCount++;
    });
    totalTapas   += dm.tapa    || 0;
    totalBites   += dm.bites   || 0;
    totalFruit   += dm.fruit   || 0;
    totalAlcohol += dm.alcohol || 0;
    d = time.addDays(d, 1);
  }

  const totalPlanned = days * nutrition.MEALS.length;
  const pct        = totalPlanned > 0 ? Math.round((eaten       / totalPlanned) * 100) : 0;
  const skippedPct = totalPlanned > 0 ? Math.round((skipped     / totalPlanned) * 100) : 0;
  const familyPct  = totalPlanned > 0 ? Math.round((familyCount / totalPlanned) * 100) : 0;
  const verdict    = nutrition.verdictText(pct, familyCount, totalBites);

  return { rangeLabel, totalPlanned, eaten, skipped, familyCount, totalTapas, totalBites, totalFruit, totalAlcohol, pct, skippedPct, familyPct, verdict };
}

function lastWeekPanelHTML(lw) {
  const bitesWarn = lw.totalBites > 7;
  return `
    <div class="lastweek-panel">
      <div class="lastweek-title">Last week · ${lw.rangeLabel}</div>

      <div class="section-label" style="margin:8px 0 4px">MEALS</div>
      <div class="lastweek-row">
        <span style="color:var(--green)">✓ On plan</span>
        <span>${lw.eaten} (${lw.pct}%)</span>
      </div>
      <div class="lastweek-row">
        <span style="color:var(--red)">✕ Skipped</span>
        <span>${lw.skipped} (${lw.skippedPct}%)</span>
      </div>
      <div class="lastweek-row">
        <span>🍽️ Family meals</span>
        <span>${lw.familyCount} (${lw.familyPct}%)</span>
      </div>

      <div class="section-label" style="margin:8px 0 4px">EXTRAS</div>
      <div class="lastweek-row">
        <span>🥨 Tapas</span>
        <span>${lw.totalTapas}</span>
      </div>
      <div class="lastweek-row">
        <span>🍪 Bites</span>
        <span>${lw.totalBites}${bitesWarn ? '<span class="warn-tag">⚠ creeping</span>' : ''}</span>
      </div>
      <div class="lastweek-row">
        <span>🍎 Fruit</span>
        <span>${lw.totalFruit}</span>
      </div>
      <div class="lastweek-row" style="border-bottom:none">
        <span>🍷 Drinks</span>
        <span>${lw.totalAlcohol}</span>
      </div>

      <div class="verdict-box">
        <div class="verdict-text">${lw.verdict}</div>
      </div>
    </div>`;
}

function bindCounter(btn, onTap, onHold) {
  let timer = null;
  let didHold = false;

  btn.addEventListener('pointerdown', () => {
    didHold = false;
    timer = setTimeout(() => {
      didHold = true;
      onHold();
      btn.classList.add('decrementing');
      setTimeout(() => btn.classList.remove('decrementing'), 150);
    }, 500);
  });

  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener('pointerup',     () => { if (timer) { cancel(); if (!didHold) onTap(); } });
  btn.addEventListener('pointerleave',  cancel);
  btn.addEventListener('pointercancel', cancel);
}

function bindEvents(el, todayStr) {
  el.querySelector('#prev-day').addEventListener('click', () => {
    currentDate = time.addDays(currentDate, -1);
    render(el);
  });

  el.querySelector('#next-day').addEventListener('click', () => {
    if (currentDate < todayStr) {
      currentDate = time.addDays(currentDate, 1);
      render(el);
    }
  });

  el.querySelectorAll('.meal-state-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal  = btn.dataset.meal;
      const state = btn.dataset.state;
      const cur   = (store.getMeals(currentDate) || {})[meal];
      store.setMeal(currentDate, meal, cur === state ? null : state);
      render(el);
    });
  });

  bindCounter(
    el.querySelector('#tapa-btn'),
    () => { store.incrementTapa(currentDate);    render(el); },
    () => { store.decrementTapa(currentDate);    render(el); }
  );

  bindCounter(
    el.querySelector('#bite-btn'),
    () => { const dm = store.getMeals(currentDate) || {}; store.setBites(currentDate, (dm.bites || 0) + 1);            render(el); },
    () => { const dm = store.getMeals(currentDate) || {}; store.setBites(currentDate, Math.max(0, (dm.bites || 0) - 1)); render(el); }
  );

  bindCounter(
    el.querySelector('#fruit-btn'),
    () => { store.incrementFruit(currentDate);   render(el); },
    () => { store.decrementFruit(currentDate);   render(el); }
  );

  bindCounter(
    el.querySelector('#alcohol-btn'),
    () => { store.incrementAlcohol(currentDate); render(el); },
    () => { store.decrementAlcohol(currentDate); render(el); }
  );

  el.querySelector('#family-meal-btn').addEventListener('click', () => {
    const options = nutrition.MEALS.filter(m => m.id !== 'shake');

    const sheet = document.createElement('div');
    sheet.className = 'modal-overlay';
    sheet.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">Which meal does this replace?</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${options.map(m => `
            <button class="btn btn-ghost family-meal-option" data-meal-id="${m.id}"
                    style="justify-content:flex-start;gap:10px;text-align:left">
              <span style="font-size:13px;font-weight:600">${m.name}</span>
              <span style="color:var(--text2);font-size:12px;margin-left:auto">${m.time}</span>
            </button>`).join('')}
        </div>
        <button class="btn btn-ghost" id="family-cancel-btn">Cancel</button>
      </div>`;

    document.body.appendChild(sheet);

    sheet.querySelectorAll('.family-meal-option').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setFamilyMeal(currentDate, btn.dataset.mealId);
        sheet.remove();
        render(el);
      });
    });

    sheet.querySelector('#family-cancel-btn').addEventListener('click', () => sheet.remove());
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  });
}

import * as store from './store.js';
import { mount as mountToday,  unmount as unmountToday  } from './views/today.js';
import { mount as mountGym,    unmount as unmountGym    } from './views/gym.js';
import { mount as mountFood,   unmount as unmountFood   } from './views/food.js';
import { mount as mountTrends, unmount as unmountTrends } from './views/trends.js';
import { mount as mountISAK,   unmount as unmountISAK   } from './views/isak.js';
import { mount as mountLevels, unmount as unmountLevels } from './views/levels.js';
import * as time from './time.js';
import { currentISOWeek } from './time.js';
import * as nutrition from './nutrition.js';

const VIEWS = {
  today:  { mount: mountToday,  unmount: unmountToday  },
  gym:    { mount: mountGym,    unmount: unmountGym    },
  food:   { mount: mountFood,   unmount: unmountFood   },
  trends: { mount: mountTrends, unmount: unmountTrends },
  isak:   { mount: mountISAK,   unmount: unmountISAK   },
  levels: { mount: mountLevels, unmount: unmountLevels },
};

let currentViewKey = null;
const viewEl = document.getElementById('view');

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  store.load();

  // Seed ISAK data on first run
  try {
    const seed = await fetch('./data/seed.json').then(r => r.json());
    store.seedIfEmpty(seed);
  } catch (e) {
    console.warn('Could not load seed data', e);
  }

  store.seedFirstSession();
  store.seedLiftWeights();
  store.migrateToLastReps();

  setupRouter();
  setupTabBar();
  setupDrawer();
  setupWhyOverlay();
  setupReview();
  route();
}

// ─── Router ───────────────────────────────────────────────────────────────────

function currentTabKey() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VIEWS[hash] ? hash : 'today';
}

function route() {
  const key = currentTabKey();

  // Unmount current view
  if (currentViewKey && VIEWS[currentViewKey]) {
    VIEWS[currentViewKey].unmount();
  }

  // Mount new view
  currentViewKey = key;
  viewEl.innerHTML = '';
  VIEWS[key].mount(viewEl);

  // Update topbar title
  const TITLES = { today: 'Train', gym: 'Gym', food: 'Food', trends: 'Trends', isak: 'ISAK', levels: 'Levels' };
  document.getElementById('topbar-title').textContent = TITLES[key] || 'Train';

  // Update tab bar active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === key);
  });
}

function setupRouter() {
  window.addEventListener('hashchange', route);
}

function setupTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newHash = '#/' + btn.dataset.tab;
      if (location.hash === newHash) {
        route();
      } else {
        location.hash = '/' + btn.dataset.tab;
      }
    });
  });
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function setupDrawer() {
  const menuBtn     = document.getElementById('menu-btn');
  const drawer      = document.getElementById('drawer');
  const overlay     = document.getElementById('drawer-overlay');

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    populateDrawer();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }

  menuBtn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Export
  document.getElementById('export-btn').addEventListener('click', () => {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `train-backup-${time.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  document.getElementById('import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!confirm('This will replace all current data. Are you sure?')) return;
      try {
        store.importJSON(ev.target.result);
        closeDrawer();
        route();
        alert('Data imported successfully.');
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Wipe all data? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure?')) return;
    store.wipeAll();
    closeDrawer();
    route();
  });

  // Photo
  document.getElementById('photo-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const yearMonth = time.today().slice(0, 7);
      store.setPhoto(yearMonth, { dataUrl: ev.target.result, takenAt: Date.now() });
      alert('Photo saved.');
      populateDrawer();
    };
    reader.readAsDataURL(file);
  });
}

function populateDrawer() {
  const todayDate = time.today();
  const dow       = time.dayOfWeek(todayDate);
  const isSunday  = dow === 0;
  const week      = currentISOWeek();
  const review    = store.getReview(week);
  const habits    = store.getHabits(todayDate);

  // Review section
  const openBtn    = document.getElementById('open-review-btn');
  const reviewStatus = document.getElementById('review-status');
  if (isSunday) {
    openBtn.style.display = 'block';
    reviewStatus.textContent = '';
  } else {
    openBtn.style.display = 'none';
    reviewStatus.textContent = review ? `Last review: ${week} ✓` : `No review this week yet`;
  }
  openBtn.onclick = openReview;

  // Habits
  const habitsEl = document.getElementById('drawer-habits');
  const isTrainingDay = [1,2,3,4].includes(dow);
  const habitsHTML = [];

  if (isTrainingDay) {
    habitsHTML.push(`
      <div class="toggle-row">
        <span class="toggle-label">Kit laid out for tomorrow</span>
        <label class="toggle">
          <input type="checkbox" id="kit-toggle" ${habits.kitLaidOut ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>`);
  }
  habitsHTML.push(`
    <div class="toggle-row">
      <span class="toggle-label">Mobility / dead hangs done</span>
      <label class="toggle">
        <input type="checkbox" id="mobility-toggle" ${habits.mobility ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>`);

  habitsEl.innerHTML = habitsHTML.join('');

  document.getElementById('kit-toggle')?.addEventListener('change', e => {
    store.setHabit(todayDate, 'kitLaidOut', e.target.checked);
  });
  document.getElementById('mobility-toggle')?.addEventListener('change', e => {
    store.setHabit(todayDate, 'mobility', e.target.checked);
  });

  // Photo
  const photos = store.getAllPhotos();
  const photoKeys = Object.keys(photos).sort();
  const lastPhotoKey = photoKeys[photoKeys.length - 1];
  const photoEl = document.getElementById('drawer-photo');
  if (lastPhotoKey) {
    const months = Math.round((Date.now() - photos[lastPhotoKey].takenAt) / (30 * 24 * 60 * 60 * 1000));
    photoEl.textContent = `Last photo: ${months === 0 ? 'this month' : months + ' month(s) ago'}`;
  } else {
    photoEl.textContent = 'No photos yet.';
  }
}

// ─── Why overlay ──────────────────────────────────────────────────────────────

function setupWhyOverlay() {
  const overlay = document.getElementById('why-overlay');

  overlay.addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  // Pull-down gesture on main view
  let startY = 0;
  viewEl.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  viewEl.addEventListener('touchend', e => {
    const deltaY = e.changedTouches[0].clientY - startY;
    if (deltaY > 80 && viewEl.scrollTop === 0) {
      overlay.classList.add('open');
    }
  }, { passive: true });
}

// ─── Sunday review ────────────────────────────────────────────────────────────

function setupReview() {
  document.addEventListener('open-review', openReview);

  document.getElementById('open-review-btn').addEventListener('click', openReview);
  document.getElementById('close-review-btn').addEventListener('click', closeReview);
}

function openReview() {
  const modal   = document.getElementById('review-modal');
  const form    = document.getElementById('review-form');
  const week    = currentISOWeek();
  const todayDate = time.today();
  const { start, end } = time.weekStartEnd();
  const state   = store.getState();

  // Auto-compute sessions and protein
  const completedSessions = Object.keys(state.sessions)
    .filter(d => d >= start && d <= todayDate && state.sessions[d].completedAt).length;
  let proteinDays = 0, totalDays = 0;
  let d = start;
  while (d <= todayDate) {
    totalDays++;
    const dm = state.meals[d] || {};
    if (nutrition.computeProtein(dm) >= state.settings.proteinTarget) proteinDays++;
    d = time.addDays(d, 1);
  }
  const proteinHit = totalDays > 0 && proteinDays >= totalDays * 0.5;

  form.innerHTML = `
    <div style="margin-bottom:20px">
      <div class="section-label">Sessions this week</div>
      <div style="font-size:24px;font-weight:700">${completedSessions} / 4</div>
    </div>
    <div style="margin-bottom:20px">
      <div class="section-label">Protein target hit most days?</div>
      <div style="font-size:16px;color:${proteinHit ? 'var(--green)' : 'var(--red)'}">${proteinHit ? '✓ Yes' : '✕ No'} (${proteinDays}/${totalDays} days)</div>
    </div>
    <div style="margin-bottom:20px">
      <div class="section-label">Waist feel</div>
      <div style="display:flex;gap:10px">
        ${['better','same','worse'].map(v => `<button class="btn btn-ghost btn-sm waist-btn" data-val="${v}" style="width:auto">${v}</button>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="section-label">Energy levels this week</div>
      <div style="display:flex;gap:8px">
        ${[1,2,3,4,5].map(n => `<button class="btn btn-ghost btn-sm energy-btn" data-val="${n}" style="width:44px;min-height:44px">${n}</button>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="section-label">Disruptions?</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${['Bad sleep','Work','Family','Illness','Travel','Other'].map(v =>
          `<button class="btn btn-ghost btn-sm dis-btn" data-val="${v}" style="width:auto">${v}</button>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="section-label">Note (optional)</div>
      <textarea id="review-note" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:10px;font-family:inherit;min-height:80px;resize:vertical" placeholder="Anything else..."></textarea>
    </div>
    <button class="btn btn-primary" id="submit-review-btn">Submit review</button>`;

  modal.style.display = 'block';

  let waistFeel = null, energy = null;
  const disruptions = [];

  form.querySelectorAll('.waist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.waist-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.style.borderColor = 'var(--lime)';
      btn.style.color       = 'var(--lime)';
      waistFeel = btn.dataset.val;
    });
  });
  form.querySelectorAll('.energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.energy-btn').forEach(b => { b.style.borderColor = ''; b.style.color = ''; });
      btn.style.borderColor = 'var(--lime)';
      btn.style.color       = 'var(--lime)';
      energy = parseInt(btn.dataset.val);
    });
  });
  form.querySelectorAll('.dis-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const idx = disruptions.indexOf(val);
      if (idx === -1) {
        disruptions.push(val);
        btn.style.borderColor = 'var(--lime)';
        btn.style.color       = 'var(--lime)';
      } else {
        disruptions.splice(idx, 1);
        btn.style.borderColor = '';
        btn.style.color       = '';
      }
    });
  });

  document.getElementById('submit-review-btn').addEventListener('click', () => {
    const note = document.getElementById('review-note').value;
    store.setReview(week, {
      sessions: completedSessions,
      proteinHit,
      waistFeel,
      energy,
      disruptions,
      note: note || null,
    });
    closeReview();
    alert('Review saved. Good work.');
  });
}

function closeReview() {
  document.getElementById('review-modal').style.display = 'none';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();

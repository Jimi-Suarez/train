import * as store from '../store.js';
import * as isakModel from '../isak.js';

let activeMetric = 'waist';

const METRICS = [
  { key: 'waist',      label: 'Waist',       unit: 'cm',  goodDir: -1 },
  { key: 'ratio',      label: 'Ratio',       unit: '',    goodDir: -1, decimals: 3 },
  { key: 'fatMass',    label: 'Fat mass',    unit: 'kg',  goodDir: -1 },
  { key: 'muscleMass', label: 'Muscle mass', unit: 'kg',  goodDir:  1 },
  { key: 'skinfoldSum',label: 'Σ6 skinfolds',unit: 'mm',  goodDir: -1 },
  { key: 'weight',     label: 'Weight',      unit: 'kg',  goodDir: -1 },
];

export function mount(el) {
  render(el);
  document.addEventListener('click', dismissTooltip);
}

export function unmount() {
  document.removeEventListener('click', dismissTooltip);
  dismissTooltip();
}

function render(el) {
  const isakData  = store.getAllISAK();
  const all       = isakModel.allMeasurements(isakData);
  const latest    = isakModel.latestMeasurement(isakData);
  const first     = isakModel.firstMeasurement(isakData);
  const peak      = isakModel.peakMeasurement(isakData);

  el.innerHTML = `
    <div class="isak-wrap">
      ${isakCountdownBanner()}

      <!-- 6 metric cards -->
      <div class="metric-grid">
        ${METRICS.map(m => metricCardHTML(m, latest, first, peak)).join('')}
      </div>

      <!-- Chart -->
      <div class="chart-container">
        <div class="chart-toggle">
          ${METRICS.map(m => `
            <button class="chart-toggle-btn ${m.key === activeMetric ? 'active' : ''}"
                    data-metric="${m.key}">${m.label}</button>`).join('')}
        </div>
        ${isakChartSVG(all, activeMetric, peak, isakModel.TARGETS)}
      </div>

      <!-- Targets -->
      <div class="card" style="margin-bottom:12px">
        <div class="section-label">Return to Nov 2025 peak</div>
        ${peak ? `
          <table class="targets-table">
            <tr><td>Ratio</td><td>${peak.ratio}</td><td style="color:var(--text2)">now ${latest ? latest.ratio : '—'}</td></tr>
            <tr><td>Fat mass</td><td>${peak.fatMass} kg</td><td style="color:var(--text2)">now ${latest ? latest.fatMass : '—'}</td></tr>
            <tr><td>Σ6 skinfolds</td><td>${peak.skinfoldSum} mm</td><td style="color:var(--text2)">now ${latest ? latest.skinfoldSum : '—'}</td></tr>
          </table>` : '<div class="text-muted text-sm">No peak data.</div>'}
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-label">Forward path</div>
        <table class="targets-table">
          <tr>
            <th></th>
            <th>Now</th>
            <th>3 mo</th>
            <th>6 mo</th>
            <th>12 mo</th>
          </tr>
          ${forwardRows(latest)}
        </table>
      </div>

      <div class="spacer-20"></div>

      <button class="btn btn-ghost" id="add-isak-btn" style="margin-bottom:32px">
        + Add measurement
      </button>
    </div>`;

  bindEvents(el);
}

function metricCardHTML(metric, latest, first, peak) {
  const val    = latest ? latest[metric.key] : null;
  const fVal   = first  ? first[metric.key]  : null;
  const pVal   = peak   ? peak[metric.key]   : null;
  const dec    = metric.decimals || 1;
  const fmt    = v => v != null ? (+v).toFixed(dec) : '—';

  let delta = null;
  let deltaClass = '';
  if (val != null && fVal != null) {
    delta = +(val - fVal).toFixed(dec);
    const improved = (metric.goodDir === -1 && delta <= 0) || (metric.goodDir === 1 && delta >= 0);
    deltaClass = improved ? 'good' : 'bad';
  }

  const atPeak = pVal != null && val != null &&
    ((metric.goodDir === -1 && val > pVal) || (metric.goodDir === 1 && val < pVal));

  return `
    <div class="metric-card">
      <div class="metric-card-label">${metric.label}</div>
      <div class="metric-card-value">${fmt(val)}${metric.unit ? ' ' + metric.unit : ''}</div>
      ${delta != null ? `
        <div class="metric-card-delta ${deltaClass}">
          ${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} since ${first ? first.date.slice(0,7) : '—'}
        </div>` : ''}
      ${atPeak ? `<div class="metric-card-peak">⚠ above Nov 2025 peak</div>` : ''}
    </div>`;
}

function forwardRows(latest) {
  const T = isakModel.TARGETS;
  const now = latest;
  const rows = [
    { label: 'Waist',    key: 'waist',    unit: 'cm' },
    { label: 'Ratio',    key: 'ratio',    unit: '' },
    { label: 'Fat mass', key: 'fatMass',  unit: 'kg' },
    { label: 'Weight',   key: 'weight',   unit: 'kg' },
  ];
  return rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td>${now ? (+(now[r.key]||0)).toFixed(r.key==='ratio'?3:1) : '—'}${r.unit}</td>
      <td>${T['3mo'][r.key]}${r.unit}</td>
      <td>${T['6mo'][r.key]}${r.unit}</td>
      <td>${T['12mo'][r.key]}${r.unit}</td>
    </tr>`).join('');
}

function isakChartSVG(measurements, metric, peak, targets) {
  const validPts = measurements.filter(m => m[metric] != null);
  if (validPts.length < 2) {
    return '<div class="text-muted text-sm" style="padding:20px 0;text-align:center">Not enough data</div>';
  }

  const W = 320, H = 160;
  const padL = 44, padR = 16, padT = 16, padB = 28;
  const w = W - padL - padR;
  const h = H - padT - padB;

  const dates  = validPts.map(m => new Date(m.date).getTime());
  const values = validPts.map(m => parseFloat(m[metric]));
  const minD   = Math.min(...dates), maxD = Math.max(...dates);
  const minV   = Math.min(...values), maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;
  const rangeD = maxD - minD || 1;

  const px = d  => padL + ((d - minD) / rangeD) * w;
  const py = v  => padT + h - ((v - minV) / rangeV) * h;

  const pathD = validPts.map((m, i) => {
    const x = px(new Date(m.date).getTime());
    const y = py(parseFloat(m[metric]));
    return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const dots = validPts.map(m => {
    const x   = px(new Date(m.date).getTime());
    const y   = py(parseFloat(m[metric]));
    const val = parseFloat(m[metric]);
    return `<g class="isak-dot" data-date="${m.date}" data-val="${val}" style="cursor:pointer">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="transparent" />
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--lime)" />
    </g>`;
  }).join('');

  const targetMetricKey = { 'fatMass': 'fatMass', 'waist': 'waist', 'ratio': 'ratio', 'weight': 'weight' }[metric];
  let overlayLines = '';
  if (peak && peak[metric] != null) {
    const py_peak = py(parseFloat(peak[metric]));
    if (py_peak >= padT && py_peak <= padT + h) {
      overlayLines += `<line x1="${padL}" y1="${py_peak.toFixed(1)}" x2="${padL+w}" y2="${py_peak.toFixed(1)}" stroke="#9966cc" stroke-width="1" stroke-dasharray="4,3" opacity="0.7" />
        <text x="${padL+2}" y="${(py_peak-3).toFixed(1)}" font-size="9" fill="#9966cc">Nov peak</text>`;
    }
  }

  const labels = validPts.filter((_, i) => i === 0 || i === validPts.length - 1 || i % Math.ceil(validPts.length / 4) === 0).map(m => {
    const x = px(new Date(m.date).getTime());
    const label = m.date.slice(0,7);
    return `<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--text3)">${label}</text>`;
  }).join('');

  const yLabels = [minV, (minV + maxV) / 2, maxV].map(v => {
    const dec = metric === 'ratio' ? 3 : 1;
    return `<text x="${padL-4}" y="${(py(v)+4).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text3)">${v.toFixed(dec)}</text>`;
  }).join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${overlayLines}
      <path d="${pathD}" stroke="var(--lime)" stroke-width="2" fill="none" stroke-linejoin="round" />
      ${dots}
      ${labels}
      ${yLabels}
    </svg>`;
}

function isakCountdownBanner() {
  const APPT = '2026-05-25';
  const today = new Date();
  const appt  = new Date(APPT);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const apptMidnight  = new Date(appt.getFullYear(), appt.getMonth(), appt.getDate());
  const days = Math.round((apptMidnight - todayMidnight) / 86400000);

  if (days < 0) return '';

  const message = days === 0
    ? 'TODAY — Walk in without fear.'
    : `${days} day${days === 1 ? '' : 's'} until ISAK with Fran`;

  return `
    <div style="
      background: var(--lime-dim);
      border: 1px solid rgba(196,255,61,.35);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 12px;
    ">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--lime);margin-bottom:4px">
        ISAK · ${APPT}
      </div>
      <div style="font-size:17px;font-weight:700;color:var(--lime)">${message}</div>
    </div>`;
}

function showTooltip(dot) {
  dismissTooltip();
  const date   = dot.dataset.date;
  const val    = parseFloat(dot.dataset.val);
  const metric = METRICS.find(m => m.key === activeMetric);
  const dec    = metric?.decimals || 1;
  const unit   = metric?.unit || '';

  const tip = document.createElement('div');
  tip.id    = 'isak-tooltip';
  tip.textContent = `${date.slice(0, 7)}  ·  ${val.toFixed(dec)}${unit ? ' ' + unit : ''}`;
  Object.assign(tip.style, {
    position:      'fixed',
    background:    '#1e1e1e',
    color:         '#f0f0f0',
    border:        '1px solid #3a3a3a',
    borderRadius:  '8px',
    padding:       '6px 12px',
    fontSize:      '13px',
    fontWeight:    '600',
    fontFamily:    'inherit',
    zIndex:        '999',
    pointerEvents: 'none',
    whiteSpace:    'nowrap',
    boxShadow:     '0 4px 12px rgba(0,0,0,.5)',
    left:          '-9999px',
    top:           '-9999px',
  });
  document.body.appendChild(tip);

  requestAnimationFrame(() => {
    const rect = dot.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top;
    const tw   = tip.offsetWidth;
    const th   = tip.offsetHeight;
    let left   = cx - tw / 2;
    let top    = cy - th - 8;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    if (top < 8) top = rect.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
  });
}

function dismissTooltip() {
  document.getElementById('isak-tooltip')?.remove();
}

function bindChartTooltips(el) {
  el.querySelectorAll('.isak-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      showTooltip(dot);
    });
    dot.addEventListener('touchend', e => {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(dot);
    }, { passive: false });
  });
}

function bindEvents(el) {
  el.querySelectorAll('.chart-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMetric = btn.dataset.metric;
      render(el);
    });
  });

  bindChartTooltips(el);

  el.querySelector('#add-isak-btn')?.addEventListener('click', () => openAddMeasurementSheet(el));
}

function openAddMeasurementSheet(el) {
  const today = new Date();
  const defaultDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const sheet = document.createElement('div');
  sheet.className = 'modal-overlay';
  sheet.innerHTML = `
    <div class="modal-sheet" style="max-height:90dvh;overflow-y:auto">
      <div class="modal-title">Add ISAK measurement</div>
      <div class="isak-form">
        <div class="form-row">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" id="isak-date" value="${defaultDate}" />
        </div>
        <div class="form-row">
          <label class="form-label">Weight (kg)</label>
          <input class="form-input" type="number" step="0.1" id="isak-weight" placeholder="e.g. 87.5" />
        </div>
        <div class="form-row">
          <label class="form-label">Waist (cm)</label>
          <input class="form-input" type="number" step="0.1" id="isak-waist" placeholder="e.g. 90.5" />
        </div>
        <div class="form-row">
          <label class="form-label">Σ6 Skinfolds (mm)</label>
          <input class="form-input" type="number" step="0.5" id="isak-skinfolds" placeholder="e.g. 83" />
        </div>
        <div class="form-row">
          <label class="form-label">Fat mass (kg)</label>
          <input class="form-input" type="number" step="0.01" id="isak-fatmass" placeholder="e.g. 19.5" />
        </div>
        <div class="form-row">
          <label class="form-label">Muscle mass (kg)</label>
          <input class="form-input" type="number" step="0.01" id="isak-musclemass" placeholder="e.g. 35.0" />
        </div>
        <div class="form-row">
          <label class="form-label">Height (cm)</label>
          <input class="form-input" type="number" step="0.1" id="isak-height" value="169" />
        </div>
        <div id="isak-error" style="font-size:13px;color:var(--red);display:none;margin-top:-6px"></div>
        <div class="modal-actions" style="margin-top:8px">
          <button class="btn btn-ghost" id="isak-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="isak-save-btn">Save</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(sheet);

  sheet.querySelector('#isak-cancel-btn').addEventListener('click', () => sheet.remove());
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });

  sheet.querySelector('#isak-save-btn').addEventListener('click', () => {
    const dateVal     = sheet.querySelector('#isak-date').value.trim();
    const weightVal   = parseFloat(sheet.querySelector('#isak-weight').value);
    const waistVal    = parseFloat(sheet.querySelector('#isak-waist').value);
    const skinfoldsVal= parseFloat(sheet.querySelector('#isak-skinfolds').value);
    const fatVal      = parseFloat(sheet.querySelector('#isak-fatmass').value);
    const muscleVal   = parseFloat(sheet.querySelector('#isak-musclemass').value);
    const heightVal   = parseFloat(sheet.querySelector('#isak-height').value);

    const errEl = sheet.querySelector('#isak-error');
    if (!dateVal || isNaN(weightVal) || isNaN(waistVal) || isNaN(heightVal)) {
      errEl.textContent = 'Date, weight, waist and height are required.';
      errEl.style.display = 'block';
      return;
    }

    const data = { weight: weightVal, waist: waistVal, height: heightVal };
    if (!isNaN(skinfoldsVal)) data.skinfoldSum = skinfoldsVal;
    if (!isNaN(fatVal))       data.fatMass     = fatVal;
    if (!isNaN(muscleVal))    data.muscleMass  = muscleVal;

    store.setISAK(dateVal, data);
    sheet.remove();
    render(el);
  });
}

export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return toISODate(new Date());
}

export function dayOfWeek(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun, 1=Mon…6=Sat
}

export function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return toISODate(date);
}

export function weekStartEnd(date = new Date()) {
  const isoDate = toISODate(date);
  const dow = dayOfWeek(isoDate);
  const daysFromMon = (dow === 0 ? 6 : dow - 1);
  const start = addDays(isoDate, -daysFromMon);
  const end   = addDays(start, 6);
  return { start, end };
}

export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentISOWeek() {
  return isoWeek(new Date());
}

export function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

export function formatShortDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function weekNumber(startedAt) {
  if (!startedAt) return null;
  const [y, m, d] = startedAt.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now   = new Date();
  const diff  = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  return diff + 1;
}

export function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

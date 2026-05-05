export const PEAK_DATE = '2025-11-05';

export const TARGETS = {
  '3mo':  { waist: 87,   ratio: 0.54, fatMass: 17.5, weight: 85 },
  '6mo':  { waist: 84,   ratio: 0.50, fatMass: 14.5, weight: 82 },
  '12mo': { waist: 80,   ratio: 0.46, fatMass: 12.0, weight: 79 },
};

export const PEAK_TARGETS = {
  ratio:       0.54,
  fatMass:     19.33,
  skinfoldSum: 81,
};

export function computeRatio(measurement) {
  if (!measurement || !measurement.waist || !measurement.height) return null;
  return +(measurement.waist / measurement.height).toFixed(3);
}

export function sortedDates(isakData) {
  return Object.keys(isakData || {}).sort();
}

export function withComputed(date, raw) {
  return { date, ...raw, ratio: computeRatio(raw) };
}

export function latestMeasurement(isakData) {
  const dates = sortedDates(isakData);
  if (!dates.length) return null;
  const d = dates[dates.length - 1];
  return withComputed(d, isakData[d]);
}

export function firstMeasurement(isakData) {
  const dates = sortedDates(isakData);
  if (!dates.length) return null;
  return withComputed(dates[0], isakData[dates[0]]);
}

export function peakMeasurement(isakData) {
  if (!isakData[PEAK_DATE]) return null;
  return withComputed(PEAK_DATE, isakData[PEAK_DATE]);
}

export function allMeasurements(isakData) {
  return sortedDates(isakData).map(d => withComputed(d, isakData[d]));
}

export function delta(current, first, key) {
  if (!current || !first) return null;
  const c = current[key];
  const f = first[key];
  if (c == null || f == null) return null;
  return +(c - f).toFixed(2);
}

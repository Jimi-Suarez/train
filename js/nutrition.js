const SHAKE     = { id: 'shake',     time: '05:00', name: '1 scoop MyProtein whey + 5g creatina',  protein: 25, windowStart: '04:40', windowEnd: '05:45' };
const BREAKFAST = { id: 'breakfast', time: '07:00', name: '3 huevos grandes + tomate + 1 plátano + 1 manzana + 300g sandía', protein: 25, windowStart: '06:30', windowEnd: '07:45' };
const SNACK     = { id: 'snack',     time: '17:00', name: '2 huevos grandes',                        protein: 14, windowStart: '16:30', windowEnd: '17:45' };
const DINNER    = { id: 'dinner',    time: '21:00', name: '150g yogur proteínas Mercadona + 1 scoop whey + 40g frutos rojos + 28g nueces + 15g corn flakes', protein: 44, windowStart: '20:30', windowEnd: '21:45' };

// Lunch varies by day group (same meal id, different food)
const LUNCH_TOFU    = { id: 'lunch', time: '13:00', name: '200g tofu Hacendado escurrido + 100g patatas/arroz basmati + 150–200g verduras',  protein: 29, windowStart: '12:30', windowEnd: '14:00' };
const LUNCH_MERLUZA = { id: 'lunch', time: '13:00', name: '250g merluza Hacendado + 100g patatas/arroz basmati + 150–200g verduras',          protein: 51, windowStart: '12:30', windowEnd: '14:00' };
const LUNCH_SALMON  = { id: 'lunch', time: '13:00', name: '250g salmón Hacendado + 100g patatas/arroz basmati + 150–200g verduras',           protein: 53, windowStart: '12:30', windowEnd: '14:00' };

function dowFromISO(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
}

export function mealsForDay(isoDate) {
  const dow = dowFromISO(isoDate);
  let lunch;
  if (dow === 0)     lunch = LUNCH_SALMON;   // Sunday
  else if (dow >= 5) lunch = LUNCH_MERLUZA;  // Fri / Sat
  else               lunch = LUNCH_TOFU;     // Mon – Thu

  const meals = [BREAKFAST, lunch, SNACK, DINNER];
  if (dow !== 0) meals.unshift(SHAKE);  // no shake on Sunday
  return meals;
}

// Mon–Thu set — used where no date context is available
export const MEALS = mealsForDay('2026-06-02');

export const PROTEIN_TARGET = 150;
export const KCAL_TARGET    = 1681;

export function computeProtein(dayMeals, isoDate) {
  if (!dayMeals) return 0;
  const meals = isoDate ? mealsForDay(isoDate) : MEALS;
  return meals.reduce((sum, meal) => {
    return sum + (dayMeals[meal.id] === 'eaten' ? meal.protein : 0);
  }, 0);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function currentMealWindow(now = new Date(), isoDate = null) {
  const meals  = isoDate ? mealsForDay(isoDate) : MEALS;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return meals.find(meal =>
    nowMin >= timeToMinutes(meal.windowStart) &&
    nowMin <= timeToMinutes(meal.windowEnd)
  ) || null;
}

export function mealById(id, isoDate = null) {
  const meals = isoDate ? mealsForDay(isoDate) : MEALS;
  return meals.find(m => m.id === id) || null;
}

export function verdictText(pct, familyCount, bites) {
  let verdict = '';
  if (pct >= 85)      verdict = 'Strong week. Keep going.';
  else if (pct >= 70) verdict = 'On the line. 80/20 holding.';
  else                verdict = 'Below target. Reset this week.';

  if (familyCount > 2) verdict += ' Family meals creeping up.';
  if (bites > 7) verdict += ` Bites averaging ${(bites / 7).toFixed(1)}/day — watch this.`;
  return verdict;
}

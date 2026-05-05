export const MEALS = [
  { id: 'pre-train', time: '05:00', name: 'Pre-train shake',            protein: 25, windowStart: '04:30', windowEnd: '05:30' },
  { id: 'breakfast', time: '07:00', name: 'Pa amb tomàquet + 4 eggs',   protein: 28, windowStart: '06:30', windowEnd: '07:30' },
  { id: 'lunch',     time: '13:30', name: 'Lunch — protein + carbs + veg', protein: 45, windowStart: '13:00', windowEnd: '14:00' },
  { id: 'afternoon-snack', time: '16:30', name: 'Afternoon snack — sardines or 3 eggs', protein: 17, windowStart: '16:00', windowEnd: '17:00' },
  { id: 'dinner',    time: '20:30', name: 'Yogurt bowl',                 protein: 40, windowStart: '20:00', windowEnd: '21:00' },
  { id: 'dessert',   time: '21:30', name: 'Dark chocolate + nuts',       protein: 4,  windowStart: '21:30', windowEnd: '22:30' },
];

export const PROTEIN_TARGET = 150;
export const KCAL_TARGET    = 2050;

export function computeProtein(dayMeals) {
  if (!dayMeals) return 0;
  return MEALS.reduce((sum, meal) => {
    return sum + (dayMeals[meal.id] === 'eaten' ? meal.protein : 0);
  }, 0);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function currentMealWindow(now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return MEALS.find(meal => {
    return nowMin >= timeToMinutes(meal.windowStart) &&
           nowMin <= timeToMinutes(meal.windowEnd);
  }) || null;
}

export function mealById(id) {
  return MEALS.find(m => m.id === id) || null;
}

export function verdictText(pct, familyCount, bites) {
  let verdict = '';
  if (pct >= 85) verdict = 'Strong week. Keep going.';
  else if (pct >= 70) verdict = 'On the line. 80/20 holding.';
  else verdict = 'Below target. Reset this week.';

  if (familyCount > 2) verdict += ' Family meals creeping up.';
  if (bites > 7) verdict += ` Bites averaging ${(bites / 7).toFixed(1)}/day — watch this.`;
  return verdict;
}

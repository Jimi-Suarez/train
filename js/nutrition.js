export const MEALS = [
  { id: 'shake',     time: '05:40', name: 'Pre-train shake + creatine',                             protein: 25, windowStart: '05:10', windowEnd: '06:10' },
  { id: 'breakfast', time: '07:00', name: '100g bread + tomato + 3 eggs',                           protein: 26, windowStart: '06:30', windowEnd: '07:30' },
  { id: 'lunch',     time: '13:30', name: '200g chicken + 160-180g potato/rice + 150-200g veg',     protein: 55, windowStart: '13:00', windowEnd: '14:00' },
  { id: 'snack',     time: '17:30', name: '2 eggs',                                                 protein: 12, windowStart: '17:00', windowEnd: '18:00' },
  { id: 'dinner',    time: '20:30', name: '1 yogurt + scoop whey + 30-50g berries + 25-30g nuts',   protein: 30, windowStart: '20:00', windowEnd: '21:00' },
  { id: 'dessert',   time: '21:30', name: 'Dark chocolate - 1-2 cubes',                             protein:  2, windowStart: '21:10', windowEnd: '22:10' },
];

export const PROTEIN_TARGET = 150;
export const KCAL_TARGET    = 1800;

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

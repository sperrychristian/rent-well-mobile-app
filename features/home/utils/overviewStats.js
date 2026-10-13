// pure numbers for the home screens' overview cards, worked out from lists already in memory (nothing is fetched)

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// "2026-10" for a date, the same YYYY-MM the expense dates start with
export function monthKey(date) {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1);
}

// the last `count` months ending with today's, oldest first, like ['2026-05', ..., '2026-10']
export function recentMonthKeys(today, count) {
  const keys = [];
  for (let back = count - 1; back >= 0; back--) {
    keys.push(monthKey(new Date(today.getFullYear(), today.getMonth() - back, 1)));
  }
  return keys;
}

// what was spent in each of those months, oldest first, so a sparkline can draw the trend
// every expense counts here (capital ones too), it's money out, not the tax deduction
export function monthlyTotals(expenses, today, count) {
  const keys = recentMonthKeys(today, count || 6);
  const totals = {};
  keys.forEach((key) => {
    totals[key] = 0;
  });
  (expenses || []).forEach((expense) => {
    const key = typeof expense.date === 'string' ? expense.date.slice(0, 7) : '';
    if (key in totals && Number.isFinite(expense.amount)) {
      totals[key] += expense.amount;
    }
  });
  return keys.map((key) => ({ month: key, total: Math.round(totals[key] * 100) / 100 }));
}

// this month against last month as a whole percent, null when last month had nothing to compare to
export function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

// a short month name for chart labels, 2026-10 gives Oct
const month_names = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function shortMonth(key) {
  const month = parseInt(String(key).slice(5, 7), 10);
  return month >= 1 && month <= 12 ? month_names[month - 1] : '';
}

import {
  monthKey,
  recentMonthKeys,
  monthlyTotals,
  percentChange,
  shortMonth,
} from './overviewStats';

const today = new Date(2026, 9, 12);

describe('month keys', () => {
  test('monthKey pads the month', () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe('2026-01');
    expect(monthKey(today)).toBe('2026-10');
  });

  test('recentMonthKeys counts back across a year boundary, oldest first', () => {
    expect(recentMonthKeys(new Date(2026, 1, 3), 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(recentMonthKeys(today, 1)).toEqual(['2026-10']);
  });
});

describe('monthlyTotals', () => {
  test('adds each month and leaves out older or broken expenses', () => {
    const expenses = [
      { date: '2026-10-01', amount: 100 },
      { date: '2026-10-11', amount: 25.5 },
      { date: '2026-09-30', amount: 40 },
      { date: '2025-01-01', amount: 999 },
      { date: '2026-10-02', amount: NaN },
      { date: null, amount: 10 },
    ];
    expect(monthlyTotals(expenses, today, 3)).toEqual([
      { month: '2026-08', total: 0 },
      { month: '2026-09', total: 40 },
      { month: '2026-10', total: 125.5 },
    ]);
  });

  test('defaults to six months and handles no expenses', () => {
    expect(monthlyTotals(null, today).length).toBe(6);
    expect(monthlyTotals([], today).every((row) => row.total === 0)).toBe(true);
  });
});

describe('percentChange', () => {
  test('whole percent up or down, null with nothing to compare to', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(NaN, 10)).toBeNull();
  });
});

describe('shortMonth', () => {
  test('three-letter month names', () => {
    expect(shortMonth('2026-10')).toBe('Oct');
    expect(shortMonth('2026-01')).toBe('Jan');
    expect(shortMonth('bad')).toBe('');
  });
});

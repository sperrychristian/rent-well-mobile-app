import { formatDate, todayString } from './formatDate';

describe('formatDate', () => {
  test('turns date text into a short month and day', () => {
    expect(formatDate('2026-10-05')).toBe('Oct 5');
    expect(formatDate('2026-01-31')).toBe('Jan 31');
    expect(formatDate('2026-12-01')).toBe('Dec 1');
  });

  test('ignores anything after the date', () => {
    expect(formatDate('2026-10-05T23:59:00')).toBe('Oct 5');
  });

  test('empty values give empty text', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('todayString', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('uses the local calendar day with zero padding', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 5, 9, 0));
    expect(todayString()).toBe('2026-01-05');
  });

  test('a late evening still counts as that local day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 8, 23, 59));
    expect(todayString()).toBe('2026-10-08');
  });
});

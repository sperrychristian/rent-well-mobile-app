import { stringToDate, dateToString } from '../dateInput';

describe('stringToDate', () => {
  test('makes a Date at local midnight on that day', () => {
    const date = stringToDate('2026-10-07');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(7);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });
});

describe('dateToString', () => {
  test('uses the local calendar day with zero padding', () => {
    expect(dateToString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateToString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('round trip', () => {
  test('date text survives going to a Date and back', () => {
    ['2026-10-07', '2026-01-01', '2026-12-31', '2028-02-29'].forEach((text) => {
      expect(dateToString(stringToDate(text))).toBe(text);
    });
  });
});

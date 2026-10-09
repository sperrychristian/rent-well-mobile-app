import { addPeriod } from '../recurring';

describe('addPeriod monthly', () => {
  test('moves to the same day next month', () => {
    expect(addPeriod('2026-03-15', 'Monthly')).toBe('2026-04-15');
  });

  test('rolls December into January of the next year', () => {
    expect(addPeriod('2026-12-10', 'Monthly')).toBe('2027-01-10');
  });

  test('a 31st lands on the last day of a short month', () => {
    expect(addPeriod('2026-01-31', 'Monthly', 31)).toBe('2026-02-28');
    expect(addPeriod('2028-01-31', 'Monthly', 31)).toBe('2028-02-29');
  });

  test('the anchor day brings it back to the 31st after a short month', () => {
    const february = addPeriod('2026-01-31', 'Monthly', 31);
    expect(addPeriod(february, 'Monthly', 31)).toBe('2026-03-31');
  });

  test('without an anchor it uses the day of the date it was given', () => {
    expect(addPeriod('2026-02-28', 'Monthly')).toBe('2026-03-28');
  });

  test('anything that is not Yearly counts as monthly', () => {
    expect(addPeriod('2026-05-01', 'Weekly')).toBe('2026-06-01');
  });
});

describe('addPeriod yearly', () => {
  test('moves to the same date next year', () => {
    expect(addPeriod('2026-10-08', 'Yearly')).toBe('2027-10-08');
  });

  test('February 29 lands on February 28 in a non-leap year', () => {
    expect(addPeriod('2028-02-29', 'Yearly', 29)).toBe('2029-02-28');
  });
});

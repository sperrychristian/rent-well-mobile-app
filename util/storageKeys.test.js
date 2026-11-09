import { storageKey } from './storageKeys';

describe('storageKey', () => {
  test('real mode adds the user id, no user keeps the original key', () => {
    expect(storageKey('rent_well_expenses', 'user-1')).toBe('rent_well_expenses_user-1');
    expect(storageKey('rent_well_expenses', null)).toBe('rent_well_expenses');
    expect(storageKey('rent_well_expenses', undefined)).toBe('rent_well_expenses');
  });
});

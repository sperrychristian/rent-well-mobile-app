import {
  formatCurrency,
  formatCurrencyShort,
  isNegativeAmount,
  minus_sign,
} from './formatCurrency';

describe('formatCurrency', () => {
  test('dollar sign, commas, and two decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(5)).toBe('$5.00');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(1234567.891)).toBe('$1,234,567.89');
  });

  test('negatives get a real minus sign before the dollar sign', () => {
    expect(formatCurrency(-12)).toBe(minus_sign + '$12.00');
    expect(formatCurrency(-1500.25)).toBe(minus_sign + '$1,500.25');
    expect(minus_sign).toBe('−');
  });

  test('a negative that rounds to zero shows as plain $0.00', () => {
    expect(formatCurrency(-0.004)).toBe('$0.00');
    expect(formatCurrency(-0)).toBe('$0.00');
  });

  test('signed adds a plus to positive amounts only', () => {
    expect(formatCurrency(40, { signed: true })).toBe('+$40.00');
    expect(formatCurrency(-40, { signed: true })).toBe(minus_sign + '$40.00');
    expect(formatCurrency(0, { signed: true })).toBe('$0.00');
  });

  test('cents false rounds to whole dollars', () => {
    expect(formatCurrency(1239.6, { cents: false })).toBe('$1,240');
    expect(formatCurrencyShort(999.4)).toBe('$999');
    expect(formatCurrencyShort(-2500)).toBe(minus_sign + '$2,500');
  });

  test('numeric strings work and anything else shows a dash', () => {
    expect(formatCurrency('250')).toBe('$250.00');
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
    expect(formatCurrency('abc')).toBe('—');
    expect(formatCurrency(Infinity)).toBe('—');
  });
});

describe('isNegativeAmount', () => {
  test('true only for amounts that show as negative', () => {
    expect(isNegativeAmount(-5)).toBe(true);
    expect(isNegativeAmount('-5')).toBe(true);
    expect(isNegativeAmount(5)).toBe(false);
    expect(isNegativeAmount(0)).toBe(false);
    expect(isNegativeAmount(-0.001)).toBe(false);
    expect(isNegativeAmount(null)).toBe(false);
  });
});

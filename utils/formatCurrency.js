// the one way money gets drawn on screen: a dollar sign, commas, two decimals, and a real minus sign
// (U+2212, wider than a hyphen so it lines up with the digits) in front of the dollar sign for negatives
// the CSV export and formatMoney stay as they were, saved files and other code read those
// options: signed (put a + in front of positive amounts, for changes like +$40.00), cents (false drops the .00)
export const minus_sign = '−';

export function formatCurrency(value, options) {
  const settings = options || {};
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    return '—';
  }
  const digits = settings.cents === false ? 0 : 2;
  // rounding first means -0.004 shows as $0.00 and not as a negative zero
  const rounded = Number(Math.abs(number).toFixed(digits));
  const is_negative = number < 0 && rounded !== 0;
  const body = rounded.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let sign = '';
  if (is_negative) {
    sign = minus_sign;
  } else if (settings.signed && rounded !== 0) {
    sign = '+';
  }
  return sign + '$' + body;
}

// true when an amount shows as negative, so a screen can color it
export function isNegativeAmount(value) {
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) && Number(Math.abs(number).toFixed(2)) !== 0 && number < 0;
}

// a whole-dollar version for big summary figures and chart labels, like $1,240
export function formatCurrencyShort(value) {
  return formatCurrency(value, { cents: false });
}

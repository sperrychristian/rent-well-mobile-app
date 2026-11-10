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

// ----- integer cents (the ledger) -----
// the payments ledger keeps money as whole cents (1200.00 dollars is 120000), so nothing ever adds floats
// these build the text with integer math only, then look exactly like formatCurrency

// true for a whole number of cents that's safe to add up
export function isCents(value) {
  return Number.isSafeInteger(value);
}

// 123456 into "$1,234.56", with the same minus sign, signed, and cents options as formatCurrency
export function formatCents(cents, options) {
  const settings = options || {};
  if (!isCents(cents)) {
    return '—';
  }
  const negative = cents < 0;
  const size = Math.abs(cents);
  const dollars = Math.floor(size / 100);
  const remainder = size % 100;
  // without cents it rounds half up to the nearest dollar, still in whole numbers
  const whole = settings.cents === false ? Math.floor((size + 50) / 100) : dollars;
  const dollars_text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body =
    settings.cents === false
      ? dollars_text
      : dollars_text + '.' + String(remainder).padStart(2, '0');
  const shows_zero = settings.cents === false ? whole === 0 : size === 0;
  let sign = '';
  if (negative && !shows_zero) {
    sign = minus_sign;
  } else if (settings.signed && !negative && !shows_zero) {
    sign = '+';
  }
  return sign + '$' + body;
}

// what someone typed ("1,200", "$45.5", "0.99") into whole cents, or null when it isn't a plain amount
// it never goes through a float: the dollars and the cents are read as two separate whole numbers
export function parseAmountToCents(text) {
  const cleaned = String(text === null || text === undefined ? '' : text)
    .trim()
    .replace(/^\$/, '')
    .replace(/,/g, '');
  const match = cleaned.match(/^(\d{1,9})(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/);
  if (!match) {
    return null;
  }
  const dollars = match[1] ? parseInt(match[1], 10) : 0;
  const cents_text = (match[2] !== undefined ? match[2] : match[3] || '').padEnd(2, '0');
  return dollars * 100 + parseInt(cents_text || '0', 10);
}

// cents back into the text a money box shows when it opens to edit, 120000 into "1200.00"
export function centsToInputText(cents) {
  if (!isCents(cents)) {
    return '';
  }
  const size = Math.abs(cents);
  return (
    (cents < 0 ? '-' : '') + Math.floor(size / 100) + '.' + String(size % 100).padStart(2, '0')
  );
}

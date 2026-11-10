import { parseAmountToCents } from '../../../util/formatCurrency';

// the rules for the work order form, kept pure so the form stays small and the rules get unit tested
// every check gives back { isValid, errorText }, errorText is '' when the value is fine

export const priority_options = ['Emergency', 'Normal', 'Low'];
export const title_min = 3;
export const title_max = 60;
export const description_min = 10;
export const description_max = 500;
export const estimate_max_dollars = 100000;
// these three match what the server takes (docs/API.md, POST /work-orders)
export const contractor_max = 120;
export const unit_max = 50;
export const name_max = 100;

const valid = { isValid: true, errorText: '' };

function invalid(errorText) {
  return { isValid: false, errorText: errorText };
}

function cleanText(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

export function validateTitle(value) {
  const title = cleanText(value);
  if (title === '') {
    return invalid('Add a title, like Kitchen faucet leaking.');
  }
  if (title.length < title_min) {
    return invalid('The title needs at least ' + title_min + ' characters.');
  }
  if (title.length > title_max) {
    return invalid('Keep the title to ' + title_max + ' characters or fewer.');
  }
  return valid;
}

export function validateDescription(value) {
  const description = cleanText(value);
  if (description === '') {
    return invalid('Describe the problem so it can get fixed.');
  }
  if (description.length < description_min) {
    return invalid(
      'Add a bit more detail, at least ' +
        description_min +
        ' characters (you have ' +
        description.length +
        ').',
    );
  }
  if (description.length > description_max) {
    return invalid('Keep the details to ' + description_max + ' characters or fewer.');
  }
  return valid;
}

export function validatePriority(value) {
  if (!priority_options.includes(value)) {
    return invalid('Pick how urgent it is.');
  }
  return valid;
}

// optional, so blank is fine, the server takes up to 120 characters
export function validateContractor(value) {
  if (cleanText(value).length > contractor_max) {
    return invalid('Keep the contractor to ' + contractor_max + ' characters or fewer.');
  }
  return valid;
}

// optional dollars, at most two decimals, from $0 to $100,000, read as whole cents so no float math
export function validateEstimate(value) {
  const text = cleanText(value);
  if (text === '') {
    return valid;
  }
  if (text.indexOf('-') !== -1) {
    return invalid('The estimate has to be from $0 to $100,000.');
  }
  if (/\.\d{3,}$/.test(text)) {
    return invalid('Use at most two decimal places, like 249.99.');
  }
  const cents = parseAmountToCents(text);
  if (cents === null) {
    return invalid('Type the estimate as a dollar amount, like 250 or 249.99.');
  }
  if (cents > estimate_max_dollars * 100) {
    return invalid('The estimate has to be from $0 to $100,000.');
  }
  return valid;
}

// the estimate text as whole cents, or null when it's blank (only call it after validateEstimate passed)
export function estimateToCents(value) {
  const text = cleanText(value);
  return text === '' ? null : parseAmountToCents(text);
}

// true when 2026-02-30 style text is a day that really exists on the calendar
export function isRealDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  // day 0 of the next month is the last day of this one, all in whole numbers with no time zone
  const days_in_month = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days_in_month;
}

// the same day one year later, Feb 29 lands on Feb 28 when the next year has no leap day
export function oneYearFrom(today) {
  const year = Number(today.slice(0, 4)) + 1;
  const month = today.slice(5, 7);
  let day = Number(today.slice(8, 10));
  const days_in_month = new Date(Date.UTC(year, Number(month), 0)).getUTCDate();
  if (day > days_in_month) {
    day = days_in_month;
  }
  return year + '-' + month + '-' + String(day).padStart(2, '0');
}

// optional preferred date: real YYYY-MM-DD, not before today when creating, and no more than a year out
// the dates are plain text, so comparing them as strings works and nothing gets shifted by a time zone
export function validateDate(value, options) {
  const settings = options || {};
  const text = cleanText(value);
  if (text === '') {
    return valid;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return invalid('Use the format YYYY-MM-DD, like 2026-11-20.');
  }
  if (!isRealDate(text)) {
    return invalid("That date doesn't exist, check the month and day.");
  }
  if (!settings.isEditing && text < settings.today) {
    return invalid('Pick today or a later date.');
  }
  if (text > oneYearFrom(settings.today)) {
    return invalid('Pick a date within one year from today.');
  }
  return valid;
}

// the place fields, worded like the alerts this screen used to show
export function validateTenantName(value) {
  const name = cleanText(value);
  if (name === '') {
    return invalid("Add the tenant's name.");
  }
  if (name.length > name_max) {
    return invalid('Keep the name to ' + name_max + ' characters or fewer.');
  }
  return valid;
}

export function validatePropertyText(value) {
  if (cleanText(value) === '') {
    return invalid('Pick the property or type it in.');
  }
  return valid;
}

export function validatePropertyId(value) {
  if (!value) {
    return invalid('Choose which property this work order is for.');
  }
  return valid;
}

export function validateUnit(value) {
  if (cleanText(value).length > unit_max) {
    return invalid('Keep the unit to ' + unit_max + ' characters or fewer.');
  }
  return valid;
}

const checks_by_field = {
  title: (value) => validateTitle(value),
  description: (value) => validateDescription(value),
  priority: (value) => validatePriority(value),
  contractor: (value) => validateContractor(value),
  estimate: (value) => validateEstimate(value),
  date: (value, options) => validateDate(value, options),
  tenantName: (value) => validateTenantName(value),
  property: (value) => validatePropertyText(value),
  propertyId: (value) => validatePropertyId(value),
  unit: (value) => validateUnit(value),
};

// checks every field the form is showing and can change, values is { title: 'text', ... }
// options: checked (the field names to check), isEditing, today (YYYY-MM-DD)
// fields that aren't checked always come back valid, so a hidden or read-only field never blocks a save
export function validateWorkOrder(values, options) {
  const settings = options || {};
  const checked = settings.checked || [];
  const result = { isValid: true };
  Object.keys(checks_by_field).forEach((field) => {
    result[field] = checked.includes(field)
      ? checks_by_field[field](values[field], settings)
      : valid;
    if (!result[field].isValid) {
      result.isValid = false;
    }
  });
  return result;
}

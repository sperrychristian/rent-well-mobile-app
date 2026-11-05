import {
  validateTitle,
  validateDescription,
  validatePriority,
  validateContractor,
  validateEstimate,
  estimateToCents,
  validateDate,
  isRealDate,
  oneYearFrom,
  validateTenantName,
  validatePropertyText,
  validatePropertyId,
  validateUnit,
  validateWorkOrder,
  title_max,
  description_max,
} from './workOrderValidation';

// every rule of the work order form, with the edges right on the limits

const ok = { isValid: true, errorText: '' };

describe('title', () => {
  test('is required, trimmed, and 3 to 60 characters', () => {
    expect(validateTitle('')).toEqual({
      isValid: false,
      errorText: 'Add a title, like Kitchen faucet leaking.',
    });
    expect(validateTitle('   ').isValid).toBe(false);
    expect(validateTitle(undefined).isValid).toBe(false);
    expect(validateTitle('ab')).toEqual({
      isValid: false,
      errorText: 'The title needs at least 3 characters.',
    });
    // spaces around it don't count toward the length
    expect(validateTitle('  ab  ').isValid).toBe(false);
    expect(validateTitle('abc')).toEqual(ok);
    expect(validateTitle('a'.repeat(title_max))).toEqual(ok);
    expect(validateTitle('a'.repeat(title_max + 1))).toEqual({
      isValid: false,
      errorText: 'Keep the title to 60 characters or fewer.',
    });
    expect(validateTitle('  ' + 'a'.repeat(title_max) + '  ')).toEqual(ok);
  });
});

describe('description', () => {
  test('is required, trimmed, and 10 to 500 characters', () => {
    expect(validateDescription('')).toEqual({
      isValid: false,
      errorText: 'Describe the problem so it can get fixed.',
    });
    expect(validateDescription('Too short')).toEqual({
      isValid: false,
      errorText: 'Add a bit more detail, at least 10 characters (you have 9).',
    });
    expect(validateDescription('   123456789   ').isValid).toBe(false);
    expect(validateDescription('1234567890')).toEqual(ok);
    expect(validateDescription('a'.repeat(description_max))).toEqual(ok);
    expect(validateDescription('a'.repeat(description_max + 1))).toEqual({
      isValid: false,
      errorText: 'Keep the details to 500 characters or fewer.',
    });
  });
});

describe('priority', () => {
  test('has to be one from the list', () => {
    expect(validatePriority('')).toEqual({ isValid: false, errorText: 'Pick how urgent it is.' });
    expect(validatePriority('Urgent').isValid).toBe(false);
    expect(validatePriority('normal').isValid).toBe(false);
    ['Emergency', 'Normal', 'Low'].forEach((value) => expect(validatePriority(value)).toEqual(ok));
  });
});

describe('contractor', () => {
  test('is optional and up to 120 characters', () => {
    expect(validateContractor('')).toEqual(ok);
    expect(validateContractor('a'.repeat(120))).toEqual(ok);
    expect(validateContractor('a'.repeat(121))).toEqual({
      isValid: false,
      errorText: 'Keep the contractor to 120 characters or fewer.',
    });
  });
});

describe('estimate', () => {
  test('is optional', () => {
    expect(validateEstimate('')).toEqual(ok);
    expect(validateEstimate('   ')).toEqual(ok);
    expect(estimateToCents('')).toBeNull();
  });

  test('takes 0 to 100,000 with up to two decimals, read as whole cents', () => {
    expect(validateEstimate('0')).toEqual(ok);
    expect(validateEstimate('250')).toEqual(ok);
    expect(validateEstimate('249.9')).toEqual(ok);
    expect(validateEstimate('249.99')).toEqual(ok);
    expect(validateEstimate('.5')).toEqual(ok);
    expect(validateEstimate('1,250.50')).toEqual(ok);
    expect(validateEstimate('100000')).toEqual(ok);
    expect(validateEstimate('100000.00')).toEqual(ok);
    expect(estimateToCents('249.99')).toBe(24999);
    expect(estimateToCents('0.1')).toBe(10);
    expect(estimateToCents(' 1,250.5 ')).toBe(125050);
  });

  test('turns away a third decimal, a range miss, and words', () => {
    expect(validateEstimate('249.999')).toEqual({
      isValid: false,
      errorText: 'Use at most two decimal places, like 249.99.',
    });
    expect(validateEstimate('100000.01')).toEqual({
      isValid: false,
      errorText: 'The estimate has to be from $0 to $100,000.',
    });
    expect(validateEstimate('-5').errorText).toBe('The estimate has to be from $0 to $100,000.');
    expect(validateEstimate('abc')).toEqual({
      isValid: false,
      errorText: 'Type the estimate as a dollar amount, like 250 or 249.99.',
    });
    expect(validateEstimate('1.2.3').isValid).toBe(false);
    expect(validateEstimate('12a').isValid).toBe(false);
  });
});

describe('dates', () => {
  const today = '2026-11-04';

  test('isRealDate knows the calendar, leap years included', () => {
    expect(isRealDate('2026-11-04')).toBe(true);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2026-04-31')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-00-10')).toBe(false);
    expect(isRealDate('2026-01-00')).toBe(false);
    expect(isRealDate('2026-1-5')).toBe(false);
  });

  test('oneYearFrom stays on the same day, and Feb 29 lands on Feb 28', () => {
    expect(oneYearFrom('2026-11-04')).toBe('2027-11-04');
    expect(oneYearFrom('2028-02-29')).toBe('2029-02-28');
    expect(oneYearFrom('2026-12-31')).toBe('2027-12-31');
  });

  test('blank is fine since the date is optional', () => {
    expect(validateDate('', { today })).toEqual(ok);
  });

  test('has to be YYYY-MM-DD and a real day', () => {
    const format = 'Use the format YYYY-MM-DD, like 2026-11-20.';
    expect(validateDate('11/20/2026', { today }).errorText).toBe(format);
    expect(validateDate('2026-11-2', { today }).errorText).toBe(format);
    expect(validateDate('20261120', { today }).errorText).toBe(format);
    expect(validateDate('2026-02-30', { today })).toEqual({
      isValid: false,
      errorText: "That date doesn't exist, check the month and day.",
    });
    expect(validateDate(' 2026-11-20 ', { today })).toEqual(ok);
  });

  test('not in the past when creating, and up to a year out', () => {
    expect(validateDate('2026-11-03', { today })).toEqual({
      isValid: false,
      errorText: 'Pick today or a later date.',
    });
    expect(validateDate('2026-11-04', { today })).toEqual(ok);
    expect(validateDate('2027-11-04', { today })).toEqual(ok);
    expect(validateDate('2027-11-05', { today })).toEqual({
      isValid: false,
      errorText: 'Pick a date within one year from today.',
    });
  });

  test('an edit can keep a date that has gone by, but not one over a year out', () => {
    expect(validateDate('2026-10-01', { today, isEditing: true })).toEqual(ok);
    expect(validateDate('2027-11-05', { today, isEditing: true }).isValid).toBe(false);
  });
});

describe('the place fields', () => {
  test('tenant name and property text are required, the unit is optional up to 50', () => {
    expect(validateTenantName('').errorText).toBe("Add the tenant's name.");
    expect(validateTenantName('Sam Rivera')).toEqual(ok);
    expect(validateTenantName('a'.repeat(101)).isValid).toBe(false);
    expect(validatePropertyText(' ').errorText).toBe('Pick the property or type it in.');
    expect(validatePropertyText('123 Maple St')).toEqual(ok);
    expect(validatePropertyId(null).errorText).toBe(
      'Choose which property this work order is for.',
    );
    expect(validatePropertyId('p-1')).toEqual(ok);
    expect(validateUnit('')).toEqual(ok);
    expect(validateUnit('a'.repeat(50))).toEqual(ok);
    expect(validateUnit('a'.repeat(51)).errorText).toBe('Keep the unit to 50 characters or fewer.');
  });
});

describe('validateWorkOrder', () => {
  const filled = {
    title: 'Porch light out',
    description: 'The bulb by the front door is out.',
    priority: 'Normal',
    contractor: '',
    estimate: '45.50',
    date: '2026-11-20',
  };

  test('only checks the fields the form is showing', () => {
    const result = validateWorkOrder(
      { title: '', description: '', priority: '' },
      { checked: ['priority'], today: '2026-11-04' },
    );
    expect(result.title).toEqual(ok);
    expect(result.description).toEqual(ok);
    expect(result.priority.isValid).toBe(false);
    expect(result.isValid).toBe(false);
  });

  test('a filled form passes, one bad field fails the whole thing', () => {
    const checked = ['title', 'description', 'priority', 'contractor', 'estimate', 'date'];
    expect(validateWorkOrder(filled, { checked, today: '2026-11-04' }).isValid).toBe(true);
    const bad = validateWorkOrder(
      { ...filled, estimate: '1.999' },
      { checked, today: '2026-11-04' },
    );
    expect(bad.isValid).toBe(false);
    expect(bad.estimate.isValid).toBe(false);
    expect(bad.title).toEqual(ok);
  });

  test('an empty form gives every checked field its own message', () => {
    const result = validateWorkOrder(
      {},
      {
        checked: ['title', 'description', 'priority', 'tenantName', 'property'],
        today: '2026-11-04',
      },
    );
    ['title', 'description', 'priority', 'tenantName', 'property'].forEach((field) => {
      expect(result[field].isValid).toBe(false);
      expect(result[field].errorText.length).toBeGreaterThan(5);
    });
  });
});

// starting numbers for mileage, budgets, and recurring expenses, saved data on the device wins once the app has run

// I set this by hand, it's not looked up, so check the current IRS standard mileage rate and change it in the app
export const default_mileage_rate = 0.7;

export const seed_trips = [
  {
    id: 'trip-1',
    date: '2026-09-03',
    property: '123 Maple St, Unit 2',
    miles: 14.5,
    purpose: 'Showed the unit to a prospective tenant',
  },
  {
    id: 'trip-2',
    date: '2026-09-18',
    property: '48 Cedar Ave',
    miles: 22,
    purpose: 'Walkthrough and lock check',
  },
  {
    id: 'trip-3',
    date: '2026-10-05',
    property: '123 Maple St, Unit 1',
    miles: 9.8,
    purpose: 'Met the plumber about the dishwasher',
  },
];

export const seed_budgets = {
  '123 Maple St, Unit 1': 3000,
  '48 Cedar Ave': 2500,
};

// next_date is in the future on purpose so this doesn't create an expense the moment the app opens
export const seed_recurring_rules = [
  {
    id: 'rule-1',
    frequency: 'Monthly',
    anchor_day: 1,
    next_date: '2026-11-01',
    active: true,
    template: {
      amount: 95,
      category: 'Utilities',
      property: '123 Maple St, Unit 3',
      vendor: 'City Water',
      payment_method: 'Bank transfer',
      is_capital: false,
      notes: 'Water and sewer',
      billed_to_tenant: false,
      recovered: 0,
    },
  },
];
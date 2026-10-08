// adds up the amounts in a list of expenses
export function sumAmounts(list) {
  return list.reduce((sum, expense) => sum + expense.amount, 0);
}

// adds up the miles in a list of trips
export function sumMiles(trips) {
  return trips.reduce((sum, trip) => sum + trip.miles, 0);
}

// total per category for deductible expenses only, biggest first, capital improvements are left out on purpose
export function totalsByCategory(list) {
  const totals = {};
  list
    .filter((expense) => !expense.is_capital)
    .forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });
  return Object.keys(totals)
    .map((category) => ({ category: category, total: totals[category] }))
    .sort((a, b) => b.total - a.total);
}

// total per property for everything, capital improvements included, biggest first
export function totalsByProperty(list) {
  const totals = {};
  list.forEach((expense) => {
    totals[expense.property] = (totals[expense.property] || 0) + expense.amount;
  });
  return Object.keys(totals)
    .map((property) => ({ property: property, total: totals[property] }))
    .sort((a, b) => b.total - a.total);
}

// total paid per vendor, expenses with no vendor typed in are skipped
export function totalsByVendor(list) {
  const totals = {};
  list
    .filter((expense) => expense.vendor)
    .forEach((expense) => {
      totals[expense.vendor] = (totals[expense.vendor] || 0) + expense.amount;
    });
  return Object.keys(totals)
    .map((vendor) => ({ vendor: vendor, total: totals[vendor] }))
    .sort((a, b) => b.total - a.total);
}

// what was charged to tenants and how much of it came back, both are just information and don't change the deductible totals
export function sumBilled(list) {
  return sumAmounts(list.filter((expense) => expense.billed_to_tenant));
}

export function sumRecovered(list) {
  return list.reduce((sum, expense) => sum + (expense.recovered || 0), 0);
}

// splits a total into equal parts in whole cents, the first parts get the leftover pennies so the parts add back up exactly
export function splitAmount(total, parts) {
  const total_cents = Math.round(total * 100);
  const base_cents = Math.floor(total_cents / parts);
  const leftover_cents = total_cents - base_cents * parts;
  const result = [];
  for (let index = 0; index < parts; index++) {
    result.push((base_cents + (index < leftover_cents ? 1 : 0)) / 100);
  }
  return result;
}

// $1,240.00 style money text
export function formatMoney(value) {
  return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// everything the year-end report and its export need, worked out once from the saved data
export function buildYearEndData(year, expenses, trips, mileage_rate) {
  const year_expenses = expenses.filter((expense) => expense.date.slice(0, 4) === year);
  const year_trips = trips.filter((trip) => trip.date.slice(0, 4) === year);

  const names = [
    ...new Set([
      ...year_expenses.map((expense) => expense.property),
      ...year_trips.map((trip) => trip.property),
    ]),
  ]
    .filter(Boolean)
    .sort();

  const per_property = names.map((name) => {
    const property_expenses = year_expenses.filter((expense) => expense.property === name);
    const miles = sumMiles(year_trips.filter((trip) => trip.property === name));
    return {
      property: name,
      categories: totalsByCategory(property_expenses),
      deductible: sumAmounts(property_expenses.filter((expense) => !expense.is_capital)),
      capital: sumAmounts(property_expenses.filter((expense) => expense.is_capital)),
      miles: miles,
      mileage_deduction: miles * mileage_rate,
    };
  });

  const total_miles = sumMiles(year_trips);

  return {
    per_property: per_property,
    deductible: sumAmounts(year_expenses.filter((expense) => !expense.is_capital)),
    capital: sumAmounts(year_expenses.filter((expense) => expense.is_capital)),
    miles: total_miles,
    mileage_deduction: total_miles * mileage_rate,
    expense_count: year_expenses.length,
    with_receipts: year_expenses.filter((expense) => (expense.receipts || []).length > 0).length,
    missing_receipts: year_expenses.filter((expense) => (expense.receipts || []).length === 0),
    vendors: totalsByVendor(year_expenses),
  };
}
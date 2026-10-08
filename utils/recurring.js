// moves a date forward by one month or one year, and the anchor day keeps a 31st from drifting to the 28th for good
export function addPeriod(date_string, frequency, anchor_day) {
  const parts = date_string.split('-').map(Number);
  const year = parts[0];
  const month_index = parts[1] - 1;
  const months_to_add = frequency === 'Yearly' ? 12 : 1;
  const total_months = year * 12 + month_index + months_to_add;
  const new_year = Math.floor(total_months / 12);
  const new_month_index = total_months % 12;
  // day 0 of the next month is the last day of this one, which tells me how many days the new month has
  const days_in_month = new Date(new_year, new_month_index + 1, 0).getDate();
  const new_day = Math.min(anchor_day || parts[2], days_in_month);
  return (
    new_year +
    '-' +
    String(new_month_index + 1).padStart(2, '0') +
    '-' +
    String(new_day).padStart(2, '0')
  );
}
// turns 2026-10-07 into a Date at local midnight for the date picker
export function stringToDate(date_string) {
  const parts = date_string.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// turns a Date from the picker back into 2026-10-07 using the local calendar day
export function dateToString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}
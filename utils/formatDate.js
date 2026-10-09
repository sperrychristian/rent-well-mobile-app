const month_names = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// turns 2026-10-05 into Oct 5 so the cards stay short
export function formatDate(date_string) {
  if (!date_string) {
    return '';
  }
  const parts = date_string.slice(0, 10).split('-');
  const month_index = parseInt(parts[1], 10) - 1;
  const day_number = parseInt(parts[2], 10);
  return month_names[month_index] + ' ' + day_number;
}

// I build today's date from the local clock so an evening change doesn't land on tomorrow
export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

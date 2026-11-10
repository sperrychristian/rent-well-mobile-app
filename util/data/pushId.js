// Firebase-style push ids made on the phone, so a multi-path write can create a record and point at it in one step
// the first 8 characters are the time, so ids made later sort after earlier ones (messages read in order)
// the other 12 are random, and if two come in the same millisecond the random part counts up so they still sort

const push_chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let last_time = 0;
let last_random = [];

export function generatePushId(now) {
  let time = now === undefined ? Date.now() : now;
  const same_time = time === last_time;
  last_time = time;
  const time_chars = new Array(8);
  for (let index = 7; index >= 0; index--) {
    time_chars[index] = push_chars.charAt(time % 64);
    time = Math.floor(time / 64);
  }
  if (!same_time || last_random.length !== 12) {
    last_random = [];
    for (let index = 0; index < 12; index++) {
      last_random.push(Math.floor(Math.random() * 64));
    }
  } else {
    // same millisecond: add one to the random part, carrying like an odometer
    let index = 11;
    while (index >= 0 && last_random[index] === 63) {
      last_random[index] = 0;
      index--;
    }
    if (index >= 0) {
      last_random[index]++;
    }
  }
  return time_chars.join('') + last_random.map((value) => push_chars.charAt(value)).join('');
}

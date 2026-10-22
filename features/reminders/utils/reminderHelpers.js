import { parseApiError } from '../../../services/apiHelpers';
import { formatCents } from '../../../utils/formatCurrency';
import { deriveLedger } from '../../payments/utils/ledgerMath';

// rent reminders: the suggested text, who owes what, and the one-a-day rule, a port of the server's
// src/reminders/rentReminders.js so the demo writes the same words the server would (docs/API.md, Rent reminders)

export const reminder_kinds = ['friendly', 'overdue_notice'];
export const max_reminder_length = 600;
// one reminder per tenancy per 24 hours of elapsed time, not calendar days
export const reminder_cooldown_ms = 24 * 60 * 60 * 1000;

const long_months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// "October 1" from a calendar date, no time zone shift
export function formatLongDate(date_text) {
  return long_months[Number(date_text.slice(5, 7)) - 1] + ' ' + Number(date_text.slice(8, 10));
}

export function firstName(full_name) {
  return (full_name || '').trim().split(/\s+/)[0] || 'there';
}

function truncate(text, max_length) {
  return text.length > max_length ? text.slice(0, max_length - 1).trimEnd() + '…' : text;
}

// the suggested text: friendly is warm, overdue_notice is firm but polite, always 600 characters or less,
// and long payment instructions are the part that gets shortened, never the amount or the date
export function buildReminderText(fields) {
  const name = firstName(fields.tenant_name);
  const amount = formatCents(fields.amount_cents);
  const due = formatLongDate(fields.due_on);
  const place = fields.unit_label
    ? fields.property_name + ', ' + fields.unit_label
    : fields.property_name;
  const opening =
    fields.kind === 'friendly'
      ? 'Hi ' +
        name +
        ', just a friendly reminder that your balance of ' +
        amount +
        ' for ' +
        place +
        ' was due ' +
        due +
        '.'
      : 'Hi ' +
        name +
        ', your balance of ' +
        amount +
        ' for ' +
        place +
        ' is past due. It was due ' +
        due +
        '. Please send payment as soon as possible.';
  const closing =
    fields.kind === 'friendly'
      ? 'If you have already sent it, you can mark it paid in the app. Thanks so much!'
      : 'If you have already paid, please mark it paid in the app so I can confirm it. Thank you.';
  const trimmed = (fields.payment_instructions || '').trim();
  const instructions = trimmed && !/[.!?]$/.test(trimmed) ? trimmed + '.' : trimmed;
  if (!instructions) {
    return truncate(
      opening + ' You can pay the way you usually do. ' + closing,
      max_reminder_length,
    );
  }
  const prefix = opening + ' How to pay: ';
  const suffix = ' ' + closing;
  const room = max_reminder_length - prefix.length - suffix.length;
  return (prefix + truncate(instructions, Math.max(room, 20)) + suffix).slice(
    0,
    max_reminder_length,
  );
}

// what a reminder is about as of today: the rent balance plus any deposit owed by today, and the oldest
// unpaid charge due by today (its date goes in the text), or null when nothing is owed
export function reminderTarget(ledger, today) {
  const derived = deriveLedger(ledger, today);
  const owed_by_today = derived.charges
    .filter(
      (charge) =>
        charge.status !== 'voided' && charge.remaining_cents > 0 && charge.due_date <= today,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const deposit_owed_cents = owed_by_today
    .filter((charge) => charge.kind === 'deposit')
    .reduce((sum, charge) => sum + charge.remaining_cents, 0);
  const amount_cents = derived.balance_cents + deposit_owed_cents;
  if (amount_cents <= 0 || owed_by_today.length === 0) {
    return null;
  }
  return { amount_cents: amount_cents, charge: owed_by_today[0] };
}

// can another one go now? last_sent_at is an ISO time or null
export function reminderWindow(last_sent_at, now) {
  if (!last_sent_at) {
    return { can_send: true, can_send_at: null };
  }
  const can_send_at = new Date(Date.parse(last_sent_at) + reminder_cooldown_ms);
  const can_send = now.getTime() >= can_send_at.getTime();
  return { can_send: can_send, can_send_at: can_send ? null : can_send_at.toISOString() };
}

// "Oct 20" for the last-sent line, and "Oct 23, 4:04 PM" for when the next one can go
export function shortSentDate(iso) {
  const date = new Date(iso);
  return long_months[date.getMonth()].slice(0, 3) + ' ' + date.getDate();
}

export function canSendLine(iso) {
  const date = new Date(iso);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const time = (hours % 12 || 12) + ':' + minutes + (hours < 12 ? ' AM' : ' PM');
  return 'You can send the next one ' + shortSentDate(iso) + ' at ' + time + '.';
}

// ----- the api shapes -----

export function fromApiPreview(api_preview) {
  return {
    kind: api_preview.kind,
    message_text: api_preview.messageText || '',
    amount_cents: api_preview.amountCents,
    charge_id: api_preview.chargeId || null,
    due_on: api_preview.dueOn || null,
    last_reminder_at: api_preview.lastReminderAt || null,
    can_send_now: api_preview.canSendNow !== false,
    can_send_at: api_preview.canSendAt || null,
  };
}

// ----- the demo's version of the routes, with the server's rules and error codes -----

function demoError(status, code, info) {
  const error = parseApiError(status, { error: { code: code, message: code } });
  if (info) {
    error.info = info;
  }
  return error;
}

// sent is the demo's reminder log for this tenancy, newest last: [{ sent_at, kind, amount_cents }]
export function demoPreview(ledger, sent, kind, instructions, now, today) {
  if (!ledger) {
    throw demoError(404, 'NOT_FOUND');
  }
  if (ledger.tenancy_status === 'ended') {
    throw demoError(409, 'NO_ACTIVE_TENANCY');
  }
  const target = reminderTarget(ledger, today);
  if (!target) {
    throw demoError(409, 'NOTHING_OWED');
  }
  const last = sent && sent.length > 0 ? sent[sent.length - 1].sent_at : null;
  const window = reminderWindow(last, now);
  return {
    kind: kind,
    message_text: buildReminderText({
      kind: kind,
      tenant_name: ledger.tenant_name,
      amount_cents: target.amount_cents,
      due_on: target.charge.due_date,
      payment_instructions: instructions,
      property_name: ledger.property_name,
      unit_label: ledger.unit_label,
    }),
    amount_cents: target.amount_cents,
    charge_id: target.charge.id,
    due_on: target.charge.due_date,
    last_reminder_at: last,
    can_send_now: window.can_send,
    can_send_at: window.can_send_at,
  };
}

// checks a send the way POST /tenancies/:id/reminders does, and gives back the log entry and the message text
export function demoSend(ledger, sent, kind, message, instructions, now, today) {
  if (!reminder_kinds.includes(kind)) {
    throw demoError(400, 'VALIDATION_ERROR');
  }
  const preview = demoPreview(ledger, sent, kind, instructions, now, today);
  if (!preview.can_send_now) {
    throw demoError(429, 'REMINDER_TOO_SOON', { canSendAt: preview.can_send_at });
  }
  const text = (message === undefined || message === null ? preview.message_text : message).trim();
  if (text.length < 1 || text.length > max_reminder_length) {
    throw demoError(400, 'VALIDATION_ERROR');
  }
  return {
    entry: {
      sent_at: now.toISOString(),
      kind: kind,
      amount_cents: preview.amount_cents,
      charge_id: preview.charge_id,
    },
    message_text: text,
  };
}

// a message is a rent reminder when the server (or the demo) tagged it that way
export function isRentReminder(message) {
  return !!(message && message.metadata && message.metadata.type === 'rent_reminder');
}

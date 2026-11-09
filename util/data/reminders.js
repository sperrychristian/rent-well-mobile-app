// reminders/{reminderId}: every rent reminder a landlord sent, the 24 hour rule reads the newest one
// the reminder text, the target charge, and the 24 hour window are the app's own rules (reminderHelpers.js),
// sending also posts the message in the tenant's conversation (util/data/messages.js)
import { getNode, putNode } from '../http';
import { recordsToList } from './records';

export function reminderId(tenancy_id, sent_at) {
  return tenancy_id + '_' + String(sent_at || '').replace(/[.:]/g, '-');
}

// one tenancy's log, oldest first, in the shape the reminder rules read
export async function getReminderLog(tenancy_id) {
  return recordsToList(await getNode('reminders'))
    .filter((record) => record.tenancyId === tenancy_id)
    .sort((a, b) => (a.sentAt || '').localeCompare(b.sentAt || ''))
    .map((record) => ({
      id: record.id,
      sent_at: record.sentAt,
      kind: record.kind,
      amount_cents: record.amountCents || 0,
      charge_id: record.chargeId || null,
    }));
}

// entry comes from demoSend: { sent_at, kind, amount_cents, charge_id }
export async function saveReminder(owner_id, tenancy_id, entry, message_text) {
  const id = reminderId(tenancy_id, entry.sent_at);
  await putNode('reminders/' + id, {
    id: id,
    ownerId: owner_id,
    tenancyId: tenancy_id,
    kind: entry.kind,
    amountCents: entry.amount_cents || 0,
    chargeId: entry.charge_id || null,
    message: message_text,
    sentAt: entry.sent_at,
  });
  return id;
}

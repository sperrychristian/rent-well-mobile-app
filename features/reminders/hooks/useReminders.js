import { useLocalWorkOrders } from '../../../store/WorkOrdersContext';
import { useTenants } from '../../../store/TenantsContext';
import { useLedger } from '../../../store/LedgerContext';
import { useMessages } from '../../../store/MessagesContext';
import {
  getReminderLog,
  saveReminder,
  sendMessage as sendMessageRequest,
  sessionUser,
} from '../../../util/http';
import { demoPreview, demoSend } from '../utils/reminderHelpers';

// rent reminders for the landlord, the same two calls in both modes:
// preview (the suggested text, the amount, and whether one can go now) and send (posts it in the chat)
// the demo keeps its own log of what was sent in the demo tenant data, so both demo sides see the same
// 24 hour limit, and it's gone when the demo ends, like everything else in the demo
export function useReminders() {
  const local = useLocalWorkOrders();
  const tenants = useTenants();
  const ledger_store = useLedger();
  const messages = useMessages();
  const is_demo = tenants.is_demo;

  function demoLog(tenancy_id) {
    const data = local.demo_tenant_data;
    return (data && data.reminders && data.reminders[tenancy_id]) || [];
  }

  function demoInputs(tenancy_id) {
    const ledger = ledger_store.getLedger(tenancy_id);
    const instructions = ledger ? ledger_store.instructionsFor(ledger.property_id) : '';
    return { ledger, instructions: instructions || '' };
  }

  async function preview(tenancy_id, kind) {
    if (is_demo) {
      const inputs = demoInputs(tenancy_id);
      return demoPreview(
        inputs.ledger,
        demoLog(tenancy_id),
        kind,
        inputs.instructions,
        new Date(),
        ledger_store.today,
      );
    }
    // Firebase: the same rules on the saved log, there's no server to ask anymore
    const inputs = demoInputs(tenancy_id);
    return demoPreview(
      inputs.ledger,
      await getReminderLog(tenancy_id),
      kind,
      inputs.instructions,
      new Date(),
      ledger_store.today,
    );
  }

  // message is the landlord's edited text, gives back when it went out
  async function send(tenancy_id, kind, message) {
    if (is_demo) {
      const inputs = demoInputs(tenancy_id);
      const result = demoSend(
        inputs.ledger,
        demoLog(tenancy_id),
        kind,
        message,
        inputs.instructions,
        new Date(),
        ledger_store.today,
      );
      local.setDemoTenantData((data) => ({
        ...data,
        reminders: {
          ...(data.reminders || {}),
          [tenancy_id]: [...((data.reminders && data.reminders[tenancy_id]) || []), result.entry],
        },
      }));
      // it lands in the chat with this tenant, the same thread both demo sides read
      const found = tenants.findTenancy(tenancy_id);
      if (found && found.tenant.conversation_id) {
        messages.addReminderMessage(found.tenant.conversation_id, result.message_text, {
          type: 'rent_reminder',
          tenancyId: tenancy_id,
          chargeId: result.entry.charge_id,
        });
      }
      return { sent_at: result.entry.sent_at };
    }
    // Firebase: check it with the same rules, post it in the tenant's conversation, then save it in the log
    const inputs = demoInputs(tenancy_id);
    const result = demoSend(
      inputs.ledger,
      await getReminderLog(tenancy_id),
      kind,
      message,
      inputs.instructions,
      new Date(),
      ledger_store.today,
    );
    const found = tenants.findTenancy(tenancy_id);
    const me = sessionUser();
    if (found && found.tenant.conversation_id && me) {
      const sent = await sendMessageRequest(
        found.tenant.conversation_id,
        me.id,
        result.message_text,
        {
          type: 'rent_reminder',
          tenancyId: tenancy_id,
          chargeId: result.entry.charge_id,
        },
      );
      messages.addReminderMessage(found.tenant.conversation_id, null, null, sent);
    }
    await saveReminder(me ? me.id : null, tenancy_id, result.entry, result.message_text);
    return { sent_at: result.entry.sent_at };
  }

  return { preview, send };
}

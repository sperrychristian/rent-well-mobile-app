// the seed for the Firebase database, built from the same sample data the demo uses,
// so the demo and the database tell the same story (Taylor Brooks and the tenants at 123 Maple St and 48 Cedar Ave)
// pure: buildSeedData(now) gives back the whole tree, the seed script writes it and the tests check it
// every record goes through the same toDb functions the app saves with, so the app reads it back the same way
import { buildSampleTenantData } from '../features/tenants/data/sampleTenants';
import {
  buildSampleLedgers,
  buildSampleInstructions,
} from '../features/payments/data/sampleLedger';
import { buildSampleThreads, demo_landlord } from '../features/messages/data/sampleThreads';
import { work_orders } from '../data/workOrders';
import { seed_expenses } from '../data/expenses';
import { seed_trips, seed_budgets, default_mileage_rate } from '../data/expenseExtras';
import { seed_documents } from '../data/documents';
import { sample_checklists } from '../features/checklist/data/sampleChecklists';
import { toApiExpense } from '../features/expenses/utils/expenseApi';
import { tenant_data_mappers } from '../util/data/tenants';
import { leaseToDb } from '../util/data/leases';
import { chargeToDb, paymentToDb, scheduleToDb } from '../util/data/ledger';
import { toDbTrip } from '../util/data/mileage';
import { toDbDocument } from '../util/data/documents';
import { toDbChecklist } from '../util/data/checklists';
import { budgetsToDb } from '../util/data/settings';
import { reminderId } from '../util/data/reminders';
import { cleanRecord } from '../util/data/records';
import { generatePushId } from '../util/data/pushId';

export const seed_owner_id = 'owner-taylor';
// a second landlord with nothing yet, for trying every empty screen
export const empty_owner_id = 'owner-jamie';

// the demo ids start with demo-, the database ones read better without it
function seedId(demo_id) {
  if (demo_id === demo_landlord.id) {
    return seed_owner_id;
  }
  return String(demo_id).replace(/^demo-/, '');
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgoIso(now, days) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

export function buildSeedData(now_input) {
  const now = now_input || new Date();
  const now_iso = now.toISOString();
  const today = dateOnly(now);
  const owner_id = seed_owner_id;
  const tree = {
    users: {},
    properties: {},
    tenancies: {},
    leases: {},
    leaseEvents: {},
    invites: {},
    workOrders: {},
    expenses: {},
    mileage: {},
    ownerSettings: {},
    rentSchedules: {},
    charges: {},
    payments: {},
    conversations: {},
    messages: {},
    reminders: {},
    checklists: {},
    documents: {},
  };

  // ----- people -----
  tree.users[owner_id] = {
    id: owner_id,
    role: 'owner',
    name: demo_landlord.name,
    email: 'taylor@example.com',
    createdAt: daysAgoIso(now, 900),
    updatedAt: daysAgoIso(now, 900),
  };
  tree.users[empty_owner_id] = {
    id: empty_owner_id,
    role: 'owner',
    name: 'Jamie Ortiz',
    email: 'jamie@example.com',
    createdAt: daysAgoIso(now, 10),
    updatedAt: daysAgoIso(now, 10),
  };

  // ----- properties, tenants, tenancies, leases, invites (the demo's tenant data) -----
  const demo = buildSampleTenantData();
  // Riley shares Unit 2 with Sam, so the seed has a roommate (two active tenancies on one unit)
  demo.tenants.push({
    id: 'demo-tenant-riley',
    name: 'Riley Park',
    email: 'riley@example.com',
    conversation_id: null,
  });
  demo.tenancies.push({
    id: 'demo-tenancy-riley',
    tenant_id: 'demo-tenant-riley',
    property_id: 'demo-prop-maple',
    unit_label: 'Unit 2',
    status: 'active',
    started_at: daysAgoIso(now, 200),
    ended_at: null,
    move_out_note: '',
    lease: null,
  });
  // an invite that ran out, next to the demo's pending one
  demo.invites.push({
    id: 'demo-invite-2',
    code: 'H4TR8WZN',
    propertyId: 'demo-prop-cedar',
    unitLabel: null,
    tenantName: 'Drew Kim',
    status: 'pending',
    expiresAt: daysAgoIso(now, 3),
    usedAt: null,
    revokedAt: null,
    createdAt: daysAgoIso(now, 17),
  });
  const data = JSON.parse(JSON.stringify(demo).replace(/demo-/g, ''));
  const instructions = buildSampleInstructions();
  data.properties.forEach((property) => {
    tree.properties[property.id] = cleanRecord({
      ...tenant_data_mappers.propertyToDb(
        { ...property, payment_instructions: instructions['demo-' + property.id] },
        owner_id,
      ),
      createdAt: daysAgoIso(now, 900),
      updatedAt: daysAgoIso(now, 30),
    });
  });
  data.tenants.forEach((tenant) => {
    tree.users[tenant.id] = {
      id: tenant.id,
      role: 'tenant',
      name: tenant.name,
      email: tenant.email,
      ownerId: owner_id,
      createdAt: daysAgoIso(now, 400),
      updatedAt: daysAgoIso(now, 400),
    };
  });
  data.tenancies.forEach((tenancy) => {
    tree.tenancies[tenancy.id] = cleanRecord({
      ...tenant_data_mappers.tenancyToDb(tenancy, owner_id, data),
      createdAt: tenancy.started_at,
      updatedAt: tenancy.ended_at ? tenancy.ended_at + 'T12:00:00.000Z' : tenancy.started_at,
    });
    if (tenancy.lease) {
      tree.leases[tenancy.id] = cleanRecord({
        ...leaseToDb(tenancy.lease, tenancy.id, owner_id),
        updatedAt: tenancy.started_at,
      });
    }
  });
  Object.keys(data.lease_events).forEach((tenancy_id) => {
    tree.leaseEvents[tenancy_id] = {};
    data.lease_events[tenancy_id].forEach((event) => {
      tree.leaseEvents[tenancy_id][event.id] = event;
    });
  });
  data.invites.forEach((invite) => {
    tree.invites[invite.id] = cleanRecord(tenant_data_mappers.inviteToDb(invite, owner_id, data));
  });

  // ----- the rent ledger: schedules, charges (with this month's rent and late fees), payments -----
  const ledgers = buildSampleLedgers(today);
  ledgers.forEach((demo_ledger) => {
    // every id loses its demo- (the rent ids have the tenancy id inside, like rent-tenancy-sam-2026-11)
    const ledger = JSON.parse(JSON.stringify(demo_ledger).replace(/demo-/g, ''));
    const context = {
      ...ledger,
      tenancy_id: seedId(demo_ledger.tenancy_id),
      tenant_id: seedId(demo_ledger.tenant_id),
      owner_id: owner_id,
    };
    if (ledger.schedule) {
      tree.rentSchedules[context.tenancy_id] = {
        ...scheduleToDb(ledger.schedule, context),
        updatedAt: ledger.schedule.start_date + 'T12:00:00.000Z',
      };
    }
    ledger.charges.forEach((charge) => {
      tree.charges[charge.id] = chargeToDb(charge, context);
    });
    ledger.payments.forEach((payment) => {
      tree.payments[payment.id] = paymentToDb(payment, context);
    });
  });

  // ----- work orders, linked to the property, the tenant, and the tenancy by name -----
  const tenancy_by_name = {};
  data.tenancies
    .filter((tenancy) => tenancy.status === 'active')
    .forEach((tenancy) => {
      const tenant = data.tenants.find((item) => item.id === tenancy.tenant_id);
      tenancy_by_name[tenant.name] = tenancy;
    });
  const property_by_name = {};
  data.properties.forEach((property) => {
    property_by_name[property.name] = property;
  });
  const work_order_ids = {};
  work_orders.forEach((order) => {
    const [property_name, unit_label] = order.property.split(', ');
    const property = property_by_name[property_name];
    const tenancy = tenancy_by_name[order.tenant];
    const id = 'wo-' + order.id;
    work_order_ids[order.id] = id;
    tree.workOrders[id] = cleanRecord({
      id: id,
      ownerId: owner_id,
      propertyId: property.id,
      propertyName: property.name,
      propertyAddress: property.address,
      unitLabel: unit_label || '',
      tenantUserId: tenancy ? tenancy.tenant_id : undefined,
      tenancyId: tenancy ? tenancy.id : undefined,
      tenantName: order.tenant || '',
      title: order.title,
      description: order.description || '',
      status: order.status,
      priority: order.priority,
      ownerNotes: order.notes || '',
      contractor: order.contractor || '',
      estimate: typeof order.estimate === 'number' ? order.estimate : undefined,
      preferredDate: '',
      // the faucet came from Sam's Report an Issue, the rest the landlord added
      createdBy: order.id === '1' && tenancy ? tenancy.tenant_id : owner_id,
      createdAt: order.created_at + 'T15:00:00.000Z',
      startedAt: order.started_at ? order.started_at + 'T15:00:00.000Z' : undefined,
      resolvedAt: order.resolved_at ? order.resolved_at + 'T15:00:00.000Z' : undefined,
      updatedAt: (order.resolved_at || order.started_at || order.created_at) + 'T15:00:00.000Z',
    });
  });

  // ----- expenses, through the same mapping the app saves with -----
  seed_expenses.forEach((expense, index) => {
    const property_name = (expense.property || '').split(', ')[0];
    const property = property_by_name[property_name];
    // the cleaning at Cedar was for the sticking lock, so two expenses point at work orders
    const work_order_id =
      expense.id === 'seed-4' ? '4' : expense.work_order_id ? expense.work_order_id : null;
    const body = toApiExpense(
      { ...expense, work_order_id: work_order_id ? work_order_ids[work_order_id] : null },
      property ? property.id : null,
      null,
    );
    const id = 'exp-' + (index + 1);
    tree.expenses[id] = cleanRecord({
      ...body,
      id: id,
      ownerId: owner_id,
      propertyName: property ? property.name : undefined,
      receiptKey: undefined,
      createdAt: expense.date + 'T18:00:00.000Z',
      updatedAt: expense.date + 'T18:00:00.000Z',
    });
  });

  // ----- mileage and the landlord's settings -----
  seed_trips.forEach((trip) => {
    tree.mileage[trip.id] = cleanRecord({
      ...toDbTrip(trip, owner_id),
      createdAt: trip.date + 'T18:00:00.000Z',
      updatedAt: trip.date + 'T18:00:00.000Z',
    });
  });
  tree.ownerSettings[owner_id] = {
    mileageRate: default_mileage_rate,
    budgets: budgetsToDb(seed_budgets),
    updatedAt: now_iso,
  };

  // ----- conversations and messages (the demo threads, with unread on both sides) -----
  const threads = buildSampleThreads(now);
  threads.conversations.forEach((conversation) => {
    const id = seedId(conversation.id);
    const tenant_id = seedId(conversation.otherUser.id);
    const messages = threads.messages_by_id[conversation.id].slice().reverse();
    tree.messages[id] = {};
    let last_key = null;
    messages.forEach((message) => {
      // real push ids from each message's own time, so a message sent from the app later sorts after them
      const key = generatePushId(Date.parse(message.createdAt));
      last_key = key;
      tree.messages[id][key] = {
        senderId: seedId(message.senderId),
        body: message.body,
        createdAt: message.createdAt,
      };
    });
    const last = messages[messages.length - 1];
    tree.conversations[id] = {
      id: id,
      ownerId: owner_id,
      tenantUserId: tenant_id,
      ownerName: demo_landlord.name,
      tenantName: conversation.otherUser.name,
      lastMessage: {
        id: last_key,
        senderId: seedId(last.senderId),
        body: last.body,
        createdAt: last.createdAt,
      },
      lastReadAt: {
        [owner_id]: conversation.lastReadAt,
        [tenant_id]: conversation.otherUserLastReadAt,
      },
      unreadCount: {
        [owner_id]: conversation.unreadCount,
        [tenant_id]: conversation.otherUnreadCount,
      },
      createdAt: conversation.createdAt,
      updatedAt: last.createdAt,
    };
  });
  // Priya and Riley get an empty conversation, so Message works for every current tenant
  ['priya', 'riley'].forEach((name) => {
    const id = 'convo-' + name;
    const tenant = tree.users['tenant-' + name];
    tree.conversations[id] = {
      id: id,
      ownerId: owner_id,
      tenantUserId: tenant.id,
      ownerName: demo_landlord.name,
      tenantName: tenant.name,
      unreadCount: { [owner_id]: 0, [tenant.id]: 0 },
      createdAt: daysAgoIso(now, 60),
      updatedAt: daysAgoIso(now, 60),
    };
  });

  // ----- one rent reminder from three days ago, so the 24 hour rule lets the next one go -----
  const sent_at = daysAgoIso(now, 3);
  const reminder = reminderId('tenancy-sam', sent_at);
  tree.reminders[reminder] = {
    id: reminder,
    ownerId: owner_id,
    tenancyId: 'tenancy-sam',
    kind: 'friendly',
    amountCents: 45000,
    message: "Hi Sam, a friendly reminder that the rest of last month's rent is still open.",
    sentAt: sent_at,
  };

  // ----- checklists and document records -----
  sample_checklists.forEach((checklist) => {
    tree.checklists[checklist.id] = cleanRecord({
      ...toDbChecklist(checklist, owner_id),
      updatedAt: now_iso,
    });
  });
  seed_documents.forEach((document) => {
    tree.documents[document.id] = cleanRecord({
      ...toDbDocument(document, owner_id),
      createdAt: document.added_at + 'T18:00:00.000Z',
      updatedAt: document.added_at + 'T18:00:00.000Z',
    });
  });

  return tree;
}

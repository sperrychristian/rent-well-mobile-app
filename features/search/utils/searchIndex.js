// pure helpers for the Search screen: turn what the app already has loaded into searchable rows,
// find the matches, group them by section, and split a line so the matching part can be highlighted
// nothing here touches the network or storage, so the tests can check all of it
import { deriveLedger } from '../../payments/utils/ledgerMath';
import {
  chargeKindLabel,
  chargeStatusLine,
  paymentStatusLine,
} from '../../payments/utils/ledgerHelpers';
import { formatCents, formatCurrency } from '../../../utils/formatCurrency';

// the section order on screen, landlords see all of them and tenants only the ones about their own rental
export const search_sections = [
  { key: 'tenants', title: 'Tenants', icon: 'people-outline' },
  { key: 'properties', title: 'Properties', icon: 'business-outline' },
  { key: 'work_orders', title: 'Work orders', icon: 'construct-outline' },
  { key: 'payments', title: 'Payments', icon: 'card-outline' },
  { key: 'charges', title: 'Charges', icon: 'calendar-outline' },
  { key: 'expenses', title: 'Expenses', icon: 'receipt-outline' },
];

// the most recent searches kept, and the fewest letters before a search runs
export const max_recent_searches = 8;
export const min_query_length = 2;

function placeText(property_name, unit_label) {
  return [property_name, unit_label].filter(Boolean).join(', ');
}

// one row: what it shows, what it matches on, and where a tap goes (always by id, never an object)
function item(section, id, fields) {
  return {
    key: section + ':' + id,
    section: section,
    title: fields.title || '',
    subtitle: fields.subtitle || '',
    // extra words that match but don't show, like a vendor's notes or a tenant's email
    keywords: (fields.keywords || []).filter(Boolean).join(' '),
    route: fields.route,
    // the id the route opens with, the screen passes it as an inline id param (never this whole row)
    target_id: fields.target_id || null,
    tone: fields.tone || null,
  };
}

// a landlord's tenants, properties, every work order, every ledger's payments and charges, and the expenses
// a tenant's own requests, payments, and charges (they have no tenants, properties, or expenses to search)
// data: { role, orders, tenants, properties, ledgers, expenses, today }
// the screen hands in only that role's ledgers and orders, so a tenant never gets a landlord's rows
export function buildSearchItems(data) {
  const is_owner = data.role !== 'tenant';
  const items = [];
  const today = data.today;

  if (is_owner) {
    (data.tenants || []).forEach((tenant) => {
      const homes = (tenant.active_tenancies || []).map((tenancy) =>
        placeText(tenancy.property_name, tenancy.unit_label),
      );
      items.push(
        item('tenants', tenant.id, {
          title: tenant.name,
          subtitle: homes.length > 0 ? homes.join('; ') : 'No active rental',
          keywords: [tenant.email],
          route: 'TenantDetail',
          target_id: tenant.id,
        }),
      );
    });
    (data.properties || []).forEach((property) => {
      items.push(
        item('properties', property.id, {
          title: property.name,
          subtitle: property.address || '',
          route: 'PropertyDetail',
          target_id: property.id,
        }),
      );
    });
  }

  (data.orders || []).forEach((order) => {
    items.push(
      item('work_orders', order.id, {
        title: order.title,
        subtitle: [order.property, order.status].filter(Boolean).join(' · '),
        keywords: [order.tenant, order.description, order.notes, order.contractor],
        route: is_owner ? 'WorkOrderDetail' : 'RequestDetail',
        target_id: order.id,
      }),
    );
  });

  (data.ledgers || []).forEach((ledger) => {
    const place = placeText(ledger.property_name, ledger.unit_label);
    (ledger.payments || []).forEach((payment) => {
      const line = paymentStatusLine(payment);
      items.push(
        item('payments', payment.id, {
          title:
            (payment.is_refund ? 'Refund ' : '') +
            formatCents(payment.amount_cents) +
            (is_owner ? ' from ' + ledger.tenant_name : ''),
          subtitle: line.text,
          keywords: [ledger.tenant_name, place, payment.note, payment.method],
          route: 'PaymentDetail',
          target_id: payment.id,
          tone: line.tone,
        }),
      );
    });
    const derived = deriveLedger(ledger, today);
    (derived.charges || []).forEach((charge) => {
      const line = chargeStatusLine(charge);
      const name = charge.description || chargeKindLabel(charge.kind);
      items.push(
        item('charges', charge.id, {
          title: name + ', ' + formatCents(charge.amount_cents),
          subtitle: (is_owner ? ledger.tenant_name + ' · ' : '') + line.text,
          keywords: [ledger.tenant_name, place, chargeKindLabel(charge.kind)],
          // a landlord opens that tenant's ledger, a tenant's charges live on their Payments tab
          route: is_owner ? 'TenantLedger' : 'Payments',
          target_id: is_owner ? ledger.tenancy_id : null,
          tone: line.tone,
        }),
      );
    });
  });

  if (is_owner) {
    (data.expenses || []).forEach((expense) => {
      items.push(
        item('expenses', expense.id, {
          title:
            (expense.vendor || expense.category || 'Expense') +
            ', ' +
            formatCurrency(expense.amount),
          subtitle: [expense.date, expense.property, expense.category].filter(Boolean).join(' · '),
          keywords: [expense.notes, expense.payment_method],
          route: 'Expenses',
          target_id: expense.id,
        }),
      );
    });
  }

  return items;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .trim();
}

// every word typed has to show up somewhere in the row, so "maple faucet" finds the faucet at Maple
export function matchesQuery(entry, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return false;
  }
  const haystack = normalize(entry.title + ' ' + entry.subtitle + ' ' + entry.keywords);
  return words.every((word) => haystack.includes(word));
}

// the matches grouped in section order, title matches first inside a section, each section capped
// gives back [{ key, title, icon, data: [rows] }], empty sections are left out
export function searchItems(items, query, per_section) {
  const limit = per_section || 20;
  if (normalize(query).length < min_query_length) {
    return [];
  }
  const first_word = normalize(query).split(/\s+/)[0];
  return search_sections
    .map((section) => {
      const rows = items
        .filter((entry) => entry.section === section.key && matchesQuery(entry, query))
        .sort((a, b) => {
          const a_title = normalize(a.title).includes(first_word) ? 0 : 1;
          const b_title = normalize(b.title).includes(first_word) ? 0 : 1;
          return a_title - b_title;
        })
        .slice(0, limit);
      return { key: section.key, title: section.title, icon: section.icon, data: rows };
    })
    .filter((section) => section.data.length > 0);
}

// splits a line into plain and matching parts for the highlight, every typed word counts
// gives back [{ text, match }] that joins back to the original line
export function highlightParts(text, query) {
  const line = String(text || '');
  const words = normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0 || line === '') {
    return [{ text: line, match: false }];
  }
  const pattern = new RegExp('(' + words.join('|') + ')', 'gi');
  return line
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({
      text: part,
      match: words.some((word) => new RegExp('^' + word + '$', 'i').test(part)),
    }));
}

// the newest search goes first, a repeat moves to the top instead of showing twice, and the list stays short
export function addRecentSearch(recents, query) {
  const text = String(query || '').trim();
  if (text.length < min_query_length) {
    return recents;
  }
  const rest = recents.filter((entry) => entry.toLowerCase() !== text.toLowerCase());
  return [text, ...rest].slice(0, max_recent_searches);
}

// how many rows came back in total, for the screen reader's "N results"
export function resultCount(sections) {
  return sections.reduce((sum, section) => sum + section.data.length, 0);
}

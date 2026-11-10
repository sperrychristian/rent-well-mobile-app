// properties/{propertyId}: add, edit, and delete go through the tenant bundle (util/data/tenants.js),
// since they share rules with tenancies, this file has the one property field the ledger owns
import { patchNode } from '../http';
import { nowIso } from './records';

// how tenants should pay, shown on Payments and Property Overview
export function savePaymentInstructions(property_id, text) {
  return patchNode('properties/' + property_id, {
    paymentInstructions: text,
    updatedAt: nowIso(),
  });
}

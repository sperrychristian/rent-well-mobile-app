import { useTenants } from '../../tenants/context/TenantsContext';
import { useLedger } from '../../payments/context/LedgerContext';
import { nextScheduledDue, monthOf } from '../../payments/utils/ledgerMath';

// set and renew for the lease screens, the same calls in both modes
// renewing with a new rent is one step on the server, the demo does the same two parts itself:
// the lease in the demo tenant data, then the rent schedule in the demo ledger, starting the first unbilled month
export function useLeaseActions() {
  const tenants = useTenants();
  const ledger_store = useLedger();

  function currentSchedule(tenancy_id) {
    const ledger = ledger_store.getLedger ? ledger_store.getLedger(tenancy_id) : null;
    return ledger && ledger.schedule ? ledger.schedule : null;
  }

  async function renew(tenancy_id, value) {
    const schedule = currentSchedule(tenancy_id);
    await tenants.renewLease(tenancy_id, value, !!schedule);
    if (tenants.is_demo && schedule && value.new_rent_cents) {
      // billed rent keeps its amount, so the new one starts the month of the next rent not billed yet
      const next_due = nextScheduledDue(schedule, ledger_store.today);
      const start_date = next_due ? monthOf(next_due) + '-01' : schedule.start_date;
      await ledger_store.setRentSchedule(tenancy_id, {
        ...schedule,
        amount_cents: value.new_rent_cents,
        start_date: start_date,
      });
    }
  }

  return {
    setLease: tenants.setLease,
    renewLease: renew,
    currentRentCents: (tenancy_id) => {
      const schedule = currentSchedule(tenancy_id);
      return schedule ? schedule.amount_cents : null;
    },
  };
}

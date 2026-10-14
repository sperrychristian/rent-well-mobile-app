import { useState } from 'react';
import { Alert } from 'react-native';
import ReasonModal from '../components/ReasonModal';
import { useLedger } from '../context/LedgerContext';
import { useToast } from '../../../components/ui/Toast';
import { hapticSuccess } from '../../../utils/haptics';
import { formatCents } from '../../../utils/formatCurrency';
import { methodLabel } from '../utils/ledgerHelpers';

// the landlord's review steps, shared by the Payments list, a tenant's ledger, and Payment Detail:
// confirm a claim, reject one with a reason, void a payment or a charge with a reason and an "are you sure"
// it hands back the actions and the reason sheet, the screen puts `sheet` somewhere in its JSX
export function useLedgerReview() {
  const ledger = useLedger();
  const toast = useToast();
  // which reason sheet is open: { kind: 'reject' | 'void_payment' | 'void_charge', item, key }
  const [asking, setAsking] = useState(null);
  const [busy_id, setBusyId] = useState(null);

  async function confirm(payment) {
    setBusyId(payment.id);
    try {
      await ledger.confirmPayment(payment.id);
      hapticSuccess();
      toast.show('Payment confirmed');
    } catch (error) {
      console.log('Could not confirm the payment', error.message);
      Alert.alert("Couldn't confirm it", error.message);
    }
    setBusyId(null);
  }

  function ask(kind, item) {
    setAsking({ kind: kind, item: item, key: Date.now() });
  }

  async function submitReason(reason) {
    const item = asking.item;
    if (asking.kind === 'reject') {
      await ledger.rejectPayment(item.id, reason);
      toast.show('Claim rejected', 'close-circle');
    } else if (asking.kind === 'void_payment') {
      await ledger.voidPayment(item.id, reason);
      toast.show('Payment voided', 'remove-circle');
    } else {
      await ledger.voidCharge(item.id, reason);
      toast.show('Charge voided', 'remove-circle');
    }
    setAsking(null);
  }

  let sheet = null;
  if (asking) {
    const item = asking.item;
    const amount = formatCents(item.amount_cents);
    const words = {
      reject: {
        title: 'Reject Claim',
        subtitle: amount + ' by ' + methodLabel(item.method) + ' on ' + item.paid_on,
        submit_label: 'Reject',
        placeholder: "e.g. I don't see this in my account yet",
      },
      void_payment: {
        title: 'Void Payment',
        subtitle: amount + ' on ' + item.paid_on + '. It stays on the record but stops counting.',
        submit_label: 'Void Payment',
        placeholder: 'e.g. The check bounced',
        confirm_title: 'Void this payment?',
        confirm_message:
          amount + ' comes back off what the tenant has paid. This cannot be undone.',
      },
      void_charge: {
        title: 'Void Charge',
        subtitle: item.description + ', ' + amount + '. It stays on the record but stops counting.',
        submit_label: 'Void Charge',
        placeholder: 'e.g. Added by mistake',
        confirm_title: 'Void this charge?',
        confirm_message: amount + ' comes off what the tenant owes. This cannot be undone.',
      },
    }[asking.kind];
    sheet = (
      <ReasonModal
        key={asking.key}
        visible
        {...words}
        onSubmit={submitReason}
        onClose={() => setAsking(null)}
      />
    );
  }

  return {
    confirm: confirm,
    reject: (payment) => ask('reject', payment),
    voidPayment: (payment) => ask('void_payment', payment),
    voidCharge: (charge) => ask('void_charge', charge),
    busy_id: busy_id,
    sheet: sheet,
  };
}

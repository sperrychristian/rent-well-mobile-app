import { useState } from 'react';
import FormSheet from '../../payments/components/FormSheet';
import { Field, MoneyField } from '../../payments/components/FormBits';
import DateField from '../../../components/DateField';
import { checkRenewForm, suggestedRenewEnd, shortLeaseDate } from '../utils/leaseHelpers';
import { parseAmountToCents, formatCents } from '../../../utils/formatCurrency';

// renew a lease: a new end date, and the new monthly rent if it's changing
// rent already billed never changes, the new amount starts the first month that hasn't been billed
// props: visible, place, lease (the current derived one), current_rent_cents (or null), today,
//   onSubmit (gets { new_end_on, new_rent_cents }), onClose
function RenewLeaseSheet(props) {
  const [new_end_on, setNewEndOn] = useState(suggestedRenewEnd(props.lease, props.today));
  const [rent_text, setRentText] = useState('');
  const [errors, setErrors] = useState({});
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const rent_cents = rent_text.trim() === '' ? null : parseAmountToCents(rent_text);
    const checked = checkRenewForm(
      // a rent that won't parse becomes 0 so the check says what's wrong with it
      { new_end_on, rent_cents: rent_text.trim() !== '' && rent_cents === null ? 0 : rent_cents },
      props.lease,
      props.today,
    );
    setErrors(checked.errors);
    setFormError('');
    if (Object.keys(checked.errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit(checked.value);
    } catch (error) {
      console.log('Could not renew the lease', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  const current_end = props.lease.lease_end_on
    ? 'Ends ' + shortLeaseDate(props.lease.lease_end_on, props.today) + ' now'
    : 'Month to month now';

  return (
    <FormSheet
      visible={props.visible}
      title="Renew Lease"
      subtitle={props.place + ' · ' + current_end}
      error={form_error}
      submit_label="Renew Lease"
      submit_icon="refresh-outline"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="New end date" error={errors.new_end_on}>
        <DateField value={new_end_on} onChange={setNewEndOn} />
      </Field>
      <Field
        label="New monthly rent (optional)"
        error={errors.rent}
        helper={
          props.current_rent_cents
            ? 'Now ' + formatCents(props.current_rent_cents) + '. Leave blank to keep it.'
            : 'Leave blank to keep the rent as it is.'
        }
      >
        <MoneyField
          label="New monthly rent"
          value={rent_text}
          onChangeText={setRentText}
          error={errors.rent}
          returnKeyType="done"
        />
      </Field>
    </FormSheet>
  );
}

export default RenewLeaseSheet;

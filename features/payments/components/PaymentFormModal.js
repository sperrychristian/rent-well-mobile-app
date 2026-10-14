import { useRef, useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import FormSheet from './FormSheet';
import { Field, MoneyField, ChipPicker, ReceiptPicker, form_styles } from './FormBits';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import DateField from '../../../components/DateField';
import { centsToInputText } from '../../../utils/formatCurrency';
import { payment_methods, validatePayment, hasErrors } from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

const applies_options = [
  { value: 'rent', label: 'Rent' },
  { value: 'deposit', label: 'Deposit' },
];

// one form for money that came in: the landlord's "Record payment" and the tenant's "I paid" claim
// a claim can't be a refund and waits for the landlord, a recorded payment counts right away
// props: visible, is_claim, place (who and where, for the line under the title), today, suggested_cents,
//   onSubmit (gets the checked value and the receipt photo or null, gives back a promise), onClose
// the screen gives it a new key each time it opens, so it starts fresh without an effect
function PaymentFormModal(props) {
  const [amount_text, setAmountText] = useState(
    props.suggested_cents > 0 ? centsToInputText(props.suggested_cents) : '',
  );
  const [method, setMethod] = useState('zelle');
  const [paid_on, setPaidOn] = useState(props.today);
  const [applies_to, setAppliesTo] = useState('rent');
  const [is_refund, setIsRefund] = useState(false);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const note_ref = useRef(null);

  async function submit() {
    const fields = { amount_text, method, paid_on, applies_to, is_refund, note };
    const checked = validatePayment(fields, props.today, props.is_claim);
    setErrors(checked.errors);
    setFormError('');
    if (hasErrors(checked.errors)) {
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit(checked.value, receipt);
    } catch (error) {
      console.log('Could not save the payment', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible={props.visible}
      title={props.is_claim ? 'I Paid' : 'Record Payment'}
      subtitle={
        props.is_claim
          ? 'Tell your landlord about a payment you sent. It shows as waiting until they confirm it.'
          : props.place
      }
      error={form_error}
      submit_label={props.is_claim ? 'Send to Landlord' : 'Save Payment'}
      submit_icon={props.is_claim ? 'paper-plane-outline' : 'checkmark-circle-outline'}
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="Amount" error={errors.amount}>
        <MoneyField
          label="Amount"
          value={amount_text}
          onChangeText={setAmountText}
          error={errors.amount}
          returnKeyType="next"
          onSubmitEditing={() => note_ref.current && note_ref.current.focus()}
        />
      </Field>

      <Field label="How it was paid" error={errors.method}>
        <ChipPicker
          label="How it was paid"
          options={payment_methods}
          value={method}
          onChange={setMethod}
        />
      </Field>

      <Field label="Date paid" error={errors.paid_on} helper="The day the money was sent.">
        <DateField value={paid_on} onChange={setPaidOn} />
      </Field>

      <Field label="This is for" error={errors.applies_to}>
        <SegmentedControl
          label="This is for"
          options={applies_options}
          value={applies_to}
          onChange={setAppliesTo}
        />
      </Field>

      {/* only the landlord gives money back, like returning a deposit at move-out */}
      {!props.is_claim ? (
        <View style={styles.switch_row}>
          <View style={styles.switch_words}>
            <Text style={styles.switch_label}>This is a refund</Text>
            <Text style={styles.switch_helper}>Money you gave back to the tenant.</Text>
          </View>
          <Switch
            value={is_refund}
            onValueChange={setIsRefund}
            trackColor={{ false: COLORS.border_strong, true: COLORS.cta }}
            thumbColor={COLORS.surface}
            ios_backgroundColor={COLORS.border_strong}
            accessibilityLabel="This is a refund"
          />
        </View>
      ) : null}

      <Field label="Note (optional)" error={errors.note}>
        <TextInput
          ref={note_ref}
          value={note}
          onChangeText={setNote}
          placeholder={props.is_claim ? 'e.g. Sent from my checking account' : 'e.g. Check #1042'}
          placeholderTextColor={COLORS.text_muted}
          multiline
          maxLength={500}
          accessibilityLabel="Note"
          style={[form_styles.input, form_styles.note, errors.note && form_styles.input_error]}
        />
      </Field>

      <Field label="Receipt photo (optional)">
        <ReceiptPicker value={receipt} onChange={setReceipt} />
      </Field>
    </FormSheet>
  );
}

export default PaymentFormModal;

const styles = StyleSheet.create({
  switch_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.touch,
    marginBottom: SPACING.md,
  },
  switch_words: {
    flex: 1,
  },
  switch_label: {
    ...TYPE.label,
    color: COLORS.text,
  },
  switch_helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
});

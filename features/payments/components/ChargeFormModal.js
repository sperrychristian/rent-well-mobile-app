import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import FormSheet from './FormSheet';
import { Field, MoneyField, ChipPicker, form_styles } from './FormBits';
import DateField from '../../../components/DateField';
import { charge_kinds, validateCharge, hasErrors } from '../utils/ledgerHelpers';
import { COLORS } from '../../../theme';

// default words for each kind, so picking one fills in the description when it's still empty
const kind_words = {
  other: '',
  deposit: 'Security deposit',
  late_fee: 'Late fee',
  rent: 'Rent',
};

// a one-off charge on a tenant's ledger: a deposit, a fee, a repair they're paying for
// rent from the schedule adds itself, so this is for everything else
// props: visible, place, today, onSubmit (gets the checked value, gives back a promise), onClose
function ChargeFormModal(props) {
  const [kind, setKind] = useState('other');
  const [description, setDescription] = useState('');
  const [amount_text, setAmountText] = useState('');
  const [due_date, setDueDate] = useState(props.today);
  const [errors, setErrors] = useState({});
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const amount_ref = useRef(null);

  function pickKind(next) {
    if (description.trim() === '' || description === kind_words[kind]) {
      setDescription(kind_words[next]);
    }
    setKind(next);
  }

  async function submit() {
    const checked = validateCharge({ kind, description, amount_text, due_date }, props.today);
    setErrors(checked.errors);
    setFormError('');
    if (hasErrors(checked.errors)) {
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit(checked.value);
    } catch (error) {
      console.log('Could not add the charge', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible={props.visible}
      title="Add Charge"
      subtitle={props.place}
      error={form_error}
      submit_label="Add Charge"
      submit_icon="add-circle-outline"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="Kind of charge" error={errors.kind}>
        <ChipPicker
          label="Kind of charge"
          options={charge_kinds}
          value={kind}
          onChange={pickKind}
        />
      </Field>

      <Field label="What it's for" error={errors.description}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Replacement key fob"
          placeholderTextColor={COLORS.text_muted}
          maxLength={200}
          returnKeyType="next"
          onSubmitEditing={() => amount_ref.current && amount_ref.current.focus()}
          accessibilityLabel="What it's for"
          style={[form_styles.input, errors.description && form_styles.input_error]}
        />
      </Field>

      <Field label="Amount" error={errors.amount}>
        <MoneyField
          ref={amount_ref}
          label="Amount"
          value={amount_text}
          onChangeText={setAmountText}
          error={errors.amount}
          returnKeyType="done"
        />
      </Field>

      <Field label="Due date" error={errors.due_date}>
        <DateField value={due_date} onChange={setDueDate} />
      </Field>
    </FormSheet>
  );
}

export default ChargeFormModal;

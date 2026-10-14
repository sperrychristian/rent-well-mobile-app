import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import FormSheet from './FormSheet';
import { Field, MoneyField, form_styles } from './FormBits';
import DateField from '../../../components/DateField';
import { centsToInputText } from '../../../utils/formatCurrency';
import { validateSchedule, hasErrors } from '../utils/ledgerHelpers';
import { monthOf, shiftMonth } from '../utils/ledgerMath';

// the monthly rent: how much, which day, how many grace days before it's late, the late fee, and when it starts
// rent already charged keeps its amount, the new schedule only adds months from its start date on
// props: visible, place, schedule (the current one or null), today, onSubmit (gets the checked value), onClose
function ScheduleFormModal(props) {
  const current = props.schedule;
  const [amount_text, setAmountText] = useState(
    current ? centsToInputText(current.amount_cents) : '',
  );
  const [due_day_text, setDueDayText] = useState(current ? String(current.due_day) : '1');
  const [grace_text, setGraceText] = useState(current ? String(current.grace_days) : '5');
  const [late_fee_text, setLateFeeText] = useState(
    current && current.late_fee_cents > 0 ? centsToInputText(current.late_fee_cents) : '',
  );
  // a new schedule starts on the first of next month unless they pick another day
  const [start_date, setStartDate] = useState(
    current ? current.start_date : shiftMonth(monthOf(props.today), 1) + '-01',
  );
  const [errors, setErrors] = useState({});
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const day_ref = useRef(null);
  const grace_ref = useRef(null);
  const fee_ref = useRef(null);

  async function submit() {
    const checked = validateSchedule({
      amount_text,
      due_day_text,
      grace_text,
      late_fee_text,
      start_date,
    });
    setErrors(checked.errors);
    setFormError('');
    if (hasErrors(checked.errors)) {
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit(checked.value);
    } catch (error) {
      console.log('Could not save the rent schedule', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible={props.visible}
      title="Rent Schedule"
      subtitle={props.place}
      error={form_error}
      submit_label="Save Schedule"
      submit_icon="calendar-outline"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="Monthly rent" error={errors.amount}>
        <MoneyField
          label="Monthly rent"
          value={amount_text}
          onChangeText={setAmountText}
          error={errors.amount}
          returnKeyType="next"
          onSubmitEditing={() => day_ref.current && day_ref.current.focus()}
        />
      </Field>

      <Field label="Due day of the month" error={errors.due_day} helper="1 to 28.">
        <TextInput
          ref={day_ref}
          value={due_day_text}
          onChangeText={setDueDayText}
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          onSubmitEditing={() => grace_ref.current && grace_ref.current.focus()}
          accessibilityLabel="Due day of the month"
          style={[form_styles.input, errors.due_day && form_styles.input_error]}
        />
      </Field>

      <Field
        label="Grace days"
        error={errors.grace}
        helper="Days after the due day before rent counts as late."
      >
        <TextInput
          ref={grace_ref}
          value={grace_text}
          onChangeText={setGraceText}
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="next"
          onSubmitEditing={() => fee_ref.current && fee_ref.current.focus()}
          accessibilityLabel="Grace days"
          style={[form_styles.input, errors.grace && form_styles.input_error]}
        />
      </Field>

      <Field
        label="Late fee (optional)"
        error={errors.late_fee}
        helper="Added once when rent is still owed after the grace days."
      >
        <MoneyField
          ref={fee_ref}
          label="Late fee"
          value={late_fee_text}
          onChangeText={setLateFeeText}
          error={errors.late_fee}
          returnKeyType="done"
        />
      </Field>

      <Field label="Starts on" error={errors.start_date}>
        <DateField value={start_date} onChange={setStartDate} />
      </Field>
    </FormSheet>
  );
}

export default ScheduleFormModal;

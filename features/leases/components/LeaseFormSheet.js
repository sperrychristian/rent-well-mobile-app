import { useState } from 'react';
import { View, Text, TextInput, Switch } from 'react-native';
import FormSheet from '../../payments/components/FormSheet';
import { Field, form_styles } from '../../payments/components/FormBits';
import DateField from '../../../components/DateField';
import { checkLeaseForm, addDaysTo } from '../utils/leaseHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// set or edit a lease: start, end (or month to month), how many days of notice before it ends, and notes
// a save replaces the whole lease, same as the server's PUT
// props: visible, place, lease (the current derived one, lease_status none for a new one), today,
//   onSubmit (gets the checked value), onClose
function LeaseFormSheet(props) {
  const current = props.lease;
  const has_lease = current && current.lease_status !== 'none';
  const [start_on, setStartOn] = useState(
    has_lease && current.lease_start_on ? current.lease_start_on : props.today,
  );
  const [end_on, setEndOn] = useState(
    has_lease && current.lease_end_on ? current.lease_end_on : addDaysTo(props.today, 364),
  );
  const [is_month_to_month, setMonthToMonth] = useState(
    has_lease ? current.lease_term === 'month_to_month' : false,
  );
  const [notice_text, setNoticeText] = useState(
    has_lease ? String(current.renewal_notice_days) : '60',
  );
  const [notes, setNotes] = useState(has_lease ? current.lease_notes || '' : '');
  const [errors, setErrors] = useState({});
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const checked = checkLeaseForm(
      {
        lease_start_on: start_on,
        lease_end_on: end_on,
        is_month_to_month: is_month_to_month,
        notice_text: notice_text,
        lease_notes: notes,
      },
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
      console.log('Could not save the lease', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible={props.visible}
      title={has_lease ? 'Edit Lease' : 'Set Lease'}
      subtitle={props.place}
      error={form_error}
      submit_label="Save Lease"
      submit_icon="document-text-outline"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="Starts on" error={errors.lease_start_on}>
        <DateField value={start_on} onChange={setStartOn} />
      </Field>

      {/* month to month has no end date, so the end field goes away while it's on */}
      <View style={styles.switch_row}>
        <View style={styles.switch_words}>
          <Text style={styles.switch_label}>Month to month</Text>
          <Text style={styles.switch_hint}>No end date, it rolls over each month.</Text>
        </View>
        <Switch
          value={is_month_to_month}
          onValueChange={setMonthToMonth}
          trackColor={{ false: COLORS.border_strong, true: COLORS.cta }}
          thumbColor={COLORS.surface}
          accessibilityLabel="Month to month"
        />
      </View>

      {is_month_to_month ? null : (
        <Field label="Ends on" error={errors.lease_end_on}>
          <DateField value={end_on} onChange={setEndOn} />
        </Field>
      )}

      <Field
        label="Renewal notice (days)"
        error={errors.notice}
        helper="How many days before the end it shows as expiring soon and you get a reminder."
      >
        <TextInput
          value={notice_text}
          onChangeText={setNoticeText}
          keyboardType="number-pad"
          maxLength={3}
          accessibilityLabel="Renewal notice in days"
          style={[form_styles.input, errors.notice && form_styles.input_error]}
        />
      </Field>

      <Field label="Notes (only you see these)" error={errors.lease_notes}>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
          placeholder="e.g. Pets: one cat"
          placeholderTextColor={COLORS.text_muted}
          accessibilityLabel="Lease notes"
          style={[form_styles.input, styles.notes, errors.lease_notes && form_styles.input_error]}
        />
      </Field>
    </FormSheet>
  );
}

export default LeaseFormSheet;

const styles = themedStyles((COLORS) => ({
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
  switch_hint: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
  notes: {
    minHeight: SIZES.button_large * 2,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
}));

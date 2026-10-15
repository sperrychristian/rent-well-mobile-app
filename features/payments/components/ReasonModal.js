import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import FormSheet from './FormSheet';
import { Field, form_styles } from './FormBits';
import { validateReason } from '../utils/ledgerHelpers';
import { COLORS } from '../../../theme';

// asks why before something gets voided or rejected, the reason stays on the record for both sides to see
// confirm_title and confirm_message turn on a second "are you sure" step, the voids use it since they take money back out
// props: visible, title, subtitle, submit_label, placeholder, confirm_title, confirm_message,
//   onSubmit (gets the reason, gives back a promise), onClose
function ReasonModal(props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(value) {
    setBusy(true);
    try {
      await props.onSubmit(value);
    } catch (request_error) {
      console.log('Could not save that', request_error.message);
      setFormError(request_error.message);
      setBusy(false);
    }
  }

  function submit() {
    const checked = validateReason(reason);
    setError(checked.error || '');
    setFormError('');
    if (checked.error) {
      return;
    }
    if (!props.confirm_title) {
      run(checked.value);
      return;
    }
    Alert.alert(props.confirm_title, props.confirm_message, [
      { text: 'Cancel', style: 'cancel' },
      { text: props.submit_label, style: 'destructive', onPress: () => run(checked.value) },
    ]);
  }

  return (
    <FormSheet
      visible={props.visible}
      title={props.title}
      subtitle={props.subtitle}
      error={form_error}
      submit_label={props.submit_label}
      submit_icon="close-circle-outline"
      submit_variant="destructive"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field label="Reason" error={error} helper="The other side sees this.">
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={props.placeholder}
          placeholderTextColor={COLORS.text_muted}
          multiline
          maxLength={500}
          autoFocus
          accessibilityLabel="Reason"
          style={[form_styles.input, form_styles.note, error && form_styles.input_error]}
        />
      </Field>
    </FormSheet>
  );
}

export default ReasonModal;

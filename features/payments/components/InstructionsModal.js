import { useState } from 'react';
import { TextInput } from 'react-native';
import FormSheet from './FormSheet';
import { Field, form_styles } from './FormBits';
import { COLORS } from '../../../theme';

const max_length = 1000;

// how tenants at a property should pay: a Zelle address, who checks go to, where to drop them off
// the app never takes payments itself, tenants pay the landlord directly and then tap "I paid"
// props: visible, property_name, value (the current text), onSubmit (gets the new text), onClose
function InstructionsModal(props) {
  const [text, setText] = useState(props.value || '');
  const [form_error, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setFormError('');
    try {
      await props.onSubmit(text);
    } catch (error) {
      console.log('Could not save the payment instructions', error.message);
      setFormError(error.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible={props.visible}
      title="Payment Instructions"
      subtitle={'Tenants at ' + props.property_name + ' see this on their Payments screen.'}
      error={form_error}
      submit_label="Save"
      submit_icon="checkmark-circle-outline"
      busy={busy}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <Field
        label="How to pay you"
        helper={text.length + ' of ' + max_length + '. Leave it blank to hide the card.'}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. Zelle to rent@example.com with your unit in the memo"
          placeholderTextColor={COLORS.text_muted}
          multiline
          maxLength={max_length}
          accessibilityLabel="How to pay you"
          style={[form_styles.input, form_styles.note]}
        />
      </Field>
    </FormSheet>
  );
}

export default InstructionsModal;

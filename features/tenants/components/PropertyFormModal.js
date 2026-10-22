import { useState } from 'react';
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import TextField from '../../../components/TextField';
import { SPACING, TYPE, SIZES } from '../../../theme';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { themedStyles } from '../../../utils/themedStyles';

// adds a property, or edits the name and address of one (property is null for a new one)
// props: visible, property, onSave (gets name and address, gives back a promise), onClose
// the real-backend pass: it also edits the payment instructions tenants see (props.instructions is the
// current text), and onSave gets them as a third argument
// the screen gives it a new key each time it opens, so the boxes start fresh without an effect
function PropertyFormModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
  const existing = props.property;
  const [name, setName] = useState(existing ? existing.name : '');
  const [address, setAddress] = useState(existing ? existing.address : '');
  const [instructions, setInstructions] = useState(props.instructions || '');
  const [field_errors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // the same limits as the server: name up to 120, address up to 300
  async function handleSave() {
    const errors = {};
    if (name.trim() === '' || name.trim().length > 120) {
      errors.name = 'Enter a property name (up to 120 characters).';
    }
    if (address.trim() === '' || address.trim().length > 300) {
      errors.address = 'Enter the address (up to 300 characters).';
    }
    if (instructions.trim().length > 1000) {
      errors.instructions = 'Keep the payment instructions under 1000 characters.';
    }
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      await props.onSave(name.trim(), address.trim(), instructions.trim());
    } catch (request_error) {
      console.log('Could not save the property', request_error.message);
      setFieldErrors(request_error.field_errors || {});
      setError(request_error.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
    >
      <View style={styles.root}>
        {/* iOS needs padding to lift the form, Android already resizes the window so it uses height */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll_content}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <Text style={styles.heading}>{existing ? 'Edit Property' : 'Add Property'}</Text>
              <TextField
                label="Name"
                value={name}
                onChangeText={setName}
                error={field_errors.name}
                placeholder="e.g. Maple Court"
              />
              <TextField
                label="Address"
                value={address}
                onChangeText={setAddress}
                error={field_errors.address}
                placeholder="e.g. 12 Maple St, Springfield"
              />
              <TextField
                label="Payment instructions (optional)"
                value={instructions}
                onChangeText={setInstructions}
                error={field_errors.instructions || field_errors.paymentInstructions}
                helper="Tenants here see this on their Payments screen, like how to Zelle you."
                placeholder="e.g. Zelle to rent@example.com with your unit in the memo"
                multiline
                maxLength={1000}
                style={styles.instructions_input}
              />
              {existing && (
                <Text style={styles.helper}>
                  The new name also shows on past tenancies and work orders here.
                </Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.button_row}>
                <PrimaryButton
                  variant="secondary"
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  variant="primary"
                  title={busy ? 'Saving...' : 'Save'}
                  onPress={busy ? undefined : handleSave}
                  style={styles.save_button}
                />
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default PropertyFormModal;

const styles = themedStyles((COLORS) => ({
  root: {
    flex: 1,
  },
  instructions_input: {
    minHeight: SIZES.touch + SPACING.lg + SPACING.xs,
    textAlignVertical: 'top',
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
  },
  scroll_content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  error: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    marginBottom: SPACING.sm,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancel_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  save_button: {
    flex: 1,
    marginHorizontal: 0,
  },
}));

import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import TextField from '../../../components/TextField';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// adds a property, or edits the name and address of one (property is null for a new one)
// props: visible, property, onSave (gets name and address, gives back a promise), onClose
// the screen gives it a new key each time it opens, so the boxes start fresh without an effect
function PropertyFormModal(props) {
  const existing = props.property;
  const [name, setName] = useState(existing ? existing.name : '');
  const [address, setAddress] = useState(existing ? existing.address : '');
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
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      await props.onSave(name.trim(), address.trim());
    } catch (request_error) {
      console.log('Could not save the property', request_error.message);
      setFieldErrors(request_error.field_errors || {});
      setError(request_error.message);
      setBusy(false);
    }
  }

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
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
              {existing && (
                <Text style={styles.helper}>
                  The new name also shows on past tenancies and work orders here.
                </Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.button_row}>
                <PrimaryButton
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  title={busy ? 'Saving...' : 'Save'}
                  text_color={COLORS.text_light}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.md,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  error: {
    color: COLORS.danger,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
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
    backgroundColor: COLORS.secondary,
  },
  save_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
});

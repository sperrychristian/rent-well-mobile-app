import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// a small form with one name box, used for adding a room or an item
// Alert.prompt only works on iOS, so this works on both
// props: visible, title, placeholder, onSave, onClose
// the screen gives it a new key each time it opens, so the box starts empty without an effect
function NameModal(props) {
  const [name, setName] = useState('');

  function handleSave() {
    if (name.trim() === '') {
      Alert.alert('Add a name', 'Type a name first.');
      return;
    }
    props.onSave(name.trim());
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {/* iOS needs padding to lift the form, Android already resizes the window so it uses height */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Card>
          <Text style={styles.heading}>{props.title}</Text>
          <TextInput
            style={styles.input}
            placeholder={props.placeholder}
            placeholderTextColor={COLORS.text_muted}
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={handleSave}
          />
          <View style={styles.button_row}>
            <PrimaryButton title="Cancel" onPress={props.onClose} style={styles.cancel_button} />
            <PrimaryButton title="Add" onPress={handleSave} style={styles.save_button} />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default NameModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
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

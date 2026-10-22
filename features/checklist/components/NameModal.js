import { useState } from 'react';
import { Modal, View, Text, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { themedStyles } from '../../../utils/themedStyles';

// a small form with one name box, used for adding a room or an item
// Alert.prompt only works on iOS, so this works on both
// props: visible, title, placeholder, onSave, onClose
// the screen gives it a new key each time it opens, so the box starts empty without an effect
function NameModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
  const [name, setName] = useState('');

  function handleSave() {
    if (name.trim() === '') {
      Alert.alert('Add a name', 'Type a name first.');
      return;
    }
    props.onSave(name.trim());
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'fade'}
      onRequestClose={props.onClose}
    >
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
            <PrimaryButton
              variant="secondary"
              title="Cancel"
              onPress={props.onClose}
              style={styles.cancel_button}
            />
            <PrimaryButton
              variant="primary"
              title="Add"
              onPress={handleSave}
              style={styles.save_button}
            />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default NameModal;

const styles = themedStyles((COLORS) => ({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  input: {
    ...list_styles.field_input,
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
  },
  save_button: {
    flex: 1,
    marginHorizontal: 0,
  },
}));

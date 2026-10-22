import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import DateField from '../../../components/DateField';
import { todayString } from '../../../utils/formatDate';
import { checklist_disclaimer } from '../utils/checklistHelpers';
import { COLORS, SPACING, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { themedStyles } from '../../../utils/themedStyles';

// props: visible, default_name, not_done (how many items aren't checked), onSign, onClose
// onSign gets the typed name and the date
// the screen gives it a new key each time it opens, so the name and date start fresh without an effect
function SignOffModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
  const [signed_by, setSignedBy] = useState(props.default_name || '');
  const [signed_on, setSignedOn] = useState(todayString());

  // unchecked items don't stop the sign-off, but I ask first since it locks for good
  function handleSign() {
    if (signed_by.trim() === '') {
      Alert.alert('Add a name', "Type the tenant's name to sign off.");
      return;
    }
    const message =
      props.not_done > 0
        ? props.not_done +
          (props.not_done === 1 ? ' item is' : ' items are') +
          ' not checked yet. Signing locks the checklist, so nothing can change after this.'
        : 'Signing locks the checklist, so nothing can change after this.';
    Alert.alert('Sign and lock?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign', onPress: () => props.onSign(signed_by.trim(), signed_on) },
    ]);
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
              <Text style={styles.heading}>Sign Off</Text>

              <Text style={styles.label}>Tenant name</Text>
              <TextInput
                style={styles.input}
                placeholder="Tenant types their full name"
                placeholderTextColor={COLORS.text_muted}
                value={signed_by}
                onChangeText={setSignedBy}
              />

              <Text style={styles.label}>Date</Text>
              <DateField value={signed_on} onChange={setSignedOn} />

              <Text style={styles.disclaimer}>{checklist_disclaimer}</Text>

              <View style={styles.button_row}>
                <PrimaryButton
                  variant="secondary"
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  variant="primary"
                  title="Sign"
                  icon="create-outline"
                  onPress={handleSign}
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

export default SignOffModal;

const styles = themedStyles((COLORS) => ({
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
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    ...list_styles.field_input,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  disclaimer: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginVertical: SPACING.sm,
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

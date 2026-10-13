import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import DateField from '../../../components/DateField';
import TextField from '../../../components/TextField';
import { todayString } from '../../../utils/formatDate';
import { checkEndDate, placeLabel } from '../utils/tenantHelpers';
import { COLORS, SPACING, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';

const max_note_length = 1000;

// a move-out date and an optional note, then a confirm, since ending a tenancy makes the tenant read-only
// props: visible, tenant, tenancy, onConfirm (gets ended_at and move_out_note, gives back a promise), onClose
// the screen gives it a new key each time it opens, so it starts on today without an effect
function EndTenancyModal(props) {
  const [ended_at, setEndedAt] = useState(todayString());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!props.tenancy) {
    return null;
  }
  const place = placeLabel(props.tenancy.property_name, props.tenancy.unit_label);

  function handleEnd() {
    const problem =
      checkEndDate(ended_at, props.tenancy.started_at, todayString()) ||
      (note.trim().length > max_note_length ? 'Keep the note under 1000 characters.' : null);
    setError(problem || '');
    if (problem) {
      return;
    }
    Alert.alert(
      'End tenancy?',
      props.tenant.name +
        ' moves out of ' +
        place +
        ' on ' +
        ended_at +
        '. Their messages and requests become read-only right away. This cannot be undone, but you can assign them again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Tenancy', style: 'destructive', onPress: runEnd },
      ],
    );
  }

  async function runEnd() {
    setBusy(true);
    try {
      await props.onConfirm(ended_at, note.trim());
    } catch (request_error) {
      console.log('Could not end the tenancy', request_error.message);
      setError(request_error.message);
    }
    setBusy(false);
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
              <Text style={styles.heading}>End Tenancy</Text>
              <Text style={styles.helper}>
                {props.tenant.name + ', ' + place + ', moved in ' + props.tenancy.started_at}
              </Text>

              <Text style={styles.label}>Move-out date</Text>
              <DateField value={ended_at} onChange={setEndedAt} />
              <Text style={styles.helper}>Up to 30 days from today.</Text>

              <TextField
                label="Note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Deposit returned in full"
                multiline
                maxLength={max_note_length}
                style={styles.note_input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.button_row}>
                <PrimaryButton
                  variant="secondary"
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  variant="destructive"
                  title={busy ? 'Ending...' : 'End Tenancy'}
                  onPress={busy ? undefined : handleEnd}
                  style={styles.end_button}
                />
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default EndTenancyModal;

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
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  note_input: {
    ...list_styles.field_input,
    minHeight: 70,
    textAlignVertical: 'top',
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
  end_button: {
    flex: 1,
    marginHorizontal: 0,
  },
});

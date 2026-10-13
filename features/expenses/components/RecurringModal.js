import { Modal, View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../../../theme';
import { formatDate } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

// props: visible, rules, onToggle, onDelete, onClose
function RecurringModal(props) {
  // ask first so a stray tap doesn't remove a rule, expenses it already made stay
  function confirmDelete(rule) {
    Alert.alert('Delete recurring expense', 'Expenses it already added stay in your list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => props.onDelete(rule.id) },
    ]);
  }

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll_content}>
          <Card>
            <Text style={styles.heading}>Recurring expenses</Text>
            {props.rules.length === 0 && (
              <Text style={styles.detail}>
                Nothing recurring yet. Pick Repeat when you add an expense.
              </Text>
            )}
            {props.rules.map((rule) => (
              <View key={rule.id} style={styles.rule_block}>
                <Text style={styles.rule_title}>
                  {formatCurrency(rule.template.amount)} · {rule.frequency}
                </Text>
                <Text style={styles.detail}>{rule.template.category}</Text>
                <Text style={styles.detail}>{rule.template.property}</Text>
                {rule.template.vendor ? (
                  <Text style={styles.detail}>{rule.template.vendor}</Text>
                ) : null}
                <Text style={styles.detail}>
                  {rule.active ? 'Next: ' + formatDate(rule.next_date) : 'Paused'}
                </Text>
                <View style={styles.button_row}>
                  <PrimaryButton
                    variant="secondary"
                    title={rule.active ? 'Pause' : 'Resume'}
                    onPress={() => props.onToggle(rule.id)}
                    style={styles.pause_button}
                  />
                  <PrimaryButton
                    variant="destructive"
                    title="Delete"
                    onPress={() => confirmDelete(rule)}
                    style={styles.delete_button}
                  />
                </View>
              </View>
            ))}
            <View style={styles.button_row}>
              <PrimaryButton
                variant="secondary"
                title="Close"
                onPress={props.onClose}
                style={styles.close_button}
              />
            </View>
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default RecurringModal;

const styles = StyleSheet.create({
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
    marginBottom: SPACING.sm,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  rule_block: {
    backgroundColor: COLORS.surface_sunken,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  rule_title: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  pause_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  delete_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  close_button: {
    flex: 1,
    marginHorizontal: 0,
  },
});

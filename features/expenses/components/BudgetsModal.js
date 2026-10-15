import { useState, useEffect } from 'react';
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
import { COLORS, SPACING, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';

// props: visible, properties (list of names), budgets (name to amount), onSave, onClose
function BudgetsModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
  // one text box per property, kept as text until I tap save
  const [budget_texts, setBudgetTexts] = useState({});

  // I fill the boxes from the saved budgets each time it opens
  useEffect(() => {
    if (!props.visible) {
      return;
    }
    const starting_texts = {};
    props.properties.forEach((name) => {
      starting_texts[name] = props.budgets[name] ? String(props.budgets[name]) : '';
    });
    setBudgetTexts(starting_texts);
  }, [props.visible]);

  // blank means no budget for that property, anything else has to be a real number
  function handleSave() {
    const new_budgets = {};
    for (const name of props.properties) {
      const text = (budget_texts[name] || '').trim();
      if (text === '') {
        continue;
      }
      const parsed = parseFloat(text);
      if (isNaN(parsed) || parsed < 0) {
        Alert.alert('Check the budget', 'Use a dollar amount for ' + name + ', or leave it blank.');
        return;
      }
      new_budgets[name] = parsed;
    }
    props.onSave(new_budgets);
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
    >
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
            <Text style={styles.heading}>Yearly budgets</Text>
            <Text style={styles.helper}>
              The budget applies to every year. Leave a property blank for no budget.
            </Text>
            {props.properties.map((name) => (
              <View key={name}>
                <Text style={styles.label}>{name}</Text>
                <CurrencyInput
                  style={styles.input}
                  placeholder="No budget"
                  value={budget_texts[name] || ''}
                  onChangeText={(text) =>
                    setBudgetTexts((current) => ({ ...current, [name]: text }))
                  }
                />
              </View>
            ))}
            <View style={styles.button_row}>
              <PrimaryButton
                variant="secondary"
                title="Cancel"
                onPress={props.onClose}
                style={styles.cancel_button}
              />
              <PrimaryButton
                variant="primary"
                title="Save"
                onPress={handleSave}
                style={styles.save_button}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default BudgetsModal;

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
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
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
});

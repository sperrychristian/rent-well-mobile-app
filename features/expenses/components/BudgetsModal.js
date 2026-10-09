import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// props: visible, properties (list of names), budgets (name to amount), onSave, onClose
function BudgetsModal(props) {
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
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
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
                <TextInput
                  style={styles.input}
                  placeholder="No budget"
                  placeholderTextColor={COLORS.text}
                  keyboardType="decimal-pad"
                  value={budget_texts[name] || ''}
                  onChangeText={(text) =>
                    setBudgetTexts((current) => ({ ...current, [name]: text }))
                  }
                />
              </View>
            ))}
            <View style={styles.button_row}>
              <PrimaryButton title="Cancel" onPress={props.onClose} style={styles.cancel_button} />
              <PrimaryButton title="Save" onPress={handleSave} style={styles.save_button} />
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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.md,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
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

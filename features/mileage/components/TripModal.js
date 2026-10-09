import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import DateField from '../../../components/DateField';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';
import { todayString } from '../../../utils/formatDate';

// props: visible, onSave, onClose, property_names, plus optional trip (edit mode), onDelete, default_property
function TripModal(props) {
  const trip_id = props.trip ? props.trip.id : null;

  const [date_text, setDateText] = useState(todayString());
  const [property, setProperty] = useState('');
  const [miles, setMiles] = useState('');
  const [purpose, setPurpose] = useState('');

  // I fill the form each time it opens, with the trip being edited or with blank defaults
  useEffect(() => {
    if (!props.visible) {
      return;
    }
    const existing = props.trip;
    setDateText(existing ? existing.date : todayString());
    setProperty(existing ? existing.property : props.default_property || '');
    setMiles(existing ? String(existing.miles) : '');
    setPurpose(existing ? existing.purpose || '' : '');
  }, [props.visible, trip_id]);

  // I check the miles and property first so an empty trip never gets saved
  function handleSave() {
    const parsed_miles = parseFloat(miles);
    if (isNaN(parsed_miles) || parsed_miles <= 0) {
      Alert.alert('Enter the miles', 'Type the miles driven, greater than zero.');
      return;
    }
    if (property.trim() === '') {
      Alert.alert('Add a property', 'Pick a property or type one in.');
      return;
    }
    props.onSave({
      date: date_text,
      property: property.trim(),
      miles: parsed_miles,
      purpose: purpose.trim(),
    });
  }

  const property_names = props.property_names || [];

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
            <Text style={styles.heading}>{props.trip ? 'Edit Trip' : 'Add Trip'}</Text>

            <Text style={styles.label}>Date</Text>
            <DateField value={date_text} onChange={setDateText} />

            <Text style={styles.label}>Property</Text>
            {property_names.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chip_row}
              >
                {property_names.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => setProperty(name)}
                    style={[styles.chip, property === name && styles.chip_active]}
                  >
                    <Text style={styles.chip_text}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={[styles.input, styles.input_after_chips]}
              placeholder="Pick one above or type a property"
              placeholderTextColor={COLORS.text}
              value={property}
              onChangeText={setProperty}
            />

            <Text style={styles.label}>Miles driven</Text>
            <TextInput
              style={styles.input}
              placeholder="Round trip, e.g. 14.5"
              placeholderTextColor={COLORS.text}
              keyboardType="decimal-pad"
              value={miles}
              onChangeText={setMiles}
            />

            <Text style={styles.label}>Purpose</Text>
            <TextInput
              style={styles.input}
              placeholder="Why did you go?"
              placeholderTextColor={COLORS.text}
              value={purpose}
              onChangeText={setPurpose}
            />

            <View style={styles.button_row}>
              <PrimaryButton title="Cancel" onPress={props.onClose} style={styles.cancel_button} />
              <PrimaryButton title="Save" onPress={handleSave} style={styles.save_button} />
            </View>
            {props.trip && props.onDelete && (
              <View style={styles.button_row}>
                <PrimaryButton
                  title="Delete Trip"
                  icon="trash-outline"
                  onPress={props.onDelete}
                  style={styles.delete_button}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default TripModal;

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
  input_after_chips: {
    marginTop: SPACING.sm,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
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
  delete_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.danger,
  },
});

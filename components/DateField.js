import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { stringToDate, dateToString } from '../utils/dateInput';
import { COLORS, SPACING, FONTS } from '../theme';

// value is a date text like 2026-10-07 and onChange gets the new date text back
function DateField(props) {
  // android can only open the picker as a dialog, so I open it by hand when the field is tapped
  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value: stringToDate(props.value),
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          props.onChange(dateToString(selected));
        }
      },
    });
  }

  // ios has a compact picker that sits right in the form, android doesn't, so the two platforms need different pieces
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.ios_row}>
        <DateTimePicker
          value={stringToDate(props.value)}
          mode="date"
          display="compact"
          onChange={(event, selected) => {
            if (selected) {
              props.onChange(dateToString(selected));
            }
          }}
        />
      </View>
    );
  }

  return (
    <Pressable style={styles.android_button} onPress={openAndroidPicker}>
      <Text style={styles.android_text}>{props.value}</Text>
    </Pressable>
  );
}

export default DateField;

const styles = StyleSheet.create({
  ios_row: {
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  android_button: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  android_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
  },
});

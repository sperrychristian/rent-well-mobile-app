import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { stringToDate, dateToString } from '../utils/dateInput';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../theme';

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
          // the app is navy now, so the compact picker uses its dark look to stay readable
          themeVariant="dark"
          accentColor={COLORS.cta}
          accessibilityLabel={'Date, ' + props.value}
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
    <Pressable
      style={styles.android_button}
      onPress={openAndroidPicker}
      accessibilityRole="button"
      accessibilityLabel={'Date, ' + props.value + ', tap to change'}
    >
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
    backgroundColor: COLORS.surface_sunken,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.thin,
    borderColor: COLORS.border,
    minHeight: SIZES.touch,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md - SPACING.xs,
    marginBottom: SPACING.sm,
  },
  android_text: {
    ...TYPE.body,
    color: COLORS.text,
  },
});

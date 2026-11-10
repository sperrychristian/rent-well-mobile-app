import { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Input from './Input';
import PrimaryButton from '../PrimaryButton';
import { useTheme } from '../../store/ThemeContext';
import { stringToDate, dateToString } from '../../util/dateInput';
import { todayString } from '../../util/formatDate';
import { COLORS, SPACING, SIZES, RADIUS, BORDER, OPACITY } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// a date you can type (YYYY-MM-DD) or pick: the calendar button opens the phone's own picker
// both feed the same onChangeText, so the form's state and its rules don't care which one was used
// props: label, value, onChangeText, invalid, errorText, helperText, minimumDate and maximumDate (YYYY-MM-DD text),
//   textInputRef, returnKeyType, onSubmitEditing
// iOS shows the picker inline under the box with a Done button, Android opens its dialog, the web just types

function looksLikeDate(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text || '') && !isNaN(stringToDate(text).getTime());
}

// the day the picker opens on: the typed date if it's a real one, otherwise today, kept inside the limits
function pickerStart(props) {
  let start = looksLikeDate(props.value) ? props.value : todayString();
  if (props.minimumDate && start < props.minimumDate) {
    start = props.minimumDate;
  }
  if (props.maximumDate && start > props.maximumDate) {
    start = props.maximumDate;
  }
  return stringToDate(start);
}

function DateInput(props) {
  const { is_dark } = useTheme();
  const [show_ios_picker, setShowIosPicker] = useState(false);
  const can_pick = Platform.OS === 'ios' || Platform.OS === 'android';
  const minimum = props.minimumDate ? stringToDate(props.minimumDate) : undefined;
  const maximum = props.maximumDate ? stringToDate(props.maximumDate) : undefined;

  // the picker gives back a local Date, dateToString reads the local calendar day so nothing shifts a day
  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerStart(props),
        mode: 'date',
        minimumDate: minimum,
        maximumDate: maximum,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            props.onChangeText(dateToString(selected));
          }
        },
      });
      return;
    }
    setShowIosPicker((current) => !current);
  }

  const calendar_button = can_pick ? (
    <Pressable
      onPress={openPicker}
      style={({ pressed }) => [styles.calendar_button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={'Pick ' + props.label.toLowerCase() + ' from a calendar'}
      accessibilityState={{ expanded: show_ios_picker }}
      testID="date-picker-button"
    >
      <Ionicons name="calendar-outline" size={SIZES.icon} color={COLORS.cta} />
    </Pressable>
  ) : null;

  return (
    <View>
      <Input
        label={props.label}
        invalid={props.invalid}
        errorText={props.errorText}
        helperText={
          can_pick ? props.helperText : props.helperText || 'Type the date as YYYY-MM-DD.'
        }
        accessory={calendar_button}
        style={show_ios_picker ? styles.no_gap : undefined}
        textInputConfig={{
          ref: props.textInputRef,
          value: props.value,
          onChangeText: props.onChangeText,
          placeholder: 'YYYY-MM-DD',
          maxLength: 10,
          keyboardType: Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default',
          autoCapitalize: 'none',
          autoCorrect: false,
          returnKeyType: props.returnKeyType,
          onSubmitEditing: props.onSubmitEditing,
          submitBehavior: props.returnKeyType === 'next' ? 'submit' : 'blurAndSubmit',
        }}
      />
      {show_ios_picker && (
        <View style={styles.ios_sheet} testID="ios-date-picker">
          <DateTimePicker
            value={pickerStart(props)}
            mode="date"
            display="inline"
            minimumDate={minimum}
            maximumDate={maximum}
            themeVariant={is_dark ? 'dark' : 'light'}
            accentColor={COLORS.cta}
            onChange={(event, selected) => {
              if (selected) {
                props.onChangeText(dateToString(selected));
              }
            }}
          />
          <PrimaryButton
            title="Done"
            variant="tertiary"
            size="small"
            onPress={() => setShowIosPicker(false)}
            accessibilityLabel="Close the calendar"
            style={styles.done_button}
          />
        </View>
      )}
    </View>
  );
}

export default DateInput;

const styles = themedStyles((COLORS) => ({
  calendar_button: {
    width: SIZES.touch,
    minHeight: SIZES.touch,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    backgroundColor: COLORS.surface_sunken,
  },
  pressed: {
    opacity: OPACITY.pressed,
    backgroundColor: COLORS.surface_raised,
  },
  no_gap: {
    marginBottom: SPACING.sm,
  },
  ios_sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  done_button: {
    alignSelf: 'flex-end',
    marginHorizontal: 0,
  },
}));

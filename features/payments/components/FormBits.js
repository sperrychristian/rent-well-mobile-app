import { View, Text, Image, Pressable, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Chip from '../../../components/ui/Chip';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import Button from '../../../components/ui/Button';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../../../theme';

// small pieces the payments forms share: a labeled field wrapper, a money box, a chip picker, and a receipt photo

// a label on top, the field, then its error (or a hint) underneath, same look as TextField
// props: label, error, helper, children
export function Field(props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      {props.children}
      {props.error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {props.error}
        </Text>
      ) : props.helper ? (
        <Text style={styles.helper}>{props.helper}</Text>
      ) : null}
    </View>
  );
}

// the money box inside a Field, red border when it has an error
// props: value, onChangeText, error, label (for screen readers), plus anything TextInput takes (ref, returnKeyType...)
export function MoneyField(props) {
  const { error, label, ...input_props } = props;
  return (
    <CurrencyInput
      {...input_props}
      accessibilityLabel={label + ', dollars'}
      accessibilityHint={error || undefined}
      placeholder="0.00"
      style={[styles.money_box, error && styles.box_error]}
    />
  );
}

// one choice from a short list, as chips that wrap
// props: options ([{ value, label }]), value, onChange, label (what the group is, for screen readers)
export function ChipPicker(props) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={props.label}>
      {props.options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={option.value === props.value}
          onPress={() => props.onChange(option.value)}
          style={styles.chip}
        />
      ))}
    </View>
  );
}

// a receipt photo: pick one from the library or take one, then a thumbnail with a remove button
// props: value ({ uri, mime_type } or null), onChange
export function ReceiptPicker(props) {
  async function choose() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      props.onChange({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' });
    }
  }

  // I have to ask for camera permission before the camera can open
  async function take() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const asset = result.assets[0];
      props.onChange({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' });
    }
  }

  if (props.value) {
    return (
      <View style={styles.receipt_row}>
        <Image
          source={{ uri: props.value.uri }}
          style={styles.thumb}
          accessibilityLabel="Receipt photo"
        />
        <Pressable
          onPress={() => props.onChange(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove the receipt photo"
          style={styles.remove}
        >
          <Ionicons name="close-circle" size={SIZES.icon} color={COLORS.danger_text} />
          <Text style={styles.remove_text}>Remove</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.receipt_buttons}>
      <Button
        variant="secondary"
        size="small"
        icon="images-outline"
        title="Choose Photo"
        onPress={choose}
        style={styles.receipt_button}
      />
      <Button
        variant="secondary"
        size="small"
        icon="camera-outline"
        title="Take Photo"
        onPress={take}
        style={styles.receipt_button}
      />
    </View>
  );
}

export const form_styles = StyleSheet.create({
  input: {
    ...TYPE.input,
    minHeight: SIZES.touch + SPACING.xs,
    backgroundColor: COLORS.surface_sunken,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.thin,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm + SPACING.xxs,
  },
  input_error: {
    borderColor: COLORS.danger_text,
  },
  note: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
});

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  error: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    marginTop: SPACING.xs,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
  money_box: {
    minHeight: SIZES.touch + SPACING.xs,
    backgroundColor: COLORS.surface_sunken,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.thin,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm + SPACING.xxs,
  },
  box_error: {
    borderColor: COLORS.danger_text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  chip: {
    marginRight: 0,
    marginBottom: 0,
  },
  receipt_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  thumb: {
    width: SIZES.thumb,
    height: SIZES.thumb,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface_raised,
  },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: SIZES.touch,
  },
  remove_text: {
    ...TYPE.label,
    color: COLORS.danger_text,
  },
  receipt_buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  receipt_button: {
    flex: 1,
    marginHorizontal: 0,
  },
});

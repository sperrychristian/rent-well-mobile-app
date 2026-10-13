import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import TextField from '../../../components/TextField';
import { checkPlace, unitSuggestions, placeLabel } from '../utils/tenantHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// picks a property and a unit for Move or Assign, then asks before doing it
// props: visible, title, confirm_word ('Move' or 'Assign'), tenant, moving_tenancy (null for assign),
// properties, invites, onConfirm (gets property_id and unit_label, gives back a promise), onClose
// the screen gives it a new key each time it opens, so it starts fresh without an effect
function PlaceModal(props) {
  const properties = props.properties || [];
  const [property_id, setPropertyId] = useState(properties.length > 0 ? properties[0].id : null);
  const [unit_label, setUnitLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestions = unitSuggestions(properties, props.invites || [], property_id);
  const picked = properties.find((property) => property.id === property_id);

  function handleConfirm() {
    const problem = checkPlace(props.tenant, property_id, unit_label, props.moving_tenancy);
    setError(problem || '');
    if (problem) {
      return;
    }
    const place = placeLabel(picked.name, unit_label.trim());
    const message = props.moving_tenancy
      ? 'Move ' +
        props.tenant.name +
        ' from ' +
        placeLabel(props.moving_tenancy.property_name, props.moving_tenancy.unit_label) +
        ' to ' +
        place +
        '? Their current tenancy ends today.'
      : 'Add ' + props.tenant.name + ' at ' + place + '?';
    Alert.alert(props.title + '?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: props.confirm_word, onPress: runConfirm },
    ]);
  }

  async function runConfirm() {
    setBusy(true);
    try {
      await props.onConfirm(property_id, unit_label.trim());
    } catch (request_error) {
      console.log('Could not save the tenancy', request_error.message);
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
              <Text style={styles.heading}>{props.title}</Text>
              {props.tenant && <Text style={styles.helper}>{props.tenant.name}</Text>}

              <Text style={styles.label}>Property</Text>
              {properties.length === 0 ? (
                <Text style={styles.helper}>Add a property first from the Properties screen.</Text>
              ) : (
                <View style={styles.wrap_row}>
                  {properties.map((property) => (
                    <Pressable
                      key={property.id}
                      onPress={() => setPropertyId(property.id)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={[styles.chip, property_id === property.id && styles.chip_active]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: property_id === property.id }}
                    >
                      <Text style={styles.chip_text}>{property.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {suggestions.length > 0 && (
                <View>
                  <Text style={styles.label}>Units in use</Text>
                  <View style={styles.wrap_row}>
                    {suggestions.map((label) => (
                      <Pressable
                        key={label}
                        onPress={() => setUnitLabel(label)}
                        hitSlop={{ top: 8, bottom: 8 }}
                        style={[styles.chip, unit_label === label && styles.chip_active]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.chip_text}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <TextField
                label="Unit (optional)"
                value={unit_label}
                onChangeText={setUnitLabel}
                placeholder="e.g. Unit 2B, or leave blank"
              />
              <Text style={styles.helper}>
                Roommates can share a unit. Leave it blank for a property without units.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.button_row}>
                <PrimaryButton
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  title={busy ? 'Saving...' : props.confirm_word}
                  text_color={COLORS.text_light}
                  onPress={busy || properties.length === 0 ? undefined : handleConfirm}
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

export default PlaceModal;

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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.xs,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  error: {
    color: COLORS.danger_text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  wrap_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
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
});

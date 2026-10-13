import { useState } from 'react';
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
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { checklist_types } from '../data/checklistTemplates';
import { COLORS, SPACING, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';

// props: visible, property_names, move_ins (signed move-in checklists), onCreate, onClose
// onCreate gets property, type, tenant, and move_in_id (null for a blank template)
// the screen gives it a new key each time it opens, so it starts as a blank form without an effect
function NewChecklistModal(props) {
  const [type, setType] = useState('Move-In');
  const [property, setProperty] = useState('');
  const [tenant, setTenant] = useState('');
  const [move_in_id, setMoveInId] = useState(null);

  function chooseType(option) {
    setType(option);
    // a move-in can't start from another move-in
    if (option === 'Move-In') {
      setMoveInId(null);
    }
  }

  // picking a move-in fills in its property and tenant so they match
  function chooseMoveIn(move_in) {
    if (move_in === null) {
      setMoveInId(null);
      return;
    }
    setMoveInId(move_in.id);
    setProperty(move_in.property);
    setTenant(move_in.tenant || '');
  }

  function handleCreate() {
    if (property.trim() === '') {
      Alert.alert('Add a property', 'Pick a property or type one in.');
      return;
    }
    props.onCreate({
      property: property.trim(),
      type: type,
      tenant: tenant.trim(),
      move_in_id: type === 'Move-Out' ? move_in_id : null,
    });
  }

  const property_names = props.property_names || [];
  const move_ins = props.move_ins || [];

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
              <Text style={styles.heading}>New Checklist</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.wrap_row}>
                {checklist_types.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => chooseType(option)}
                    hitSlop={{ top: 8, bottom: 8 }}
                    style={[styles.chip, type === option && styles.chip_active]}
                  >
                    <Text style={styles.chip_text}>{option}</Text>
                  </Pressable>
                ))}
              </View>

              {/* a move-out can copy a signed move-in so the conditions can be compared */}
              {type === 'Move-Out' && (
                <View>
                  <Text style={styles.label}>Start from</Text>
                  <View style={styles.wrap_row}>
                    <Pressable
                      onPress={() => chooseMoveIn(null)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={[styles.chip, move_in_id === null && styles.chip_active]}
                    >
                      <Text style={styles.chip_text}>Blank template</Text>
                    </Pressable>
                    {move_ins.map((move_in) => (
                      <Pressable
                        key={move_in.id}
                        onPress={() => chooseMoveIn(move_in)}
                        hitSlop={{ top: 8, bottom: 8 }}
                        style={[styles.chip, move_in_id === move_in.id && styles.chip_active]}
                      >
                        <Text style={styles.chip_text}>
                          {'Move-in, ' +
                            move_in.property +
                            (move_in.tenant ? ', ' + move_in.tenant : '') +
                            ', ' +
                            move_in.signed_on}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {move_ins.length === 0 && (
                    <Text style={styles.helper_block}>
                      Sign a move-in checklist first to compare against it.
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.label}>Property</Text>
              {property_names.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chip_scroll}
                  contentContainerStyle={styles.chip_row}
                >
                  {property_names.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setProperty(option)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={[styles.chip, property === option && styles.chip_active]}
                    >
                      <Text style={styles.chip_text}>{option}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <TextInput
                style={styles.input}
                placeholder="Pick one above or type an address"
                placeholderTextColor={COLORS.text_muted}
                value={property}
                onChangeText={setProperty}
              />

              <Text style={styles.label}>Tenant (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Tenant name"
                placeholderTextColor={COLORS.text_muted}
                value={tenant}
                onChangeText={setTenant}
              />

              <View style={styles.button_row}>
                <PrimaryButton
                  variant="secondary"
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton
                  variant="primary"
                  title="Create"
                  onPress={handleCreate}
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

export default NewChecklistModal;

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
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  helper_block: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  input: {
    ...list_styles.field_input,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  // without this the horizontal list grows to fill the spare height and the chips stretch with it
  chip_scroll: {
    flexGrow: 0,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  wrap_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chip: {
    ...list_styles.chip,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_text: {
    ...list_styles.chip_text,
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

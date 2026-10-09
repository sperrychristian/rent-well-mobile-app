import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Card from './Card';
import PrimaryButton from './PrimaryButton';
import DateField from './DateField';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';
import { expense_categories, payment_methods } from '../data/expenseOptions';
import { todayString } from '../utils/formatDate';

const repeat_options = ['None', 'Monthly', 'Yearly'];

// props: visible, onSave, onClose, plus optional expense (edit mode), onDelete, default_property, property_names,
// initial_receipts (a receipt photo taken first), and allow_extras (shows repeat and split, only the Expenses screen turns it on)
function AddExpenseModal(props) {
  const expense_id = props.expense ? props.expense.id : null;
  const is_editing = !!props.expense;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Repairs');
  const [date_text, setDateText] = useState(todayString());
  const [property, setProperty] = useState('');
  const [vendor, setVendor] = useState('');
  const [payment_method, setPaymentMethod] = useState('Card');
  const [is_capital, setIsCapital] = useState(false);
  const [billed_to_tenant, setBilledToTenant] = useState(false);
  const [recovered_text, setRecoveredText] = useState('');
  const [repeat, setRepeat] = useState('None');
  const [split_on, setSplitOn] = useState(false);
  const [split_properties, setSplitProperties] = useState([]);
  const [notes, setNotes] = useState('');
  const [receipts, setReceipts] = useState([]);
  // which receipt is open full size, null means none
  const [full_receipt, setFullReceipt] = useState(null);

  // I fill the form each time it opens, with the expense being edited or with blank defaults
  useEffect(() => {
    if (!props.visible) {
      return;
    }
    const existing = props.expense;
    setAmount(existing ? String(existing.amount) : '');
    setCategory(existing ? existing.category : 'Repairs');
    setDateText(existing ? existing.date : todayString());
    setProperty(existing ? existing.property : props.default_property || '');
    setVendor(existing ? existing.vendor || '' : '');
    setPaymentMethod(existing ? existing.payment_method || 'Card' : 'Card');
    setIsCapital(existing ? !!existing.is_capital : false);
    setBilledToTenant(existing ? !!existing.billed_to_tenant : false);
    setRecoveredText(existing && existing.recovered ? String(existing.recovered) : '');
    setRepeat('None');
    setSplitOn(false);
    setSplitProperties([]);
    setNotes(existing ? existing.notes || '' : '');
    setReceipts(existing ? existing.receipts || [] : props.initial_receipts || []);
    setFullReceipt(null);
  }, [props.visible, expense_id]);

  // I have to ask for camera permission before the camera can open
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      setReceipts((current) => [...current, result.assets[0].uri]);
    }
  }

  // the library lets me pick several receipts at once
  async function choosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceipts((current) => [...current, ...result.assets.map((asset) => asset.uri)]);
    }
  }

  function removeReceipt(index) {
    setReceipts((current) => current.filter((uri, uri_index) => uri_index !== index));
  }

  // tapping a property in the split list adds it or takes it back out
  function toggleSplitProperty(name) {
    setSplitProperties((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  // I check everything first so a bad amount or an empty property never gets saved
  function handleSave() {
    const use_split = props.allow_extras && !is_editing && split_on;

    const parsed_amount = parseFloat(amount);
    if (isNaN(parsed_amount) || parsed_amount <= 0) {
      Alert.alert('Enter an amount', 'Type a dollar amount greater than zero.');
      return;
    }
    if (use_split) {
      if (split_properties.length < 2) {
        Alert.alert('Pick two or more properties', 'A split needs at least two properties.');
        return;
      }
    } else if (property.trim() === '') {
      Alert.alert('Add a property', 'Pick a property or type one in.');
      return;
    }

    // recovered only counts when the expense is billed to a tenant, and it can't be more than the expense itself
    let parsed_recovered = 0;
    if (billed_to_tenant && !use_split && recovered_text.trim() !== '') {
      parsed_recovered = parseFloat(recovered_text);
      if (isNaN(parsed_recovered) || parsed_recovered < 0 || parsed_recovered > parsed_amount) {
        Alert.alert(
          'Check the recovered amount',
          'It has to be between zero and the expense amount.',
        );
        return;
      }
    }

    props.onSave({
      amount: parsed_amount,
      category: category,
      date: date_text,
      property: use_split ? '' : property.trim(),
      vendor: vendor.trim(),
      payment_method: payment_method,
      is_capital: is_capital,
      billed_to_tenant: use_split ? false : billed_to_tenant,
      recovered: parsed_recovered,
      notes: notes.trim(),
      receipts: receipts,
      repeat: props.allow_extras && !is_editing && !use_split ? repeat : 'None',
      split_properties: use_split ? split_properties : null,
    });
  }

  function handleCancel() {
    props.onClose();
  }

  const property_names = props.property_names || [];
  const show_extras = props.allow_extras && !is_editing;
  const splitting = show_extras && split_on;

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.root}>
        {/* iOS needs padding to lift the form, Android already resizes the window so it uses height */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* scroll view keeps Save reachable when the form is taller than the screen or the keyboard is open */}
          <ScrollView
            contentContainerStyle={styles.scroll_content}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <Text style={styles.heading}>{is_editing ? 'Edit Expense' : 'Add Expense'}</Text>

              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45.00"
                placeholderTextColor={COLORS.text}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chip_row}
              >
                {expense_categories.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[styles.chip, category === option && styles.chip_active]}
                  >
                    <Text style={styles.chip_text}>{option}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.switch_row}>
                <View style={styles.switch_text}>
                  <Text style={styles.label}>Capital improvement</Text>
                  <Text style={styles.helper}>
                    Repairs are deducted the year they happen. Improvements like a new roof or
                    appliance are usually depreciated over several years. Ask your accountant if you
                    are not sure.
                  </Text>
                </View>
                <Switch value={is_capital} onValueChange={setIsCapital} />
              </View>

              {show_extras && (
                <View style={styles.switch_row}>
                  <View style={styles.switch_text}>
                    <Text style={styles.label}>Split across properties</Text>
                    <Text style={styles.helper}>
                      Splits the amount equally. Each property gets its own expense.
                    </Text>
                  </View>
                  <Switch value={split_on} onValueChange={setSplitOn} />
                </View>
              )}

              <Text style={styles.label}>
                {splitting ? 'Properties to split across' : 'Property'}
              </Text>
              {property_names.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chip_row}
                >
                  {property_names.map((name) => {
                    const selected = splitting
                      ? split_properties.includes(name)
                      : property === name;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => (splitting ? toggleSplitProperty(name) : setProperty(name))}
                        style={[styles.chip, selected && styles.chip_active]}
                      >
                        <Text style={styles.chip_text}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {!splitting && (
                <TextInput
                  style={[styles.input, styles.input_after_chips]}
                  placeholder="Pick one above or type a property"
                  placeholderTextColor={COLORS.text}
                  value={property}
                  onChangeText={setProperty}
                />
              )}

              <Text style={[styles.label, styles.label_gap]}>Date</Text>
              <DateField value={date_text} onChange={setDateText} />

              {show_extras && !splitting && (
                <View>
                  <Text style={styles.label}>Repeat</Text>
                  <View style={styles.wrap_row}>
                    {repeat_options.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => setRepeat(option)}
                        style={[styles.chip, repeat === option && styles.chip_active]}
                      >
                        <Text style={styles.chip_text}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {repeat !== 'None' && (
                    <Text style={styles.helper_block}>
                      This saves today's expense and adds the next ones on their own. You can pause
                      or delete it under Recurring.
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.label}>Vendor</Text>
              <TextInput
                style={styles.input}
                placeholder="Who was paid?"
                placeholderTextColor={COLORS.text}
                value={vendor}
                onChangeText={setVendor}
              />

              <Text style={styles.label}>Payment method</Text>
              <View style={styles.wrap_row}>
                {payment_methods.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setPaymentMethod(option)}
                    style={[styles.chip, payment_method === option && styles.chip_active]}
                  >
                    <Text style={styles.chip_text}>{option}</Text>
                  </Pressable>
                ))}
              </View>

              {!splitting && (
                <View>
                  <View style={styles.switch_row}>
                    <View style={styles.switch_text}>
                      <Text style={styles.label}>Billed to tenant</Text>
                      <Text style={styles.helper}>
                        For damage or extra costs you charge to a tenant or their deposit.
                      </Text>
                    </View>
                    <Switch value={billed_to_tenant} onValueChange={setBilledToTenant} />
                  </View>
                  {billed_to_tenant && (
                    <TextInput
                      style={styles.input}
                      placeholder="Amount recovered so far (e.g. 50.00)"
                      placeholderTextColor={COLORS.text}
                      keyboardType="decimal-pad"
                      value={recovered_text}
                      onChangeText={setRecoveredText}
                    />
                  )}
                </View>
              )}

              <Text style={[styles.label, styles.label_gap]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notes_input]}
                placeholder="What was it for?"
                placeholderTextColor={COLORS.text}
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.label}>Receipts</Text>
              {receipts.length > 0 && (
                <View style={styles.wrap_row}>
                  {receipts.map((uri, index) => (
                    <View key={uri + index} style={styles.receipt_wrap}>
                      <Pressable onPress={() => setFullReceipt(uri)}>
                        <Image source={{ uri: uri }} style={styles.receipt_thumb} />
                      </Pressable>
                      <Pressable
                        style={styles.remove_button}
                        onPress={() => removeReceipt(index)}
                        accessibilityLabel="Remove receipt"
                      >
                        <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.button_row}>
                <PrimaryButton
                  title="Camera"
                  icon="camera-outline"
                  onPress={takePhoto}
                  style={styles.small_button}
                />
                <PrimaryButton
                  title="Library"
                  icon="image-outline"
                  onPress={choosePhotos}
                  style={styles.small_button}
                />
              </View>

              <View style={styles.button_row}>
                <PrimaryButton title="Cancel" onPress={handleCancel} style={styles.cancel_button} />
                <PrimaryButton title="Save" onPress={handleSave} style={styles.save_button} />
              </View>
              {/* delete only shows when editing, and the screen offers an undo right after */}
              {is_editing && props.onDelete && (
                <View style={styles.button_row}>
                  <PrimaryButton
                    title="Delete Expense"
                    icon="trash-outline"
                    onPress={props.onDelete}
                    style={styles.delete_button}
                  />
                </View>
              )}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
        {/* full size receipt sits on top of the form, tapping anywhere closes it */}
        {full_receipt && (
          <Pressable style={styles.full_overlay} onPress={() => setFullReceipt(null)}>
            <Image source={{ uri: full_receipt }} style={styles.full_photo} resizeMode="contain" />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default AddExpenseModal;

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
    marginBottom: SPACING.md,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  label_gap: {
    marginTop: SPACING.sm,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginRight: SPACING.sm,
  },
  helper_block: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
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
  notes_input: {
    minHeight: 70,
    textAlignVertical: 'top',
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
  switch_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  switch_text: {
    flex: 1,
  },
  receipt_wrap: {
    position: 'relative',
  },
  receipt_thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  remove_button: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  small_button: {
    flex: 1,
    marginHorizontal: 0,
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
  full_overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.photo_backdrop,
    justifyContent: 'center',
  },
  full_photo: {
    width: '100%',
    height: '100%',
  },
});

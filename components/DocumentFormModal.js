import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import PrimaryButton from './PrimaryButton';
import DateField from './DateField';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';
import { document_categories, dated_categories } from '../data/documentOptions';
import { todayString } from '../utils/formatDate';
import { addPeriod } from '../utils/recurring';
import { pickDocument } from '../utils/documentFiles';
import { nameFromFile, iconFor, formatSize } from '../utils/documentHelpers';

// props: visible, onSave, onClose, plus optional document (edit mode), initial_file (a scan taken first),
// default_name, default_category, default_property, and property_names
// onSave gets the document fields and the newly picked file, which is null when the file didn't change
function DocumentFormModal(props) {
  const document_id = props.document ? props.document.id : null;
  const is_editing = !!props.document;

  const [new_file, setNewFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Lease');
  const [property, setProperty] = useState('');
  const [tenant, setTenant] = useState('');
  const [has_end_date, setHasEndDate] = useState(true);
  const [expires_on, setExpiresOn] = useState(todayString());
  const [notes, setNotes] = useState('');
  const [shared_with_tenant, setSharedWithTenant] = useState(false);

  // I fill the form each time it opens, with the document being edited or with blank defaults
  useEffect(() => {
    if (!props.visible) {
      return;
    }
    const existing = props.document;
    const start_file = existing ? null : props.initial_file || null;
    const start_category = existing ? existing.category : props.default_category || 'Lease';
    setNewFile(start_file);
    setName(
      existing
        ? existing.name
        : props.default_name || (start_file ? nameFromFile(start_file.file_name) : ''),
    );
    setCategory(start_category);
    setProperty(existing ? existing.property : props.default_property || '');
    setTenant(existing ? existing.tenant || '' : '');
    // leases start with an end date on, addendums start with it off
    setHasEndDate(existing ? !!existing.expires_on : start_category === 'Lease');
    setExpiresOn(
      existing && existing.expires_on ? existing.expires_on : addPeriod(todayString(), 'Yearly'),
    );
    setNotes(existing ? existing.notes || '' : '');
    setSharedWithTenant(existing ? !!existing.shared_with_tenant : false);
  }, [props.visible, document_id]);

  // switching to Lease turns the end date on and switching to Addendum turns it off, picking the same one again changes nothing
  function chooseCategory(option) {
    if (option === category) {
      return;
    }
    setCategory(option);
    if (option === 'Lease') {
      setHasEndDate(true);
    } else if (option === 'Addendum') {
      setHasEndDate(false);
    }
  }

  async function chooseFile() {
    try {
      const picked = await pickDocument();
      if (!picked) {
        return;
      }
      setNewFile(picked);
      // the file name is a good starting name, but I don't overwrite one that's already typed
      if (name.trim() === '') {
        setName(nameFromFile(picked.file_name));
      }
    } catch (error) {
      console.log('Could not pick a file', error);
      Alert.alert('Could not open files', 'The file picker could not be opened.');
    }
  }

  // I check everything first so a document never gets saved without a file, name, or property
  function handleSave() {
    if (!is_editing && !new_file) {
      Alert.alert('Pick a file', 'Choose the file this document is for.');
      return;
    }
    if (name.trim() === '') {
      Alert.alert('Add a name', 'Give the document a short name, like Lease, Unit 2.');
      return;
    }
    if (property.trim() === '') {
      Alert.alert('Add a property', 'Pick a property or type one in.');
      return;
    }
    const uses_end_date = dated_categories.includes(category) && has_end_date;
    props.onSave(
      {
        name: name.trim(),
        category: category,
        property: property.trim(),
        tenant: tenant.trim(),
        expires_on: uses_end_date ? expires_on : null,
        notes: notes.trim(),
        shared_with_tenant: shared_with_tenant,
      },
      new_file,
    );
  }

  const property_names = props.property_names || [];
  // the file row shows the new pick if there is one, otherwise the file already on the document
  const shown_file = new_file || (props.document && !props.document.sample ? props.document : null);
  const is_sample = is_editing && props.document.sample && !new_file;

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
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
              <Text style={styles.heading}>{is_editing ? 'Edit Document' : 'Add Document'}</Text>

              <Text style={styles.label}>File</Text>
              {shown_file && (
                <View style={styles.file_row}>
                  <Ionicons name={iconFor(shown_file.mime_type)} size={22} color={COLORS.text} />
                  <View style={styles.file_text}>
                    <Text style={styles.file_name} numberOfLines={1}>
                      {shown_file.file_name}
                    </Text>
                    <Text style={styles.helper}>{formatSize(shown_file.size)}</Text>
                  </View>
                </View>
              )}
              {is_sample && (
                <Text style={styles.helper_block}>
                  Sample document, pick a file to attach a real one.
                </Text>
              )}
              <PrimaryButton
                title={shown_file ? 'Replace File' : 'Choose File'}
                icon="folder-open-outline"
                onPress={chooseFile}
                style={styles.file_button}
              />
              <Text style={styles.helper_block}>PDF, image, or Word file, up to 25 MB.</Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lease, Unit 2"
                placeholderTextColor={COLORS.text}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.wrap_row}>
                {document_categories.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => chooseCategory(option)}
                    style={[styles.chip, category === option && styles.chip_active]}
                  >
                    <Text style={styles.chip_text}>{option}</Text>
                  </Pressable>
                ))}
              </View>

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
                placeholderTextColor={COLORS.text}
                value={property}
                onChangeText={setProperty}
              />

              <Text style={styles.label}>Tenant (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Tenant name"
                placeholderTextColor={COLORS.text}
                value={tenant}
                onChangeText={setTenant}
              />

              {/* only leases and addendums run out, so only they get an end date */}
              {dated_categories.includes(category) && (
                <View>
                  <View style={styles.switch_row}>
                    <Text style={[styles.label, styles.switch_text]}>Has an end date</Text>
                    <Switch value={has_end_date} onValueChange={setHasEndDate} />
                  </View>
                  {has_end_date && <DateField value={expires_on} onChange={setExpiresOn} />}
                </View>
              )}

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notes_input]}
                placeholder="Anything worth remembering"
                placeholderTextColor={COLORS.text}
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              {/* just a flag for now, the tenant side will read it later */}
              <View style={styles.switch_row}>
                <Text style={[styles.label, styles.switch_text]}>Share with tenant</Text>
                <Switch value={shared_with_tenant} onValueChange={setSharedWithTenant} />
              </View>

              <View style={styles.button_row}>
                <PrimaryButton
                  title="Cancel"
                  onPress={props.onClose}
                  style={styles.cancel_button}
                />
                <PrimaryButton title="Save" onPress={handleSave} style={styles.save_button} />
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default DocumentFormModal;

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
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
  },
  helper_block: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  file_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  file_text: {
    flex: 1,
  },
  file_name: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  file_button: {
    marginHorizontal: 0,
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
  notes_input: {
    minHeight: 70,
    textAlignVertical: 'top',
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
    marginBottom: 0,
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

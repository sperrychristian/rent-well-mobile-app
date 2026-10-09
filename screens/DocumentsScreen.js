import { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import DocumentDetailModal from '../components/DocumentDetailModal';
import DocumentFormModal from '../components/DocumentFormModal';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { todayString } from '../utils/formatDate';
import {
  saveDocumentFile,
  deleteDocumentFile,
  openDocument,
  fileFromPhoto,
} from '../utils/documentFiles';
import { iconFor, expiryTag, daysUntil } from '../utils/documentHelpers';
import { document_categories, expiring_soon_days } from '../data/documentOptions';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';

const sort_options = ['Newest', 'Name'];

function DocumentsScreen() {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { documents, properties, demo_mode, addDocument, updateDocument, deleteDocument } =
    useWorkOrders();

  const [property_filter, setPropertyFilter] = useState('All');
  const [category_filter, setCategoryFilter] = useState('All');
  const [sort_by, setSortBy] = useState('Newest');
  const [search_text, setSearchText] = useState('');
  // detail_id stays set while the detail modal slides away, detail_open is what shows or hides it
  const [detail_id, setDetailId] = useState(null);
  const [detail_open, setDetailOpen] = useState(false);
  // the form is open when form_open is true, editing_id says which document it edits, null means a new one
  const [form_open, setFormOpen] = useState(false);
  const [editing_id, setEditingId] = useState(null);
  // a scanned photo gets attached to the new document when the form opens
  const [prefill_file, setPrefillFile] = useState(null);
  const [default_name, setDefaultName] = useState('');
  const [default_category, setDefaultCategory] = useState('Lease');
  // set when Edit is tapped in the detail view, so the form opens once the detail modal is gone
  const pending_edit = useRef(false);

  // the shared property list plus any property that only shows up on a document
  const property_names = [
    ...new Set([...properties, ...documents.map((document) => document.property)]),
  ]
    .filter(Boolean)
    .sort();

  // the property filter applies to the summary and the list, category and search only change the list
  const property_documents = documents.filter(
    (document) => property_filter === 'All' || document.property === property_filter,
  );

  const search_lower = search_text.trim().toLowerCase();
  const list_documents = property_documents
    .filter(
      (document) =>
        (category_filter === 'All' || document.category === category_filter) &&
        (search_lower === '' ||
          document.name.toLowerCase().includes(search_lower) ||
          (document.tenant || '').toLowerCase().includes(search_lower) ||
          document.property.toLowerCase().includes(search_lower) ||
          (document.notes || '').toLowerCase().includes(search_lower)),
    )
    .sort((a, b) => {
      if (sort_by === 'Name') {
        return a.name.localeCompare(b.name);
      }
      return b.added_at.localeCompare(a.added_at) || b.id.localeCompare(a.id);
    });

  // leases that end between today and the cutoff, already expired ones don't count here
  const expiring_count = property_documents.filter((document) => {
    if (document.category !== 'Lease' || !document.expires_on) {
      return false;
    }
    const days = daysUntil(document.expires_on);
    return days >= 0 && days <= expiring_soon_days;
  }).length;

  const detail_document = documents.find((document) => document.id === detail_id);
  const editing_document = documents.find((document) => document.id === editing_id);

  function openNewForm() {
    setEditingId(null);
    setPrefillFile(null);
    setDefaultName('');
    setDefaultCategory('Lease');
    setFormOpen(true);
  }

  // camera first, then the form opens with the photo already attached
  async function scanDocument() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) {
      return;
    }
    const scan_name = 'Scan ' + todayString();
    const photo_file = fileFromPhoto(result.assets[0], scan_name + '.jpg');
    if (!photo_file) {
      return;
    }
    setEditingId(null);
    setPrefillFile(photo_file);
    setDefaultName(scan_name);
    setDefaultCategory('Other');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function openDetail(document_id) {
    setDetailId(document_id);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  function openPendingEdit() {
    if (!pending_edit.current) {
      return;
    }
    pending_edit.current = false;
    setEditingId(detail_id);
    setPrefillFile(null);
    setFormOpen(true);
  }

  // iOS drops a second modal that opens while the first is still sliding away, so the form waits for the detail modal's onDismiss
  // onDismiss only fires on iOS, so android gets a short timer instead, and pending_edit makes sure only one of them opens the form
  function editFromDetail() {
    pending_edit.current = true;
    setDetailOpen(false);
    if (Platform.OS !== 'ios') {
      setTimeout(openPendingEdit, 350);
    }
  }

  function confirmDelete() {
    const document = detail_document;
    if (!document) {
      return;
    }
    Alert.alert(
      'Delete document?',
      document.sample
        ? 'This removes the sample document.'
        : 'This removes the document and its file from this phone. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDetailOpen(false);
            deleteDocument(document.id);
          },
        },
      ],
    );
  }

  // the file gets copied in first, and only once that works does the document get saved
  async function handleSave(fields, new_file) {
    let file_fields = {};
    if (new_file) {
      try {
        const stored_name = await saveDocumentFile(new_file.uri, new_file.file_name, demo_mode);
        file_fields = {
          stored_name: stored_name,
          file_name: new_file.file_name,
          mime_type: new_file.mime_type,
          size: new_file.size,
          sample: false,
        };
      } catch (error) {
        console.log('Could not save document file', error);
        Alert.alert('Could not save the file', 'The file could not be copied into the app.');
        return;
      }
    }

    if (editing_document) {
      updateDocument(editing_document.id, { ...fields, ...file_fields });
      // the old file goes only after the new one is safely copied in
      if (new_file && !editing_document.sample) {
        deleteDocumentFile(editing_document.stored_name, demo_mode);
      }
    } else {
      addDocument({ ...fields, ...file_fields });
    }

    // I clear the filters so the saved document doesn't vanish from the list
    setPropertyFilter('All');
    setCategoryFilter('All');
    setSearchText('');
    closeForm();
  }

  // the summary and filters scroll with the list so they don't eat the screen in landscape
  const list_header = (
    <View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Add Document"
          icon="add-circle-outline"
          style={styles.add_button}
          onPress={openNewForm}
        />
        <PrimaryButton
          title="Scan"
          icon="camera-outline"
          style={styles.scan_button}
          onPress={scanDocument}
        />
      </View>

      <Text style={styles.section_label}>Property</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {['All', ...property_names].map((name) => (
          <Pressable
            key={name}
            onPress={() => setPropertyFilter(name)}
            style={[styles.chip, property_filter === name && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section_label}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {['All', ...document_categories].map((option) => (
          <Pressable
            key={option}
            onPress={() => setCategoryFilter(option)}
            style={[styles.chip, category_filter === option && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <Text style={styles.summary_label}>Documents</Text>
        <Text style={styles.summary_total}>{property_documents.length}</Text>
        <Text style={[styles.detail, expiring_count > 0 && styles.warning_text]}>
          {expiring_count === 0
            ? 'No leases expire in the next ' + expiring_soon_days + ' days'
            : expiring_count +
              (expiring_count === 1 ? ' lease expires' : ' leases expire') +
              ' in the next ' +
              expiring_soon_days +
              ' days'}
        </Text>
      </Card>

      <TextInput
        style={styles.search_input}
        placeholder="Search name, tenant, property, or notes"
        placeholderTextColor={COLORS.text}
        value={search_text}
        onChangeText={setSearchText}
        autoCorrect={false}
      />
      <View style={styles.sort_row}>
        <Text style={styles.sort_label}>Sort</Text>
        {sort_options.map((option) => (
          <Pressable
            key={option}
            onPress={() => setSortBy(option)}
            style={[styles.chip, sort_by === option && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Documents</ScreenTitle>
      <FlatList
        data={list_documents}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={<Text style={styles.empty_text}>No documents match</Text>}
        renderItem={({ item }) => {
          const tag = expiryTag(item.expires_on);
          return (
            <Pressable style={styles.row} onPress={() => openDetail(item.id)}>
              <Ionicons
                name={iconFor(item.mime_type)}
                size={28}
                color={COLORS.text}
                style={styles.row_icon}
              />
              <View style={styles.row_text}>
                <Text style={styles.row_name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.row_category}>{item.category}</Text>
                <Text style={styles.detail}>{item.property}</Text>
                {item.tenant ? <Text style={styles.detail}>{item.tenant}</Text> : null}
                <Text style={styles.detail}>Added {item.added_at}</Text>
                <View style={styles.tag_row}>
                  {tag && (
                    <View
                      style={[styles.tag, tag.expired ? styles.expired_tag : styles.expiring_tag]}
                    >
                      <Text style={styles.tag_text}>{tag.text}</Text>
                    </View>
                  )}
                  {item.shared_with_tenant && (
                    <View style={[styles.tag, styles.shared_tag]}>
                      <Text style={styles.tag_text}>Shared with tenant</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <DocumentDetailModal
        visible={detail_open}
        document={detail_document}
        in_demo={demo_mode}
        onOpen={() => detail_document && openDocument(detail_document, demo_mode)}
        onEdit={editFromDetail}
        onDelete={confirmDelete}
        onClose={closeDetail}
        onDismiss={openPendingEdit}
      />
      <DocumentFormModal
        visible={form_open}
        document={editing_document}
        initial_file={prefill_file}
        default_name={default_name}
        default_category={default_category}
        default_property={property_filter !== 'All' ? property_filter : ''}
        property_names={property_names}
        onSave={handleSave}
        onClose={closeForm}
      />
    </View>
  );
}

export default DocumentsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  add_button: {
    flex: 1,
    backgroundColor: COLORS.success,
    marginHorizontal: 0,
  },
  scan_button: {
    flex: 1,
    backgroundColor: COLORS.action,
    marginHorizontal: 0,
  },
  section_label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.muted,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  summary_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  summary_total: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 32,
    marginVertical: 4,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  warning_text: {
    color: COLORS.warning,
    fontFamily: FONTS.body_bold,
    opacity: 1,
  },
  search_input: {
    backgroundColor: COLORS.muted,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  sort_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sort_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row_icon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  row_text: {
    flex: 1,
  },
  row_name: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  row_category: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
    marginTop: 2,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
  },
  expiring_tag: {
    backgroundColor: COLORS.warning,
  },
  expired_tag: {
    backgroundColor: COLORS.danger,
  },
  shared_tag: {
    backgroundColor: COLORS.action,
  },
  tag_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 11,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});

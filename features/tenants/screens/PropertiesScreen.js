import { useState, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import HeaderIconButton from '../../../components/HeaderIconButton';
import PropertyFormModal from '../components/PropertyFormModal';
import { useTenants } from '../context/TenantsContext';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// the owner's properties: add, rename, change the address, or delete one nobody uses anymore
function PropertiesScreen(props) {
  const insets = useSafeAreaInsets();
  const {
    mode,
    status,
    error_message,
    refreshing,
    properties,
    refresh,
    addProperty,
    updateProperty,
    deleteProperty,
  } = useTenants();
  // the form is open when form_open is true, editing is the property it edits, null means a new one
  const [form_open, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // goes up every time the form opens, the new key gives the form a fresh start
  const [form_key, setFormKey] = useState(0);
  const [deleting_id, setDeletingId] = useState(null);

  // the header's Add button opens the same form as the Add Property button, so it's set here where the form lives
  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          icon="add-circle-outline"
          label="Add a property"
          onPress={() => {
            setFormKey((current) => current + 1);
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ),
    });
  }, [props.navigation]);

  function openForm(property) {
    setFormKey((current) => current + 1);
    setEditing(property);
    setFormOpen(true);
  }

  async function saveProperty(name, address) {
    if (editing) {
      await updateProperty(editing.id, { name: name, address: address });
    } else {
      await addProperty(name, address);
    }
    setFormOpen(false);
  }

  // the server says no while someone lives there or a work order is open, and its message says which
  function confirmDelete(property) {
    Alert.alert(
      'Delete ' + property.name + '?',
      'It disappears from your lists and any pending invites to it stop working. Past tenancies and resolved work orders keep its name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(property.id);
            try {
              await deleteProperty(property.id);
            } catch (error) {
              Alert.alert("Can't delete " + property.name, error.message);
            }
            setDeletingId(null);
          },
        },
      ],
    );
  }

  let body;
  if (status === 'loading' && properties.length === 0) {
    body = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
  } else if (status === 'error' && properties.length === 0) {
    body = <ErrorState message={error_message} onRetry={refresh} />;
  } else {
    body = (
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        refreshControl={
          mode === 'real' ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.title} />
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={styles.empty_text}>No properties yet. Add your first one above.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {/* tapping the name side opens the property's details, the icons on the right still edit and delete */}
            <Pressable
              style={styles.row_text}
              onPress={() => props.navigation.navigate('PropertyDetail', { propertyId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + item.name}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.detail}>{item.address}</Text>
              <Text style={styles.detail}>
                {item.tenancies.length === 0
                  ? 'Nobody lives here right now'
                  : item.tenancies.length +
                    (item.tenancies.length === 1 ? ' current tenant' : ' current tenants')}
              </Text>
            </Pressable>
            {deleting_id === item.id ? (
              <ActivityIndicator color={COLORS.title} />
            ) : (
              <View style={styles.row_buttons}>
                <Pressable
                  onPress={() => openForm(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={'Edit ' + item.name}
                >
                  <Ionicons name="create-outline" size={22} color={COLORS.action} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={'Delete ' + item.name}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <PrimaryButton
        title="Add Property"
        icon="add-circle-outline"
        text_color={COLORS.text_light}
        onPress={() => openForm(null)}
        style={styles.add_button}
      />
      {error_message && properties.length > 0 ? (
        <View style={styles.offline_banner}>
          <Text style={styles.offline_text}>
            {error_message + ' Showing the last list, pull down to try again.'}
          </Text>
        </View>
      ) : null}
      {body}
      <PropertyFormModal
        key={form_key}
        visible={form_open}
        property={editing}
        onSave={saveProperty}
        onClose={() => setFormOpen(false)}
      />
    </View>
  );
}

export default PropertiesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  add_button: {
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.success,
  },
  spinner: {
    marginTop: SPACING.lg,
  },
  offline_banner: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  offline_text: {
    color: COLORS.text_dark,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row_text: {
    flex: 1,
  },
  row_buttons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  name: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});

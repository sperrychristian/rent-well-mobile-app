import { useState, useLayoutEffect } from 'react';
import {
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
import { useLedger } from '../../payments/context/LedgerContext';
import { useTenants } from '../context/TenantsContext';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import { themedStyles } from '../../../utils/themedStyles';

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
  const ledger_store = useLedger();
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

  // the payment instructions go through the ledger store (PATCH /properties/:id with paymentInstructions in
  // real mode, the demo's own copy in the demo), and only when they changed
  async function saveProperty(name, address, instructions) {
    let property_id = editing ? editing.id : null;
    if (editing) {
      await updateProperty(editing.id, { name: name, address: address });
    } else {
      const added = await addProperty(name, address);
      property_id = added ? added.id : null;
    }
    if (property_id && instructions !== instructionsFor(editing)) {
      await ledger_store.setPaymentInstructions(property_id, instructions);
    }
    setFormOpen(false);
  }

  // the text the form opens with: what the ledger store knows, or what the property came back with
  function instructionsFor(property) {
    if (!property) {
      return '';
    }
    const from_ledger = ledger_store.instructionsFor(property.id);
    return from_ledger !== undefined ? from_ledger : property.payment_instructions || '';
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
    body = <SkeletonList rows={3} />;
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
          // the onboarding pass: the same Add Property form as the button above, right in the empty state
          <EmptyState
            illustration="empty_properties"
            title="No properties yet"
            message="Add the first place you rent out. Tenants, rent, and repairs all hang off a property."
            action_label="Add Property"
            action_icon="add-circle-outline"
            onAction={() => openForm(null)}
          />
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
              <View style={styles.name_row}>
                <View style={styles.icon_square}>
                  <Ionicons name="home-outline" size={18} color={COLORS.cta} />
                </View>
                <Text style={styles.name}>{item.name}</Text>
              </View>
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
                  hitSlop={4}
                  style={styles.icon_button}
                  accessibilityRole="button"
                  accessibilityLabel={'Edit ' + item.name}
                >
                  <Ionicons name="create-outline" size={22} color={COLORS.cta} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={4}
                  style={styles.icon_button}
                  accessibilityRole="button"
                  accessibilityLabel={'Delete ' + item.name}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.danger_text} />
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
        variant="primary"
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
        instructions={instructionsFor(editing)}
        onSave={saveProperty}
        onClose={() => setFormOpen(false)}
      />
    </View>
  );
}

export default PropertiesScreen;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    // the fintech pass: capped and centered on a tablet so lines stay a readable length
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
  },
  add_button: {
    marginHorizontal: 0,
    marginBottom: SPACING.md,
  },
  spinner: {
    marginTop: SPACING.lg,
  },
  offline_banner: {
    ...list_styles.offline_banner,
  },
  offline_text: {
    ...list_styles.offline_text,
  },
  row: {
    ...list_styles.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  row_text: {
    flex: 1,
  },
  row_buttons: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  name: {
    ...TYPE.subheading,
    color: COLORS.text,
    flexShrink: 1,
  },
  detail: {
    ...list_styles.detail,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
  name_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  // the Hearth pass: just the green line icon, no tinted square
  icon_square: {
    width: SIZES.row_icon,
    alignItems: 'center',
  },
  // edit and delete are full 44pt circles so they are easy to hit
  icon_button: {
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import TextField from '../../../components/TextField';
import ErrorState from '../../../components/ErrorState';
import { useTenants } from '../../tenants/context/TenantsContext';
import { pendingInvites, formatInviteCode, inviteShareText } from '../utils/inviteHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

function InviteTenantScreen() {
  const insets = useSafeAreaInsets();

  // properties and invites come from the shared tenants data, so this works the same in the demo and for real
  const {
    status: tenants_status,
    error_message,
    properties,
    invites,
    refresh,
    addProperty,
    createInvite,
  } = useTenants();
  // loading, ready, or error for the first load of properties and invites
  const status = tenants_status;
  const [picked_property_id, setPropertyId] = useState(null);
  // the add property form shows on its own when there are no properties yet
  const [adding_property, setAddingProperty] = useState(false);
  const [property_name, setPropertyName] = useState('');
  const [property_address, setPropertyAddress] = useState('');
  const [tenant_name, setTenantName] = useState('');
  const [unit_label, setUnitLabel] = useState('');
  const [field_errors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [created_invite, setCreatedInvite] = useState(null);

  // the first property is picked until another one is tapped
  const property_id =
    picked_property_id && properties.some((property) => property.id === picked_property_id)
      ? picked_property_id
      : properties.length > 0
        ? properties[0].id
        : null;
  const show_property_form = adding_property || properties.length === 0;

  function retry() {
    refresh();
  }

  function propertyName(id) {
    const property = properties.find((item) => item.id === id);
    return property ? property.name : '';
  }

  async function handleAddProperty() {
    const errors = {};
    if (property_name.trim() === '' || property_name.trim().length > 120) {
      errors.name = 'Enter a property name (up to 120 characters).';
    }
    if (property_address.trim() === '' || property_address.trim().length > 300) {
      errors.address = 'Enter the address (up to 300 characters).';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const property = await addProperty(property_name.trim(), property_address.trim());
      setPropertyId(property.id);
      setAddingProperty(false);
      setPropertyName('');
      setPropertyAddress('');
    } catch (error) {
      setFieldErrors(error.field_errors || {});
      Alert.alert('Property not added', error.message);
    }
    setBusy(false);
  }

  async function handleCreateInvite() {
    const errors = {};
    if (!property_id) {
      errors.property = 'Pick a property first.';
    }
    if (tenant_name.trim() === '' || tenant_name.trim().length > 100) {
      errors.tenantName = "Enter the tenant's name (up to 100 characters).";
    }
    if (unit_label.trim().length > 50) {
      errors.unitLabel = 'Keep the unit under 50 characters.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const invite = await createInvite({
        property_id: property_id,
        tenant_name: tenant_name.trim(),
        unit_label: unit_label.trim(),
      });
      setCreatedInvite(invite);
      setTenantName('');
      setUnitLabel('');
    } catch (error) {
      setFieldErrors(error.field_errors || {});
      Alert.alert('Invite not created', error.message);
    }
    setBusy(false);
  }

  async function shareInvite(invite) {
    try {
      await Share.share({ message: inviteShareText(invite, propertyName(invite.propertyId)) });
    } catch (error) {
      console.log('Could not open the share sheet', error.message);
    }
  }

  let content;
  if (status === 'loading') {
    content = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
  } else if (status === 'error') {
    content = <ErrorState message={error_message} onRetry={retry} />;
  } else {
    const pending = pendingInvites(invites);
    content = (
      <View>
        {/* the newest code stays up top until another invite is made */}
        {created_invite && (
          <Card>
            <Text style={styles.label}>Invite code for {created_invite.tenantName}</Text>
            <Text style={styles.code} selectable>
              {formatInviteCode(created_invite.code)}
            </Text>
            <Text style={styles.helper}>
              Works once. Expires {created_invite.expiresAt.slice(0, 10)}.
            </Text>
            <PrimaryButton
              title="Share Code"
              icon="share-outline"
              text_color={COLORS.text_light}
              onPress={() => shareInvite(created_invite)}
              style={styles.share_button}
            />
          </Card>
        )}

        <Card>
          <Text style={styles.heading}>{show_property_form ? 'Add a Property' : 'New Invite'}</Text>
          {show_property_form ? (
            <View>
              {properties.length === 0 && (
                <Text style={styles.helper_block}>
                  Add the property first, then you can invite its tenants.
                </Text>
              )}
              <TextField
                label="Property name"
                value={property_name}
                onChangeText={setPropertyName}
                error={field_errors.name}
                placeholder="e.g. Maple Court"
              />
              <TextField
                label="Address"
                value={property_address}
                onChangeText={setPropertyAddress}
                error={field_errors.address}
                placeholder="e.g. 12 Maple St, Springfield"
              />
              <View style={styles.button_row}>
                {properties.length > 0 && (
                  <PrimaryButton
                    title="Cancel"
                    onPress={() => {
                      setAddingProperty(false);
                      setFieldErrors({});
                    }}
                    style={styles.cancel_button}
                  />
                )}
                <PrimaryButton
                  title={busy ? 'Saving...' : 'Add Property'}
                  text_color={COLORS.text_light}
                  onPress={busy ? undefined : handleAddProperty}
                  style={styles.save_button}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Property</Text>
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
                <Pressable
                  onPress={() => {
                    setAddingProperty(true);
                    setFieldErrors({});
                  }}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={styles.chip}
                  accessibilityRole="button"
                >
                  <Text style={styles.chip_text}>+ Add property</Text>
                </Pressable>
              </View>
              {field_errors.property ? (
                <Text style={styles.error}>{field_errors.property}</Text>
              ) : null}
              <TextField
                label="Tenant name"
                value={tenant_name}
                onChangeText={setTenantName}
                error={field_errors.tenantName}
                placeholder="Full name"
              />
              <TextField
                label="Unit (optional)"
                value={unit_label}
                onChangeText={setUnitLabel}
                error={field_errors.unitLabel}
                placeholder="e.g. Unit 2B"
              />
              <PrimaryButton
                title={busy ? 'Creating...' : 'Create Invite'}
                icon="person-add-outline"
                text_color={COLORS.text_light}
                onPress={busy ? undefined : handleCreateInvite}
                style={styles.create_button}
              />
            </View>
          )}
        </Card>

        <Text style={styles.section_label}>Pending invites</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty_text}>No pending invites.</Text>
        ) : (
          pending.map((invite) => (
            <View key={invite.id} style={styles.invite_row}>
              <View style={styles.invite_text}>
                <Text style={styles.invite_code}>{formatInviteCode(invite.code)}</Text>
                <Text style={styles.detail}>{invite.tenantName}</Text>
                <Text style={styles.detail}>
                  {propertyName(invite.propertyId) +
                    (invite.unitLabel ? ', ' + invite.unitLabel : '')}
                </Text>
                <Text style={styles.detail}>Expires {invite.expiresAt.slice(0, 10)}</Text>
              </View>
              <Pressable
                onPress={() => shareInvite(invite)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={'Share invite for ' + invite.tenantName}
              >
                <Ionicons name="share-outline" size={24} color={COLORS.action} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    );
  }

  return (
    // iOS needs padding to lift the form, Android already resizes the window
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <ScreenTitle>Invite a Tenant</ScreenTitle>
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default InviteTenantScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.md,
  },
  spinner: {
    marginTop: SPACING.lg,
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
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
  helper_block: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 13,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  code: {
    color: COLORS.title,
    fontFamily: FONTS.heading,
    fontSize: 34,
    letterSpacing: 3,
    textAlign: 'center',
    marginVertical: SPACING.sm,
  },
  share_button: {
    marginTop: SPACING.md,
    marginHorizontal: 0,
    backgroundColor: COLORS.action,
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
  error: {
    color: COLORS.danger,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
    marginBottom: SPACING.sm,
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
  create_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.success,
  },
  section_label: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    opacity: 0.7,
    marginLeft: SPACING.xs,
  },
  invite_row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  invite_text: {
    flex: 1,
  },
  invite_code: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    letterSpacing: 1,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
});

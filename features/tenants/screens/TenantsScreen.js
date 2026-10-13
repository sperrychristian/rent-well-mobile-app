import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import ErrorState from '../../../components/ErrorState';
import { useTenants } from '../context/TenantsContext';
import { groupByProperty, splitActivePast, placeLabel } from '../utils/tenantHelpers';
import {
  pendingInvites,
  formatInviteCode,
  inviteShareText,
} from '../../invites/utils/inviteHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// every tenant by property and unit, the invites still waiting, and the past tenants folded away
function TenantsScreen(props) {
  const insets = useSafeAreaInsets();
  const {
    mode,
    status,
    error_message,
    refreshing,
    tenants,
    properties,
    invites,
    refresh,
    revokeInvite,
    resendInvite,
  } = useTenants();
  // past tenants start folded so the current ones are what you see first
  const [show_past, setShowPast] = useState(false);
  // the invite a button is working on, so a double tap can't send two requests
  const [busy_invite_id, setBusyInviteId] = useState(null);

  // a property's detail screen can open this showing only that property, the chip up top clears it
  const [only_property_id, setOnlyPropertyId] = useState(
    props.route && props.route.params && props.route.params.propertyId
      ? props.route.params.propertyId
      : null,
  );
  const only_property = only_property_id
    ? properties.find((property) => property.id === only_property_id)
    : null;

  const sections = groupByProperty(tenants, properties).filter(
    (section) => !only_property_id || section.property_id === only_property_id,
  );
  const { past } = splitActivePast(tenants);
  const pending = pendingInvites(invites).filter(
    (invite) => !only_property_id || invite.propertyId === only_property_id,
  );
  const shown_past = past.filter(
    (tenant) =>
      !only_property_id ||
      tenant.ended_tenancies.some((tenancy) => tenancy.property_id === only_property_id),
  );

  function propertyName(property_id) {
    const property = properties.find((item) => item.id === property_id);
    return property ? property.name : '';
  }

  function openTenant(tenant_id) {
    props.navigation.navigate('TenantDetail', { tenantId: tenant_id });
  }

  async function shareCode(invite) {
    try {
      await Share.share({ message: inviteShareText(invite, propertyName(invite.propertyId)) });
    } catch (error) {
      console.log('Could not open the share sheet', error.message);
    }
  }

  function confirmRevoke(invite) {
    Alert.alert(
      'Revoke invite?',
      'The code ' + formatInviteCode(invite.code) + ' for ' + invite.tenantName + ' stops working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setBusyInviteId(invite.id);
            try {
              await revokeInvite(invite.id);
            } catch (error) {
              Alert.alert('Invite not revoked', error.message);
            }
            setBusyInviteId(null);
          },
        },
      ],
    );
  }

  // a resend makes a brand new code, so the old one stops working and the new one is offered to share
  function confirmResend(invite) {
    Alert.alert(
      'Resend invite?',
      'This makes a new code for ' +
        invite.tenantName +
        ' that lasts 7 days. The old code ' +
        formatInviteCode(invite.code) +
        ' stops working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resend',
          onPress: async () => {
            setBusyInviteId(invite.id);
            try {
              const fresh = await resendInvite(invite.id);
              Alert.alert(
                'New code: ' + formatInviteCode(fresh.code),
                'Share it with the tenant.',
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'Share', onPress: () => shareCode(fresh) },
                ],
              );
            } catch (error) {
              Alert.alert('Invite not resent', error.message);
            }
            setBusyInviteId(null);
          },
        },
      ],
    );
  }

  function tenantRow(tenant, tenancy, key) {
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => openTenant(tenant.id)}
        accessibilityRole="button"
        accessibilityLabel={
          tenant.name +
          (tenancy ? ', ' + placeLabel(tenancy.property_name, tenancy.unit_label) : '')
        }
      >
        <View style={styles.row_text}>
          <Text style={styles.row_name}>{tenant.name}</Text>
          {tenancy ? (
            <Text style={styles.detail}>Moved in {tenancy.started_at}</Text>
          ) : tenant.ended_tenancies.length > 0 ? (
            <Text style={styles.detail}>
              {'Moved out ' +
                tenant.ended_tenancies[0].ended_at +
                ', ' +
                placeLabel(
                  tenant.ended_tenancies[0].property_name,
                  tenant.ended_tenancies[0].unit_label,
                )}
            </Text>
          ) : null}
        </View>
        {tenant.open_work_order_count > 0 && (
          <View style={styles.count_tag}>
            <Ionicons name="construct-outline" size={12} color={COLORS.text_light} />
            <Text style={styles.count_text}>{tenant.open_work_order_count}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
      </Pressable>
    );
  }

  let body;
  if (status === 'loading' && tenants.length === 0 && properties.length === 0) {
    body = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
  } else if (status === 'error' && tenants.length === 0 && properties.length === 0) {
    body = <ErrorState message={error_message} onRetry={refresh} />;
  } else {
    body = (
      <View>
        {only_property_id ? (
          <Pressable
            onPress={() => setOnlyPropertyId(null)}
            style={styles.only_chip}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Show tenants at every property"
          >
            <Text style={styles.small_button_text}>
              {'Only ' + (only_property ? only_property.name : only_property_id) + '  ✕'}
            </Text>
          </Pressable>
        ) : null}
        {/* the list on screen is the last one that loaded, pulling down tries again */}
        {error_message ? (
          <View style={styles.offline_banner}>
            <Text style={styles.offline_text}>
              {error_message + ' Showing the last list, pull down to try again.'}
            </Text>
          </View>
        ) : null}

        {sections.length === 0 && (
          <Text style={styles.empty_text}>
            No properties or tenants yet. Add a property, then invite your first tenant.
          </Text>
        )}

        {sections.map((section) => (
          <View key={section.property_id} style={styles.section}>
            <Text style={styles.section_title}>{section.property_name}</Text>
            {section.units.length === 0 ? (
              <Text style={styles.vacant}>Nobody lives here right now.</Text>
            ) : (
              section.units.map((unit) => (
                <View key={unit.unit_label || 'no-unit'} style={styles.unit}>
                  {unit.unit_label ? (
                    <Text style={styles.unit_label}>{unit.unit_label}</Text>
                  ) : null}
                  {unit.rows.map((row) => tenantRow(row.tenant, row.tenancy, row.tenancy.id))}
                </View>
              ))
            )}
          </View>
        ))}

        <Text style={styles.group_title}>Pending invites ({pending.length})</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty_small}>No invites waiting.</Text>
        ) : (
          pending.map((invite) => (
            <View key={invite.id} style={styles.invite_row}>
              <View style={styles.row_text}>
                <Text style={styles.row_name}>{invite.tenantName}</Text>
                <Text style={styles.detail}>
                  {placeLabel(propertyName(invite.propertyId), invite.unitLabel)}
                </Text>
                <Text style={styles.detail}>
                  {formatInviteCode(invite.code) + ' · expires ' + invite.expiresAt.slice(0, 10)}
                </Text>
              </View>
              {busy_invite_id === invite.id ? (
                <ActivityIndicator color={COLORS.title} />
              ) : (
                <View style={styles.invite_buttons}>
                  <Pressable
                    onPress={() => confirmResend(invite)}
                    hitSlop={8}
                    style={styles.small_button}
                    accessibilityRole="button"
                    accessibilityLabel={'Resend invite for ' + invite.tenantName}
                  >
                    <Text style={styles.small_button_text}>Resend</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmRevoke(invite)}
                    hitSlop={8}
                    style={[styles.small_button, styles.revoke_button]}
                    accessibilityRole="button"
                    accessibilityLabel={'Revoke invite for ' + invite.tenantName}
                  >
                    <Text style={styles.small_button_text}>Revoke</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}

        <Pressable
          onPress={() => setShowPast((current) => !current)}
          style={styles.past_header}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: show_past }}
        >
          <Text style={styles.group_title}>Past Tenants ({shown_past.length})</Text>
          <Ionicons
            name={show_past ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={COLORS.text}
          />
        </Pressable>
        {show_past &&
          (shown_past.length === 0 ? (
            <Text style={styles.empty_small}>No past tenants.</Text>
          ) : (
            shown_past.map((tenant) => tenantRow(tenant, null, tenant.id))
          ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      {/* only shows while the demo is running */}
      <DemoBanner />
      <ScreenTitle>Tenants</ScreenTitle>
      <View style={styles.header_buttons}>
        <PrimaryButton
          title="Invite a Tenant"
          icon="person-add-outline"
          text_color={COLORS.text_light}
          onPress={() => props.navigation.navigate('InviteTenant')}
          style={styles.invite_button}
        />
        <PrimaryButton
          title="Properties"
          icon="home-outline"
          text_color={COLORS.text_light}
          onPress={() => props.navigation.navigate('Properties')}
          style={styles.properties_button}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        refreshControl={
          mode === 'real' ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.title} />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
    </View>
  );
}

export default TenantsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  header_buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  invite_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
  properties_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.action,
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
  section: {
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  section_title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.xs,
  },
  vacant: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.7,
  },
  unit: {
    marginTop: SPACING.xs,
  },
  unit_label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    opacity: 0.8,
    marginTop: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  row_text: {
    flex: 1,
  },
  row_name: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: 15,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 13,
    opacity: 0.8,
  },
  count_tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  count_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  group_title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  invite_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  invite_buttons: {
    gap: SPACING.xs,
  },
  small_button: {
    backgroundColor: COLORS.action,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  revoke_button: {
    backgroundColor: COLORS.danger,
  },
  small_button_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  only_chip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  past_header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
  empty_small: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.7,
  },
});

import { useEffect, useRef, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../../components/PrimaryButton';
import Button from '../../../components/ui/Button';
import SectionHeader from '../../../components/ui/SectionHeader';
import EmptyState from '../../../components/ui/EmptyState';
import { useToast } from '../../../components/ui/Toast';
import { useTenants } from '../context/TenantsContext';
import { placeLabel } from '../utils/tenantHelpers';
import LeaseBlock from '../../leases/components/LeaseBlock';
import LeaseFormSheet from '../../leases/components/LeaseFormSheet';
import RenewLeaseSheet from '../../leases/components/RenewLeaseSheet';
import { useLeaseActions } from '../../leases/hooks/useLeaseActions';
import { leaseEventLine } from '../../leases/utils/leaseHelpers';
import { hapticSuccess } from '../../../utils/haptics';
import { todayString } from '../../../utils/formatDate';
import { onSocketEvent } from '../../../services/socket';
import { SPACING, TYPE, SIZES, BORDER } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// stub for the assignment: it gets only the tenant's id, shows their name when the tenants data has them,
// and the id otherwise, then links to the Documents screen where leases live today
// the leases pass made it real: it opens one tenancy's lease (tenancyId from Leases or a push tap, or tenantId
// from Tenant Profile, which picks their current tenancy), with Set, Edit, and Renew, and the lease's timeline
function TenantLeaseScreen(props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { getTenantById, findTenancy, fetchLease, is_demo } = useTenants();
  const actions = useLeaseActions();
  const params = props.route.params || {};
  const tenant_id = params.tenantId || null;
  const today = todayString();

  // tenancyId wins, a tenantId opens their current tenancy (or their latest one if they moved out)
  const found = pickTenancy(params, findTenancy, getTenantById);
  const tenant = found ? found.tenant : tenant_id ? getTenantById(tenant_id) : null;
  const tenancy = found ? found.tenancy : null;
  const tenancy_id = tenancy ? tenancy.id : null;
  // the lease changes after every save (and after tenancy:updated), so the timeline catches up on its own
  const lease_key = tenancy ? JSON.stringify(tenancy.lease) : '';

  const [events, setEvents] = useState([]);
  const [sheet, setSheet] = useState(null);
  // coming back to the screen or a lease change on another phone asks for the timeline again
  const [reload_count, setReloadCount] = useState(0);
  // the provider makes a new fetchLease on every render, so the effect reads the newest one from here
  const fetch_ref = useRef(fetchLease);
  useEffect(() => {
    fetch_ref.current = fetchLease;
  });

  useEffect(
    () => props.navigation.addListener('focus', () => setReloadCount((count) => count + 1)),
    [props.navigation],
  );

  // a lease changed on another phone comes in as tenancy:updated
  useEffect(() => {
    if (is_demo) {
      return undefined;
    }
    return onSocketEvent('tenancy:updated', () => setReloadCount((count) => count + 1));
  }, [is_demo]);

  // the timeline comes from the lease route, so it reloads when the screen comes back and after a change
  useEffect(() => {
    if (!tenancy_id) {
      return undefined;
    }
    let showing = true;
    fetch_ref
      .current(tenancy_id)
      .then((result) => {
        if (showing) {
          setEvents(result.events);
        }
      })
      .catch((error) => console.log('Could not load the lease timeline', error.message));
    return () => {
      showing = false;
    };
  }, [tenancy_id, lease_key, reload_count]);

  if (!tenancy) {
    return (
      <View style={styles.container}>
        <EmptyState
          illustration="empty_leases"
          title="No rental found"
          message="This tenant doesn't have a rental here, so there's no lease to show."
        />
      </View>
    );
  }

  const lease = tenancy.lease;
  const place = placeLabel(tenancy.property_name, tenancy.unit_label);
  const is_active = tenancy.status === 'active';
  const has_lease = lease.lease_status !== 'none';

  async function saveLease(value) {
    await actions.setLease(tenancy.id, value);
    setSheet(null);
    hapticSuccess();
    toast.show('Lease saved', 'checkmark-circle-outline');
  }

  async function renewLease(value) {
    await actions.renewLease(tenancy.id, value);
    setSheet(null);
    hapticSuccess();
    toast.show('Lease renewed', 'checkmark-circle-outline');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
    >
      <Text style={styles.name_line}>{tenant ? tenant.name : 'Tenant'}</Text>
      <Text style={styles.place}>{place + (is_active ? '' : ', moved out')}</Text>

      <SectionHeader title="Lease" />
      <LeaseBlock lease={lease} today={today} show_notes />

      {/* only a current tenancy's lease can change, an ended one is history */}
      {is_active ? (
        <View style={styles.actions}>
          <Button
            variant={has_lease ? 'secondary' : 'primary'}
            icon={has_lease ? 'create-outline' : 'add-circle-outline'}
            title={has_lease ? 'Edit Lease' : 'Set Lease'}
            onPress={() => setSheet('edit')}
            style={styles.action}
          />
          {has_lease ? (
            <Button
              variant="primary"
              icon="refresh-outline"
              title="Renew"
              onPress={() => setSheet('renew')}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : null}

      {events.length > 0 ? (
        <>
          <SectionHeader title="History" />
          {/* newest first, each one a plain ruled line with its date */}
          {[...events].reverse().map((event) => (
            <View key={event.id} style={styles.event}>
              <Text style={styles.event_text}>{leaseEventLine(event, today)}</Text>
              <Text style={styles.event_date}>
                {event.created_at ? event.created_at.slice(0, 10) : ''}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      <PrimaryButton
        title="Open Documents"
        icon="document-text-outline"
        variant="secondary"
        onPress={() => props.navigation.navigate('Documents')}
        style={styles.documents_button}
      />

      {sheet === 'edit' ? (
        <LeaseFormSheet
          visible
          place={place}
          lease={lease}
          today={today}
          onSubmit={saveLease}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'renew' ? (
        <RenewLeaseSheet
          visible
          place={place}
          lease={lease}
          current_rent_cents={actions.currentRentCents(tenancy.id)}
          today={today}
          onSubmit={renewLease}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </ScrollView>
  );
}

// the tenancy to show: tenancyId first, then the tenant's current one, then their latest past one
function pickTenancy(params, findTenancy, getTenantById) {
  if (params.tenancyId) {
    const by_id = findTenancy(params.tenancyId);
    if (by_id) {
      return by_id;
    }
  }
  const tenant = params.tenantId ? getTenantById(params.tenantId) : null;
  const tenancy = tenant ? tenant.active_tenancies[0] || tenant.ended_tenancies[0] : null;
  return tenant && tenancy ? { tenant, tenancy } : null;
}

export default TenantLeaseScreen;

const styles = themedStyles((COLORS) => ({
  // the header has the screen's title now, so the name gets its own plain line instead of the big card
  name_line: {
    ...TYPE.title,
    color: COLORS.title,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  place: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.xxs,
    marginBottom: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  action: {
    flex: 1,
    marginHorizontal: 0,
  },
  event: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  event_text: {
    ...TYPE.body_small,
    color: COLORS.text,
    flex: 1,
  },
  event_date: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
  documents_button: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    marginHorizontal: 0,
    marginTop: SPACING.lg,
  },
}));

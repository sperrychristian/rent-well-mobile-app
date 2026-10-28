import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import PlaceModal from '../components/PlaceModal';
import EndTenancyModal from '../components/EndTenancyModal';
import { useTenants } from '../context/TenantsContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { ordersForTenantRecord, activeCount } from '../../workOrders/utils/workOrderHelpers';
import { useMessages } from '../../messages/context/MessagesContext';
import { openConversationFor } from '../../messages/utils/openConversation';
import { placeLabel, findMoveInChecklist } from '../utils/tenantHelpers';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import Avatar from '../../../components/ui/Avatar';
import StatusLabel from '../../../components/ui/StatusLabel';
import { themedStyles } from '../../../utils/themedStyles';

// one tenant: how to reach them, where they live now, their work orders, where they lived before,
// and the owner's actions (message, move, assign, end)
function TenantDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const tenant_id = props.route.params.tenantId;
  const {
    tenants,
    properties,
    invites,
    getTenantById,
    fetchTenantDetail,
    assignTenant,
    moveTenancy,
    endTenancy,
  } = useTenants();
  // the work orders come from the shared store too, so a status change on Work Order Detail shows here right away
  const { checklists, addChecklist, orders, is_remote, orders_status } = useWorkOrders();
  const { conversations } = useMessages();

  // the fresh copy from the server, with the recent work orders the list doesn't have
  const [detail, setDetail] = useState(null);
  const [load_error, setLoadError] = useState('');
  // goes up after Try Again and after every change, so the detail loads again
  const [load_count, setLoadCount] = useState(0);
  // which form is open: null, 'assign', 'move', or 'end', and the tenancy it's for
  const [form, setForm] = useState(null);
  const [form_tenancy, setFormTenancy] = useState(null);
  // goes up every time a form opens, the new key gives the form a fresh start
  const [form_key, setFormKey] = useState(0);

  // the context hands out a new function every render, so the effect reads the latest one from here
  const fetch_detail = useRef(fetchTenantDetail);
  useEffect(() => {
    fetch_detail.current = fetchTenantDetail;
  });

  // the list copy updates live from tenancy:updated, so when it changes I get the work orders again too
  const list_tenant = getTenantById(tenant_id);
  const list_version = list_tenant
    ? list_tenant.active_tenancies.length + ':' + list_tenant.ended_tenancies.length
    : '';
  useEffect(() => {
    let active = true;
    fetch_detail
      .current(tenant_id)
      .then((result) => {
        if (active) {
          setDetail(result);
          setLoadError('');
        }
      })
      .catch((error) => {
        console.log('Could not load the tenant', error.message);
        if (active) {
          setLoadError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [tenant_id, load_count, list_version, tenants.length]);

  const tenant = list_tenant || (detail ? detail.tenant : null);

  if (!tenant) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: SPACING.md }]}>
        {load_error ? (
          <ErrorState message={load_error} onRetry={() => setLoadCount((current) => current + 1)} />
        ) : detail === null ? (
          <ActivityIndicator color={COLORS.title} size="large" />
        ) : (
          <ErrorState
            message="That tenant could not be found."
            onRetry={() => props.navigation.goBack()}
          />
        )}
      </View>
    );
  }

  // the shared state pass: the count and the rows read the one work order list everyone else reads,
  // and only fall back to the server's detail copy while the real-mode list is still loading
  const shared_orders =
    !is_remote || orders_status === 'ready' ? ordersForTenantRecord(orders, tenant) : null;
  const recent = shared_orders
    ? shared_orders.slice(0, 10)
    : detail
      ? detail.recent_work_orders
      : [];
  const open_work_order_count = shared_orders
    ? activeCount(shared_orders)
    : tenant.open_work_order_count;

  function openForm(kind, tenancy) {
    setFormKey((current) => current + 1);
    setFormTenancy(tenancy);
    setForm(kind);
  }

  function closeForm() {
    setForm(null);
  }

  // the owner can still message a former tenant, like about the deposit
  function openMessages() {
    if (tenant.conversation_id) {
      props.navigation.navigate('MessageThread', { conversationId: tenant.conversation_id });
    } else {
      openConversationFor(props.navigation, conversations, tenant.name, tenant.id);
    }
  }

  async function handleAssign(property_id, unit_label) {
    await assignTenant(tenant.id, property_id, unit_label);
    closeForm();
    setLoadCount((current) => current + 1);
  }

  async function handleMove(property_id, unit_label) {
    await moveTenancy(form_tenancy.id, { property_id: property_id, unit_label: unit_label });
    closeForm();
    setLoadCount((current) => current + 1);
  }

  // once it's ended I offer the move-out checklist, built from their signed move-in when there is one
  async function handleEnd(ended_at, move_out_note) {
    const ended = form_tenancy;
    await endTenancy(ended.id, { ended_at: ended_at, move_out_note: move_out_note });
    closeForm();
    setLoadCount((current) => current + 1);
    const move_in = findMoveInChecklist(
      checklists,
      ended.property_name,
      ended.unit_label,
      tenant.name,
    );
    Alert.alert(
      'Tenancy ended',
      move_in
        ? 'Start a Move-Out checklist? It copies the signed Move-In from ' +
            move_in.signed_on +
            ' so you can compare the condition.'
        : 'Start a Move-Out checklist for ' +
            placeLabel(ended.property_name, ended.unit_label) +
            '?',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Start Checklist',
          onPress: () => {
            const checklist_id = addChecklist({
              property: placeLabel(ended.property_name, ended.unit_label),
              type: 'Move-Out',
              tenant: tenant.name,
              move_in_id: move_in ? move_in.id : null,
            });
            props.navigation.navigate('ChecklistDetail', { checklistId: checklist_id });
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.lg,
          paddingHorizontal: SPACING.md,
        }}
      >
        {/* the tenant's initials over their name, the same avatar the Tenants list uses */}
        <View style={styles.identity}>
          <Avatar name={tenant.name} size={64} />
          <Text style={styles.name_line}>{tenant.name}</Text>
        </View>

        <Card>
          <View style={styles.top_line}>
            <Text style={styles.heading}>Contact</Text>
            <StatusLabel
              label={tenant.is_active ? 'Current' : 'Past tenant'}
              tone={tenant.is_active ? 'Active' : 'Ended'}
            />
          </View>
          {tenant.email ? (
            <Pressable
              onPress={() => Linking.openURL('mailto:' + tenant.email).catch(() => {})}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.link}>{tenant.email}</Text>
            </Pressable>
          ) : (
            <Text style={styles.detail}>No email</Text>
          )}
        </Card>

        <Card>
          <Text style={styles.heading}>Current home</Text>
          {tenant.active_tenancies.length === 0 && (
            <Text style={styles.detail}>No active tenancy. Assign them to a property below.</Text>
          )}
          {tenant.active_tenancies.map((tenancy) => (
            <View key={tenancy.id} style={styles.tenancy}>
              {/* tapping the place opens that property's details */}
              <Pressable
                onPress={() =>
                  props.navigation.navigate('PropertyDetail', { propertyId: tenancy.property_id })
                }
                hitSlop={8}
                style={styles.link_row}
                accessibilityRole="link"
                accessibilityLabel={
                  'Open property ' + placeLabel(tenancy.property_name, tenancy.unit_label)
                }
              >
                <Text style={[styles.place, styles.place_link]}>
                  {placeLabel(tenancy.property_name, tenancy.unit_label)}
                </Text>
                <Ionicons name="chevron-forward-outline" size={16} color={COLORS.cta} />
              </Pressable>
              <Text style={styles.detail}>Moved in {tenancy.started_at}</Text>
              {/* their rent: balance, charges, and payments for this home */}
              <Pressable
                onPress={() => props.navigation.navigate('TenantLedger', { tenancyId: tenancy.id })}
                hitSlop={8}
                style={styles.link_row}
                accessibilityRole="link"
                accessibilityLabel={
                  'Open the rent ledger for ' +
                  placeLabel(tenancy.property_name, tenancy.unit_label)
                }
              >
                <Text style={styles.link}>Rent Ledger</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={COLORS.cta} />
              </Pressable>
              <View style={styles.button_row}>
                <PrimaryButton
                  title="Move"
                  icon="swap-horizontal-outline"
                  variant="secondary"
                  onPress={() => openForm('move', tenancy)}
                  style={styles.move_button}
                />
                <PrimaryButton
                  title="End Tenancy"
                  icon="exit-outline"
                  variant="destructive"
                  onPress={() => openForm('end', tenancy)}
                  style={styles.end_button}
                />
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.heading}>Work orders</Text>
          <Text style={styles.detail}>
            {open_work_order_count === 0
              ? 'No open work orders.'
              : open_work_order_count +
                (open_work_order_count === 1 ? ' open work order' : ' open work orders')}
          </Text>
          {recent.map((order) => (
            <View key={order.id} style={styles.order_row}>
              <Text style={styles.order_title} numberOfLines={1}>
                {order.title}
              </Text>
              <StatusLabel label={order.status} />
            </View>
          ))}
          <Pressable
            onPress={() => props.navigation.navigate('WorkOrders', { tenantId: tenant.id })}
            hitSlop={8}
            style={styles.link_row}
            accessibilityRole="link"
          >
            <Text style={styles.link}>View in Work Orders</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={COLORS.cta} />
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.heading}>History</Text>
          {tenant.ended_tenancies.length === 0 && (
            <Text style={styles.detail}>No past tenancies.</Text>
          )}
          {tenant.ended_tenancies.map((tenancy) => (
            <View key={tenancy.id} style={styles.tenancy}>
              <Text style={styles.place}>
                {placeLabel(tenancy.property_name, tenancy.unit_label)}
              </Text>
              <Text style={styles.detail}>{tenancy.started_at + ' to ' + tenancy.ended_at}</Text>
              {tenancy.move_out_note ? (
                <Text style={styles.note}>{tenancy.move_out_note}</Text>
              ) : null}
            </View>
          ))}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton
            title="Message"
            icon="chatbubble-ellipses-outline"
            variant="primary"
            onPress={openMessages}
            style={styles.message_button}
          />
          <PrimaryButton
            title="Lease and Documents"
            icon="document-text-outline"
            variant="secondary"
            onPress={() => props.navigation.navigate('TenantLease', { tenantId: tenant.id })}
            style={styles.lease_button}
          />
          <PrimaryButton
            title="Assign to a Property"
            icon="add-circle-outline"
            variant="secondary"
            onPress={() => openForm('assign', null)}
            style={styles.assign_button}
          />
        </View>
        {tenant.is_active && (
          <Text style={styles.helper}>
            Assign adds another home without ending this one, like for a roommate setup or a second
            unit.
          </Text>
        )}
      </ScrollView>

      <PlaceModal
        key={'place-' + form_key}
        visible={form === 'assign' || form === 'move'}
        title={form === 'move' ? 'Move to Another Unit' : 'Assign to a Property'}
        confirm_word={form === 'move' ? 'Move' : 'Assign'}
        tenant={tenant}
        moving_tenancy={form === 'move' ? form_tenancy : null}
        properties={properties}
        invites={invites}
        onConfirm={form === 'move' ? handleMove : handleAssign}
        onClose={closeForm}
      />
      <EndTenancyModal
        key={'end-' + form_key}
        visible={form === 'end'}
        tenant={tenant}
        tenancy={form === 'end' ? form_tenancy : null}
        onConfirm={handleEnd}
        onClose={closeForm}
      />
    </View>
  );
}

export default TenantDetailScreen;

const styles = themedStyles((COLORS) => ({
  // the header has the screen's title now, so the name gets its own plain line instead of the big card
  name_line: {
    ...TYPE.title,
    color: COLORS.title,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  detail: {
    ...list_styles.detail,
  },
  note: {
    ...TYPE.body_small,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: SPACING.xxs,
  },
  link: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.cta,
  },
  link_row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZES.touch,
    marginTop: SPACING.xs,
  },
  tenancy: {
    marginTop: SPACING.sm,
  },
  place: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  order_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs + SPACING.xxs,
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.border,
  },
  order_title: {
    ...TYPE.body_small,
    flex: 1,
    color: COLORS.text,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  move_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  end_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  actions: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  message_button: {
    marginHorizontal: 0,
  },
  place_link: {
    color: COLORS.cta,
  },
  lease_button: {
    marginHorizontal: 0,
  },
  assign_button: {
    marginHorizontal: 0,
  },
  helper: {
    ...TYPE.caption,
    width: '100%',
    alignSelf: 'center',
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
  identity: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
}));

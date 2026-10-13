import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import PlaceModal from '../components/PlaceModal';
import EndTenancyModal from '../components/EndTenancyModal';
import { useTenants } from '../context/TenantsContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { placeLabel, findMoveInChecklist } from '../utils/tenantHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// one tenant: how to reach them, where they live now, their work orders, where they lived before,
// and the owner's actions (message, move, assign, end)
function TenantDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const tenant_id = props.route.params.tenant_id;
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
  const { checklists, addChecklist } = useWorkOrders();

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
      <View style={[styles.container, styles.center, { paddingTop: insets.top + SPACING.md }]}>
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

  const recent = detail ? detail.recent_work_orders : [];

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
      props.navigation.navigate('MessageThread', { conversation_id: tenant.conversation_id });
    } else {
      props.navigation.navigate('Messages', { tenant: tenant.name });
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
            props.navigation.navigate('ChecklistDetail', { checklist_id: checklist_id });
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACING.md,
          paddingBottom: insets.bottom + SPACING.lg,
          paddingHorizontal: SPACING.md,
        }}
      >
        <ScreenTitle>{tenant.name}</ScreenTitle>

        <Card>
          <View style={styles.top_line}>
            <Text style={styles.heading}>Contact</Text>
            <View
              style={[styles.badge, tenant.is_active ? styles.active_badge : styles.past_badge]}
            >
              <Text style={styles.badge_text}>{tenant.is_active ? 'Current' : 'Past tenant'}</Text>
            </View>
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
              <Text style={styles.place}>
                {placeLabel(tenancy.property_name, tenancy.unit_label)}
              </Text>
              <Text style={styles.detail}>Moved in {tenancy.started_at}</Text>
              <View style={styles.button_row}>
                <PrimaryButton
                  title="Move"
                  icon="swap-horizontal-outline"
                  text_color={COLORS.text_light}
                  onPress={() => openForm('move', tenancy)}
                  style={styles.move_button}
                />
                <PrimaryButton
                  title="End Tenancy"
                  icon="exit-outline"
                  text_color={COLORS.text_light}
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
            {tenant.open_work_order_count === 0
              ? 'No open work orders.'
              : tenant.open_work_order_count +
                (tenant.open_work_order_count === 1 ? ' open work order' : ' open work orders')}
          </Text>
          {recent.map((order) => (
            <View key={order.id} style={styles.order_row}>
              <Text style={styles.order_title} numberOfLines={1}>
                {order.title}
              </Text>
              <Text style={styles.detail}>{order.status}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => props.navigation.navigate('WorkOrders', { search: tenant.name })}
            hitSlop={8}
            style={styles.link_row}
            accessibilityRole="link"
          >
            <Text style={styles.link}>View in Work Orders</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.action} />
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
            text_color={COLORS.text_light}
            onPress={openMessages}
            style={styles.message_button}
          />
          <PrimaryButton
            title="Assign to a Property"
            icon="add-circle-outline"
            text_color={COLORS.text_light}
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

const styles = StyleSheet.create({
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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.xs,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
  },
  active_badge: {
    backgroundColor: COLORS.success,
  },
  past_badge: {
    backgroundColor: COLORS.secondary,
  },
  badge_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  note: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 2,
  },
  link: {
    color: COLORS.action,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  link_row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  tenancy: {
    marginTop: SPACING.sm,
  },
  place: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 15,
  },
  order_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  order_title: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  move_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.action,
  },
  end_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.danger,
  },
  actions: {
    width: '90%',
    alignSelf: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  message_button: {
    marginHorizontal: 0,
    backgroundColor: COLORS.accent,
  },
  assign_button: {
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
  helper: {
    width: '90%',
    alignSelf: 'center',
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginTop: SPACING.sm,
  },
});

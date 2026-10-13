import { StyleSheet, View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { ordersForTenant } from '../utils/workOrderHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONTS, TYPE } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import StatusPill from '../../../components/ui/StatusPill';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';

// the tenant's own requests, newest first, they update live when the landlord changes something
function MyRequestsScreen(props) {
  const insets = useSafeAreaInsets();
  const {
    orders,
    is_remote,
    orders_status,
    orders_error,
    orders_from_cache,
    refreshing_orders,
    refreshOrders,
    demo_mode,
  } = useWorkOrders();
  // the demo shares one list with the landlord side, so the tenant only gets Sam's requests out of it
  // and they change status live when the landlord side starts or resolves them
  const my_orders = demo_mode ? ordersForTenant(orders, demo_tenant.name) : orders;

  // the list is already newest first from the server, the local one gets sorted here
  const sorted_orders = [...my_orders].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      (b.created_at_iso || '').localeCompare(a.created_at_iso || ''),
  );

  let body;
  if (is_remote && orders_status === 'loading' && orders.length === 0) {
    // placeholder rows while the first load is out
    body = <SkeletonList rows={3} />;
  } else if (is_remote && orders_status === 'error' && orders.length === 0) {
    body = <ErrorState message={orders_error} onRetry={refreshOrders} />;
  } else {
    body = (
      <FlatList
        data={sorted_orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        refreshControl={
          is_remote ? (
            <RefreshControl
              refreshing={!!refreshing_orders}
              onRefresh={refreshOrders}
              tintColor={COLORS.title}
            />
          ) : undefined
        }
        ListHeaderComponent={
          is_remote && orders_from_cache && orders_error ? (
            <View style={styles.offline_banner}>
              <Text style={styles.offline_text}>
                {orders_error + ' Showing the last saved list, pull down to try again.'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            illustration="empty_work_orders"
            title="No requests yet"
            message="Tap Report an Issue when something needs fixing."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => props.navigation.navigate('RequestDetail', { workOrderId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={item.title + ', ' + item.status}
          >
            <View style={styles.top_line}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <StatusPill label={item.status} />
            </View>
            <Text style={styles.detail}>
              {item.property} · {formatDate(item.created_at)}
            </Text>
            {item.notes ? (
              <Text style={styles.note} numberOfLines={2}>
                Landlord: {item.notes}
              </Text>
            ) : null}
            <View style={styles.bottom_line}>
              <StatusPill label={item.priority} />
              {item.photos && item.photos.length > 0 && (
                <View style={styles.photo_count}>
                  <Ionicons name="camera-outline" size={14} color={COLORS.text} />
                  <Text style={styles.detail}>{item.photos.length}</Text>
                </View>
              )}
              <View style={styles.spacer} />
              <Ionicons name="chevron-forward" size={18} color={COLORS.text_muted} />
            </View>
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <PrimaryButton
        title="Report an Issue"
        icon="add-circle-outline"
        variant="primary"
        onPress={() => props.navigation.navigate('NewWorkOrder')}
        style={styles.report_button}
      />
      {body}
    </View>
  );
}

export default MyRequestsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  report_button: {
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
  },
  pressed: {
    opacity: 0.7,
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  title: {
    ...list_styles.title,
    flex: 1,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  badge_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  detail: {
    ...list_styles.detail,
  },
  note: {
    ...TYPE.body_small,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  bottom_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  photo_count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  spacer: {
    flex: 1,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
});

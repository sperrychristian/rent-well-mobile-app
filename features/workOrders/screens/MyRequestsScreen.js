import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { status_colors, priority_colors } from '../components/WorkOrderCard';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

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
  } = useWorkOrders();

  // the list is already newest first from the server, the local one gets sorted here
  const sorted_orders = [...orders].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      (b.created_at_iso || '').localeCompare(a.created_at_iso || ''),
  );

  let body;
  if (is_remote && orders_status === 'loading' && orders.length === 0) {
    body = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
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
          <Text style={styles.empty_text}>
            No requests yet. Tap Report an Issue when something needs fixing.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => props.navigation.navigate('RequestDetail', { order_id: item.id })}
            accessibilityRole="button"
            accessibilityLabel={item.title + ', ' + item.status}
          >
            <View style={styles.top_line}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: status_colors[item.status] }]}>
                <Text style={styles.badge_text}>{item.status}</Text>
              </View>
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
              <View
                style={[
                  styles.badge,
                  { backgroundColor: priority_colors[item.priority] || COLORS.secondary },
                ]}
              >
                <Text style={styles.badge_text}>{item.priority}</Text>
              </View>
              {item.photos && item.photos.length > 0 && (
                <View style={styles.photo_count}>
                  <Ionicons name="camera-outline" size={14} color={COLORS.text} />
                  <Text style={styles.detail}>{item.photos.length}</Text>
                </View>
              )}
              <View style={styles.spacer} />
              <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
            </View>
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>My Requests</ScreenTitle>
      <PrimaryButton
        title="Report an Issue"
        icon="add-circle-outline"
        text_color={COLORS.text_light}
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
    backgroundColor: COLORS.danger,
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
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
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
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
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
    marginTop: 4,
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
    gap: 2,
  },
  spacer: {
    flex: 1,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});

import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorState from '../../../components/ErrorState';
import { getAllWorkOrders } from '../../../services/api';
import {
  fromApiWorkOrder,
  mergeWorkOrders,
  ordersForTenant,
} from '../../workOrders/utils/workOrderHelpers';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { demo_tenant } from '../data/sampleTenants';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONTS, TYPE, SIZES } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import StatusLabel from '../../../components/ui/StatusLabel';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';

// a former tenant's requests, read only, straight from the server (reading still works after a tenancy ends)
function PastRequestsScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  // loading, ready, or error
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // goes up on Try Again or a pull down so the load runs again
  const [load_count, setLoadCount] = useState(0);
  // the demo never calls the server, a demo tenant whose rental ended reads Sam's requests from the demo list
  const { demo_mode, orders: local_orders } = useWorkOrders();

  useEffect(() => {
    if (demo_mode) {
      return undefined;
    }
    let active = true;
    getAllWorkOrders()
      .then((api_orders) => {
        if (active) {
          setOrders(mergeWorkOrders([], api_orders.map(fromApiWorkOrder)));
          setStatus('ready');
          setErrorMessage('');
        }
      })
      .catch((error) => {
        console.log('Could not load past requests', error.message);
        if (active) {
          setErrorMessage(error.message);
          setStatus('error');
        }
      })
      .finally(() => {
        if (active) {
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [load_count, demo_mode]);

  // one row, used by the server list and the demo list
  function renderRow({ item }) {
    return (
      <View style={styles.row}>
        <View style={styles.top_line}>
          <Text style={styles.title}>{item.title}</Text>
          <StatusLabel label={item.status} />
        </View>
        <Text style={styles.detail}>
          {item.property} · {formatDate(item.created_at)}
        </Text>
        {item.notes ? <Text style={styles.note}>Landlord: {item.notes}</Text> : null}
      </View>
    );
  }

  function reload() {
    setRefreshing(true);
    setLoadCount((current) => current + 1);
  }

  let body;
  if (demo_mode) {
    body = (
      <FlatList
        data={ordersForTenant(local_orders, demo_tenant.name)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListEmptyComponent={
          <EmptyState
            illustration="empty_work_orders"
            title="No past requests"
            message="Anything you reported while you lived here shows up here to read."
          />
        }
        renderItem={renderRow}
      />
    );
  } else if (status === 'loading' && orders.length === 0) {
    body = <SkeletonList rows={3} />;
  } else if (status === 'error' && orders.length === 0) {
    body = <ErrorState message={error_message} onRetry={reload} />;
  } else {
    body = (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={COLORS.title} />
        }
        ListEmptyComponent={
          <EmptyState
            illustration="empty_work_orders"
            title="No past requests"
            message="Anything you reported while you lived here shows up here to read."
          />
        }
        renderItem={renderRow}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <Text style={styles.helper}>Read only, since your tenancy has ended.</Text>
      {body}
    </View>
  );
}

export default PastRequestsScreen;

const styles = StyleSheet.create({
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
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  spinner: {
    marginTop: SPACING.lg,
  },
  row: {
    ...list_styles.row,
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    ...list_styles.title,
    flex: 1,
  },
  detail: {
    ...list_styles.detail,
  },
  note: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TYPE.body_small.fontSize,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
});

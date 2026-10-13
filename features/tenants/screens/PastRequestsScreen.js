import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorState from '../../../components/ErrorState';
import { getAllWorkOrders } from '../../../services/api';
import { fromApiWorkOrder, mergeWorkOrders } from '../../workOrders/utils/workOrderHelpers';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// one color per status, the same ones the work order cards use
const status_colors = {
  'Open': COLORS.danger,
  'In Progress': COLORS.warning,
  'Resolved': COLORS.success,
};

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

  useEffect(() => {
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
  }, [load_count]);

  function reload() {
    setRefreshing(true);
    setLoadCount((current) => current + 1);
  }

  let body;
  if (status === 'loading' && orders.length === 0) {
    body = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
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
        ListEmptyComponent={<Text style={styles.empty_text}>No requests.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.top_line}>
              <Text style={styles.title}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: status_colors[item.status] }]}>
                <Text style={styles.badge_text}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.detail}>
              {item.property} · {formatDate(item.created_at)}
            </Text>
            {item.notes ? <Text style={styles.note}>Landlord: {item.notes}</Text> : null}
          </View>
        )}
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
    padding: SPACING.md,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  spinner: {
    marginTop: SPACING.lg,
  },
  row: {
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
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
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});

import {
  StyleSheet,
  View,
  FlatList,
  Alert,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import ExpenseDetailsModal from '../../expenses/components/ExpenseDetailsModal';
import { COLORS, SPACING, FONTS } from '../../../theme';
import WorkOrderCard from '../components/WorkOrderCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import AddExpenseModal from '../../expenses/components/AddExpenseModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import ErrorState from '../../../components/ErrorState';
import { useTenants } from '../../tenants/context/TenantsContext';
import { useMessages } from '../../messages/context/MessagesContext';
import { openConversationFor } from '../../messages/utils/openConversation';
import { list_styles } from '../../../components/ui/listStyles';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';

// lower number sorts first, so emergencies come out on top
const priority_rank = { Emergency: 0, Normal: 1, Low: 2 };
const sort_options = ['Newest', 'Oldest', 'Priority'];

function WorkOrdersScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  // the orders and the actions live in the shared context now so every screen sees the same data
  const {
    orders,
    startWorkOrder,
    resolveWorkOrder,
    addExpense,
    properties: known_properties,
    is_remote,
    orders_status,
    orders_error,
    orders_from_cache,
    refreshing_orders,
    refreshOrders,
  } = useWorkOrders();
  // track whether the toggle is showing resolved orders or active ones
  const [show_resolved, setShowResolved] = useState(false);
  // remember which work order the expense form is open for, null means closed
  const [expense_order_id, setExpenseOrderId] = useState(null);
  // remember which work order's expense details are open, null means closed
  const [details_order_id, setDetailsOrderId] = useState(null);
  // track which property chip is selected, All means no property filter
  const [property_filter, setPropertyFilter] = useState('All');
  // what's typed in the search box and which sort chip is picked
  // the tenant detail screen can open this with their name already searched
  // it passes the tenant's id, and I look up the name here so only ids travel between screens
  const route_params = props.route && props.route.params ? props.route.params : {};
  const { getTenantById, properties: tenant_properties } = useTenants();
  const { conversations } = useMessages();
  const linked_tenant = route_params.tenantId ? getTenantById(route_params.tenantId) : null;
  const [search_text, setSearchText] = useState(linked_tenant ? linked_tenant.name : '');
  // a property's detail screen can open this showing only that property, the chip up top clears it
  const [only_property_id, setOnlyPropertyId] = useState(route_params.propertyId || null);
  const only_property = only_property_id
    ? tenant_properties.find((property) => property.id === only_property_id)
    : null;
  const [sort_by, setSortBy] = useState('Newest');

  // in real mode the actions go to the server and can fail, so I show why (the local ones never throw)
  async function tryAction(action) {
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not update the work order', error.message);
    }
  }

  // server orders know their property id, local ones only have the label, so those match by the property name
  function inOnlyProperty(order) {
    if (!only_property_id) {
      return true;
    }
    if (order.property_id) {
      return order.property_id === only_property_id;
    }
    const name = only_property ? only_property.name : null;
    return !!name && (order.property === name || order.property.startsWith(name + ','));
  }

  // ask first so a stray tap doesn't close out a request
  function confirmResolve(order_id) {
    Alert.alert('Resolve work order', 'Mark this request as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: () => tryAction(() => resolveWorkOrder(order_id)) },
    ]);
  }

  // save the expense under the order the form was opened for, then close the form
  function saveExpense(expense) {
    addExpense(expense_order_id, expense);
    setExpenseOrderId(null);
  }

  // build the chip list from the orders themselves so new properties show up on their own
  const property_names = ['All', ...new Set(orders.map((order) => order.property))];

  const search_lower = search_text.trim().toLowerCase();

  // filter here so the FlatList only ever gets the orders for the current toggle, chip, and search
  const visible_orders = orders
    .filter(
      (order) =>
        (show_resolved ? order.status === 'Resolved' : order.status !== 'Resolved') &&
        (property_filter === 'All' || order.property === property_filter) &&
        inOnlyProperty(order) &&
        // a server order can have no tenant, so every field falls back to empty text
        (search_lower === '' ||
          (order.title || '').toLowerCase().includes(search_lower) ||
          (order.tenant || '').toLowerCase().includes(search_lower) ||
          (order.property || '').toLowerCase().includes(search_lower)),
    )
    .sort((a, b) => {
      // priority sort uses the rank first and falls back to newest for ties
      if (sort_by === 'Priority') {
        const rank_difference = (priority_rank[a.priority] ?? 1) - (priority_rank[b.priority] ?? 1);
        if (rank_difference !== 0) {
          return rank_difference;
        }
      }
      // server orders also have the full time, which breaks ties between orders from the same day
      if (sort_by === 'Oldest') {
        return (
          a.created_at.localeCompare(b.created_at) ||
          (a.created_at_iso || '').localeCompare(b.created_at_iso || '')
        );
      }
      return (
        b.created_at.localeCompare(a.created_at) ||
        (b.created_at_iso || '').localeCompare(a.created_at_iso || '')
      );
    });

  // find the order for the details modal, undefined when it's closed
  const details_order = orders.find((order) => order.id === details_order_id);

  // find the order the expense form is open for so the form can start with its property
  const expense_order = orders.find((order) => order.id === expense_order_id);

  // I count from all the orders so the numbers don't change when a search or chip is active
  const active_count = orders.filter((order) => order.status !== 'Resolved').length;
  const resolved_count = orders.filter((order) => order.status === 'Resolved').length;

  // the controls scroll with the list so they don't eat the screen in landscape
  const list_header = (
    <View>
      {/* the saved list is showing because the server didn't answer, pulling down tries again */}
      {is_remote && orders_from_cache && orders_error ? (
        <View style={styles.offline_banner}>
          <Text style={styles.offline_text}>
            {orders_error + ' Showing the last saved list, pull down to try again.'}
          </Text>
        </View>
      ) : null}
      {only_property_id ? (
        <Pressable
          onPress={() => setOnlyPropertyId(null)}
          style={[styles.chip, styles.chip_active, styles.only_chip]}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Show work orders for every property"
        >
          <Text style={styles.chip_text}>
            {'Only ' + (only_property ? only_property.name : only_property_id) + '  ✕'}
          </Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.search_input}
        accessibilityLabel="Search work orders"
        keyboardAppearance="dark"
        placeholder="Search by issue, tenant, or property"
        placeholderTextColor={COLORS.text_muted}
        value={search_text}
        onChangeText={setSearchText}
        autoCorrect={false}
      />
      <View style={styles.segment}>
        <Pressable
          onPress={() => setShowResolved(false)}
          style={[styles.segment_option, !show_resolved && styles.segment_active]}
          accessibilityRole="button"
          accessibilityState={{ selected: !show_resolved }}
        >
          <Text style={styles.segment_text}>Active ({active_count})</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowResolved(true)}
          style={[styles.segment_option, show_resolved && styles.segment_active]}
          accessibilityRole="button"
          accessibilityState={{ selected: show_resolved }}
        >
          <Text style={styles.segment_text}>Resolved ({resolved_count})</Text>
        </Pressable>
      </View>
      {/* chips scroll sideways so a long list of properties doesn't wrap */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {property_names.map((name) => (
          <Pressable
            key={name}
            onPress={() => setPropertyFilter(name)}
            style={[styles.chip, property_filter === name && styles.chip_active]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: property_filter === name }}
          >
            <Text style={styles.chip_text}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.sort_row}>
        <Text style={styles.toggle_label}>Sort</Text>
        {sort_options.map((option) => (
          <Pressable
            key={option}
            onPress={() => setSortBy(option)}
            style={[styles.chip, sort_by === option && styles.chip_active]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={'Sort by ' + option}
            accessibilityState={{ selected: sort_by === option }}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      {/* FlatList only renders what's on screen, so it scales when the list gets long */}
      {/* real mode can still be loading or have failed with nothing saved, so those get their own screens */}
      {is_remote && orders_status === 'loading' && orders.length === 0 ? (
        // grey placeholder cards while the first load is out, instead of a lone spinner
        <SkeletonList rows={4} />
      ) : is_remote && orders_status === 'error' && orders.length === 0 ? (
        <ErrorState message={orders_error} onRetry={refreshOrders} />
      ) : (
        <FlatList
          data={visible_orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.lg }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            is_remote ? (
              <RefreshControl
                refreshing={!!refreshing_orders}
                onRefresh={refreshOrders}
                tintColor={COLORS.title}
              />
            ) : undefined
          }
          ListHeaderComponent={list_header}
          ListEmptyComponent={
            <EmptyState
              illustration="empty_work_orders"
              title={show_resolved ? 'No resolved work orders found' : 'No open work orders found'}
              message={
                search_text || property_filter !== 'All'
                  ? 'Try a different search or property.'
                  : 'New requests show up here as soon as they come in.'
              }
            />
          }
          renderItem={({ item }) => (
            <WorkOrderCard
              order={item}
              onAddExpense={() => setExpenseOrderId(item.id)}
              onViewExpenses={() => setDetailsOrderId(item.id)}
              onStart={() => tryAction(() => startWorkOrder(item.id))}
              onResolve={() => confirmResolve(item.id)}
              onMessage={() =>
                openConversationFor(props.navigation, conversations, item.tenant, item.tenant_id)
              }
              onOpenDetail={() =>
                props.navigation.navigate('WorkOrderDetail', { workOrderId: item.id })
              }
            />
          )}
        />
      )}
      <AddExpenseModal
        visible={expense_order_id !== null}
        default_property={expense_order ? expense_order.property : ''}
        property_names={known_properties}
        onSave={saveExpense}
        onClose={() => setExpenseOrderId(null)}
      />
      <ExpenseDetailsModal
        visible={details_order_id !== null}
        order={details_order}
        onClose={() => setDetailsOrderId(null)}
      />
    </View>
  );
}

export default WorkOrdersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  list: {
    gap: SPACING.sm,
  },
  search_input: {
    ...list_styles.search_input,
  },
  segment: {
    ...list_styles.segment,
  },
  segment_option: {
    ...list_styles.segment_option,
  },
  segment_active: {
    ...list_styles.segment_active,
  },
  segment_text: {
    ...list_styles.segment_text,
  },
  toggle_label: {
    ...list_styles.label,
  },
  sort_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
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
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
  chip_row: {
    ...list_styles.chip_row,
  },
  chip: {
    ...list_styles.chip,
  },
  only_chip: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_text: {
    ...list_styles.chip_text,
  },
});

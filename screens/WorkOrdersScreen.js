import { StyleSheet, View, FlatList, Alert, Text, ScrollView, Pressable, TextInput } from "react-native";
import ExpenseDetailsModal from "../components/ExpenseDetailsModal";
import { COLORS, SPACING, FONTS } from "../theme";
import ScreenTitle from "../components/ScreenTitle";
import WorkOrderCard from "../components/WorkOrderCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import AddExpenseModal from "../components/AddExpenseModal";
import { useWorkOrders } from "../context/WorkOrdersContext";

// lower number sorts first, so emergencies come out on top
const priority_rank = { Emergency: 0, Normal: 1, Low: 2 };
const sort_options = ["Newest", "Oldest", "Priority"];

function WorkOrdersScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  // the orders and the actions live in the shared context now so every screen sees the same data
  const { orders, startWorkOrder, resolveWorkOrder, addExpense, properties: known_properties } = useWorkOrders();
  // track whether the toggle is showing resolved orders or active ones
  const [show_resolved, setShowResolved] = useState(false);
  // remember which work order the expense form is open for, null means closed
  const [expense_order_id, setExpenseOrderId] = useState(null);
  // remember which work order's expense details are open, null means closed
  const [details_order_id, setDetailsOrderId] = useState(null);
  // track which property chip is selected, All means no property filter
  const [property_filter, setPropertyFilter] = useState("All");
  // what's typed in the search box and which sort chip is picked
  const [search_text, setSearchText] = useState("");
  const [sort_by, setSortBy] = useState("Newest");

  // ask first so a stray tap doesn't close out a request
  function confirmResolve(order_id) {
    Alert.alert("Resolve work order", "Mark this request as resolved?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", onPress: () => resolveWorkOrder(order_id) },
    ]);
  }

  // save the expense under the order the form was opened for, then close the form
  function saveExpense(expense) {
    addExpense(expense_order_id, expense);
    setExpenseOrderId(null);
  }

  // build the chip list from the orders themselves so new properties show up on their own
  const property_names = ["All", ...new Set(orders.map((order) => order.property))];

  const search_lower = search_text.trim().toLowerCase();

  // filter here so the FlatList only ever gets the orders for the current toggle, chip, and search
  const visible_orders = orders
    .filter(
      (order) =>
        (show_resolved ? order.status === "Resolved" : order.status !== "Resolved") &&
        (property_filter === "All" || order.property === property_filter) &&
        (search_lower === "" ||
          order.title.toLowerCase().includes(search_lower) ||
          order.tenant.toLowerCase().includes(search_lower) ||
          order.property.toLowerCase().includes(search_lower)),
    )
    .sort((a, b) => {
      // priority sort uses the rank first and falls back to newest for ties
      if (sort_by === "Priority") {
        const rank_difference =
          (priority_rank[a.priority] ?? 1) - (priority_rank[b.priority] ?? 1);
        if (rank_difference !== 0) {
          return rank_difference;
        }
      }
      if (sort_by === "Oldest") {
        return a.created_at.localeCompare(b.created_at);
      }
      return b.created_at.localeCompare(a.created_at);
    });

  // find the order for the details modal, undefined when it's closed
  const details_order = orders.find((order) => order.id === details_order_id);

  // find the order the expense form is open for so the form can start with its property
  const expense_order = orders.find((order) => order.id === expense_order_id);

  // I count from all the orders so the numbers don't change when a search or chip is active
  const active_count = orders.filter((order) => order.status !== "Resolved").length;
  const resolved_count = orders.filter((order) => order.status === "Resolved").length;

  // the controls scroll with the list so they don't eat the screen in landscape
  const list_header = (
    <View>
      <TextInput
        style={styles.search_input}
        placeholder="Search by issue, tenant, or property"
        placeholderTextColor={COLORS.text}
        value={search_text}
        onChangeText={setSearchText}
        autoCorrect={false}
      />
      <View style={styles.segment}>
        <Pressable
          onPress={() => setShowResolved(false)}
          style={[styles.segment_option, !show_resolved && styles.segment_active]}
        >
          <Text style={styles.segment_text}>Active ({active_count})</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowResolved(true)}
          style={[styles.segment_option, show_resolved && styles.segment_active]}
        >
          <Text style={styles.segment_text}>Resolved ({resolved_count})</Text>
        </Pressable>
      </View>
      {/* chips scroll sideways so a long list of properties doesn't wrap */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chip_row}>
        {property_names.map((name) => (
          <Pressable
            key={name}
            onPress={() => setPropertyFilter(name)}
            style={[styles.chip, property_filter === name && styles.chip_active]}
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
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Work Orders</ScreenTitle>
      {/* FlatList only renders what's on screen, so it scales when the list gets long */}
      <FlatList
        data={visible_orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={list_header}
        ListEmptyComponent={
          <Text style={styles.empty_text}>
            {show_resolved
              ? "No resolved work orders found"
              : "No open work orders found"}
          </Text>
        }
        renderItem={({ item }) => (
          <WorkOrderCard
            order={item}
            onAddExpense={() => setExpenseOrderId(item.id)}
            onViewExpenses={() => setDetailsOrderId(item.id)}
            onStart={() => startWorkOrder(item.id)}
            onResolve={() => confirmResolve(item.id)}
            onMessage={() => props.navigation.navigate("Messages", { tenant: item.tenant })}
            onOpenDetail={() => props.navigation.navigate("WorkOrderDetail", { order_id: item.id })}
          />
        )}
      />
      <AddExpenseModal
        visible={expense_order_id !== null}
        default_property={expense_order ? expense_order.property : ""}
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
    backgroundColor: COLORS.muted,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  segment_option: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  segment_active: {
    backgroundColor: COLORS.primary,
  },
  segment_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  toggle_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  sort_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: "center",
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.muted,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
});

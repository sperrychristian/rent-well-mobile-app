import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import AddExpenseModal from '../components/AddExpenseModal';
import RecurringModal from '../components/RecurringModal';
import BudgetsModal from '../components/BudgetsModal';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { formatDate } from '../utils/formatDate';
import {
  sumAmounts,
  totalsByCategory,
  totalsByProperty,
  totalsByVendor,
  sumBilled,
  sumRecovered,
  splitAmount,
  formatMoney,
} from '../utils/expenseStats';
import { shareExpensesCsv } from '../utils/exportExpenses';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';

const month_names = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const sort_options = ['Newest', 'Oldest', 'Highest'];

// turns 2026-10 into October 2026 for the group headers
function monthTitle(month_key) {
  const parts = month_key.split('-');
  return month_names[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

function ExpensesScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const {
    orders,
    expenses,
    properties,
    budgets,
    recurring_rules,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    addRecurringRule,
    toggleRecurringRule,
    deleteRecurringRule,
    setBudgets,
  } = useWorkOrders();

  const current_year = String(new Date().getFullYear());
  // year defaults to this year so the tax year view is one tap away
  const [year, setYear] = useState(current_year);
  const [property_filter, setPropertyFilter] = useState('All');
  const [category_filter, setCategoryFilter] = useState(null);
  const [sort_by, setSortBy] = useState('Newest');
  const [search_text, setSearchText] = useState('');
  const [show_all_vendors, setShowAllVendors] = useState(false);
  // the form is open when form_open is true, editing_id says which expense it edits, null means a new one
  const [form_open, setFormOpen] = useState(false);
  const [editing_id, setEditingId] = useState(null);
  // a receipt photo taken first gets attached to the new expense when the form opens
  const [prefill_receipts, setPrefillReceipts] = useState([]);
  const [recurring_open, setRecurringOpen] = useState(false);
  const [budgets_open, setBudgetsOpen] = useState(false);
  // the last deleted expense, kept so the undo bar can bring it back
  const [deleted_expense, setDeletedExpense] = useState(null);
  const undo_timer = useRef(null);

  // I clear the undo timer when leaving the screen so it can't fire on something that's gone
  useEffect(() => {
    return () => {
      if (undo_timer.current) {
        clearTimeout(undo_timer.current);
      }
    };
  }, []);

  // years that have expenses, plus this year, newest first
  const years = [
    ...new Set([...expenses.map((expense) => expense.date.slice(0, 4)), current_year]),
  ].sort((a, b) => b.localeCompare(a));

  // year and property filters apply to the summary and the list, category and search only change the list
  const filtered_expenses = expenses.filter(
    (expense) =>
      expense.date.slice(0, 4) === year &&
      (property_filter === 'All' || expense.property === property_filter),
  );

  const search_lower = search_text.trim().toLowerCase();
  const list_expenses = filtered_expenses
    .filter(
      (expense) =>
        (category_filter === null || expense.category === category_filter) &&
        (search_lower === '' ||
          (expense.notes || '').toLowerCase().includes(search_lower) ||
          (expense.vendor || '').toLowerCase().includes(search_lower) ||
          expense.category.toLowerCase().includes(search_lower) ||
          expense.property.toLowerCase().includes(search_lower)),
    )
    .sort((a, b) => {
      if (sort_by === 'Highest') {
        return b.amount - a.amount;
      }
      if (sort_by === 'Oldest') {
        return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      }
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });

  // I add a header row whenever the month changes so the list reads in groups, but not when sorted by amount
  const rows = [];
  let last_month = '';
  list_expenses.forEach((expense) => {
    const month_key = expense.date.slice(0, 7);
    if (sort_by !== 'Highest' && month_key !== last_month) {
      rows.push({ type: 'header', key: 'header-' + month_key, title: monthTitle(month_key) });
      last_month = month_key;
    }
    rows.push({ type: 'expense', key: expense.id, expense: expense });
  });

  const deductible_total = sumAmounts(filtered_expenses.filter((expense) => !expense.is_capital));
  const capital_total = sumAmounts(filtered_expenses.filter((expense) => expense.is_capital));
  const billed_total = sumBilled(filtered_expenses);
  const recovered_total = sumRecovered(filtered_expenses);
  const category_totals = totalsByCategory(filtered_expenses);
  const property_totals = totalsByProperty(filtered_expenses);
  const vendor_totals = totalsByVendor(filtered_expenses);
  const shown_vendors = show_all_vendors ? vendor_totals : vendor_totals.slice(0, 5);

  const editing_expense = expenses.find((expense) => expense.id === editing_id);

  function openNewForm() {
    setEditingId(null);
    setPrefillReceipts([]);
    setFormOpen(true);
  }

  // camera first, then the form opens with the photo already attached
  async function scanReceipt() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) {
      return;
    }
    setEditingId(null);
    setPrefillReceipts([result.assets[0].uri]);
    setFormOpen(true);
  }

  function openEditForm(expense_id) {
    setEditingId(expense_id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  // looks for an existing expense with the same amount, date, and vendor
  function findDuplicate(expense) {
    return expenses.find(
      (existing) =>
        Math.abs(existing.amount - expense.amount) < 0.005 &&
        existing.date === expense.date &&
        (existing.vendor || '').trim().toLowerCase() === (expense.vendor || '').trim().toLowerCase(),
    );
  }

  // the actual save, edited expenses get updated and new ones get added, split, or set to repeat
  function proceedSave(expense) {
    const { repeat, split_properties, ...fields } = expense;

    if (editing_expense) {
      updateExpense(editing_expense.id, fields);
    } else if (split_properties && split_properties.length >= 2) {
      // each property gets its own expense with an equal share, tied together by the split group
      const parts = splitAmount(fields.amount, split_properties.length);
      const group_id = 'split-' + Date.now();
      split_properties.forEach((name, index) => {
        addExpense(null, { ...fields, property: name, amount: parts[index], split_group: group_id });
      });
    } else {
      addExpense(null, fields);
      if (repeat && repeat !== 'None') {
        addRecurringRule(fields, repeat);
      }
    }

    // I jump to the saved expense's year and clear the filters so it doesn't vanish from the list
    setYear(expense.date.slice(0, 4));
    setPropertyFilter('All');
    setCategoryFilter(null);
    closeForm();
  }

  // new expenses get checked for a duplicate first, and the form stays open if I back out
  function handleSave(expense) {
    if (!editing_expense && findDuplicate(expense)) {
      Alert.alert(
        'Possible duplicate',
        'There is already an expense with the same amount, date, and vendor.',
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Save anyway', onPress: () => proceedSave(expense) },
        ],
      );
      return;
    }
    proceedSave(expense);
  }

  // delete right away and show an undo bar for a few seconds, the receipts are kept in memory until it goes away
  function handleDelete() {
    const removed = expenses.find((expense) => expense.id === editing_id);
    deleteExpense(editing_id);
    closeForm();
    setDeletedExpense(removed);
    if (undo_timer.current) {
      clearTimeout(undo_timer.current);
    }
    undo_timer.current = setTimeout(() => setDeletedExpense(null), 6000);
  }

  function undoDelete() {
    if (deleted_expense) {
      restoreExpense(deleted_expense);
    }
    if (undo_timer.current) {
      clearTimeout(undo_timer.current);
    }
    setDeletedExpense(null);
  }

  // exports whatever the year and property filters are showing
  async function exportCsv() {
    if (filtered_expenses.length === 0) {
      Alert.alert('Nothing to export', 'There are no expenses for this year and property.');
      return;
    }
    const order_titles = {};
    orders.forEach((order) => {
      order_titles[order.id] = order.title;
    });
    try {
      await shareExpensesCsv(filtered_expenses, year, order_titles);
    } catch (error) {
      console.log('Could not export expenses', error);
      Alert.alert('Export failed', 'The file could not be created or shared.');
    }
  }

  function saveBudgets(new_budgets) {
    setBudgets(new_budgets);
    setBudgetsOpen(false);
  }

  // the summary and filters scroll with the list so they don't eat the screen in landscape
  const list_header = (
    <View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Add Expense"
          icon="add-circle-outline"
          style={styles.add_button}
          onPress={openNewForm}
        />
        <PrimaryButton
          title="Scan Receipt"
          icon="camera-outline"
          style={styles.scan_button}
          onPress={scanReceipt}
        />
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Mileage"
          icon="car-outline"
          style={styles.mileage_button}
          onPress={() => props.navigation.navigate('Mileage')}
        />
        <PrimaryButton
          title="Year-End"
          icon="document-text-outline"
          text_color={COLORS.text_dark}
          style={styles.report_button}
          onPress={() => props.navigation.navigate('YearEndReport', { year: year })}
        />
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Recurring"
          icon="repeat-outline"
          style={styles.grey_button}
          onPress={() => setRecurringOpen(true)}
        />
        <PrimaryButton
          title="Budgets"
          icon="wallet-outline"
          style={styles.grey_button}
          onPress={() => setBudgetsOpen(true)}
        />
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Export CSV"
          icon="share-outline"
          style={styles.export_button}
          onPress={exportCsv}
        />
      </View>

      <Text style={styles.section_label}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chip_row}>
        {years.map((option) => (
          <Pressable
            key={option}
            onPress={() => setYear(option)}
            style={[styles.chip, year === option && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section_label}>Property</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chip_row}>
        {['All', ...properties].map((name) => (
          <Pressable
            key={name}
            onPress={() => setPropertyFilter(name)}
            style={[styles.chip, property_filter === name && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <Text style={styles.summary_label}>Deductible expenses in {year}</Text>
        <Text style={styles.summary_total}>{formatMoney(deductible_total)}</Text>
        <Text style={styles.detail}>
          Capital improvements (depreciated): {formatMoney(capital_total)}
        </Text>
        {billed_total > 0 && (
          <Text style={styles.detail}>
            Billed to tenants: {formatMoney(billed_total)} · Recovered: {formatMoney(recovered_total)}
          </Text>
        )}
        <Text style={styles.detail}>{filtered_expenses.length} expenses</Text>
      </Card>

      <Card>
        <Text style={styles.heading}>By category</Text>
        <Text style={styles.helper}>Tap a category to filter the list below.</Text>
        {category_totals.length === 0 && <Text style={styles.detail}>Nothing for this selection</Text>}
        {category_totals.map((row) => {
          const percent = deductible_total > 0 ? Math.round((row.total / deductible_total) * 100) : 0;
          const dimmed = category_filter !== null && category_filter !== row.category;
          return (
            <Pressable
              key={row.category}
              style={[styles.bar_row, dimmed && styles.dimmed]}
              onPress={() => setCategoryFilter(category_filter === row.category ? null : row.category)}
            >
              <View style={styles.bar_labels}>
                <Text style={styles.bar_name}>{row.category}</Text>
                <Text style={styles.bar_amount}>
                  {formatMoney(row.total)} · {percent}%
                </Text>
              </View>
              <View style={styles.bar_track}>
                <View style={[styles.bar_fill, { width: percent + '%' }]} />
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.heading}>Spent by property</Text>
        {property_totals.length === 0 && <Text style={styles.detail}>Nothing for this selection</Text>}
        {property_totals.map((row) => {
          const budget = budgets[row.property];
          const over_budget = budget !== undefined && row.total > budget;
          const budget_percent = budget ? Math.min(100, Math.round((row.total / budget) * 100)) : 0;
          return (
            <View key={row.property} style={styles.bar_row}>
              <View style={styles.bar_labels}>
                <Text style={styles.bar_name}>{row.property}</Text>
                <Text style={[styles.bar_amount, over_budget && styles.over_budget_text]}>
                  {formatMoney(row.total)}
                  {budget !== undefined ? ' of ' + formatMoney(budget) : ''}
                </Text>
              </View>
              {budget !== undefined && (
                <View style={styles.bar_track}>
                  <View
                    style={[
                      styles.bar_fill,
                      { width: budget_percent + '%' },
                      over_budget && styles.over_budget_fill,
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.heading}>Paid by vendor</Text>
        <Text style={styles.helper}>
          Paying one vendor over the IRS reporting limit can mean filing a 1099. Check the current rules.
        </Text>
        {vendor_totals.length === 0 && <Text style={styles.detail}>No vendors recorded for this selection</Text>}
        {shown_vendors.map((row) => (
          <View key={row.vendor} style={styles.property_row}>
            <Text style={styles.bar_name}>{row.vendor}</Text>
            <Text style={styles.bar_amount}>{formatMoney(row.total)}</Text>
          </View>
        ))}
        {vendor_totals.length > 5 && (
          <Pressable onPress={() => setShowAllVendors(!show_all_vendors)}>
            <Text style={styles.link_text}>
              {show_all_vendors ? 'Show fewer' : 'Show all ' + vendor_totals.length}
            </Text>
          </Pressable>
        )}
      </Card>

      <TextInput
        style={styles.search_input}
        placeholder="Search notes, vendor, category, or property"
        placeholderTextColor={COLORS.text}
        value={search_text}
        onChangeText={setSearchText}
        autoCorrect={false}
      />
      <View style={styles.sort_row}>
        <Text style={styles.sort_label}>Sort</Text>
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
      {category_filter !== null && (
        <Pressable style={styles.filter_chip} onPress={() => setCategoryFilter(null)}>
          <Text style={styles.chip_text}>Category: {category_filter}  ✕</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Expenses</ScreenTitle>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg + 56 }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={<Text style={styles.empty_text}>No expenses match</Text>}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={styles.month_header}>{item.title}</Text>;
          }
          const expense = item.expense;
          const linked_order = orders.find((order) => order.id === expense.work_order_id);
          const receipts = expense.receipts || [];
          return (
            <Pressable style={styles.row} onPress={() => openEditForm(expense.id)}>
              <View style={styles.row_text}>
                <View style={styles.row_top}>
                  <Text style={styles.row_amount}>{formatMoney(expense.amount)}</Text>
                  <Text style={styles.detail}>{formatDate(expense.date)}</Text>
                </View>
                <Text style={styles.row_category}>{expense.category}</Text>
                <Text style={styles.detail}>{expense.property}</Text>
                {expense.vendor ? <Text style={styles.detail}>{expense.vendor}</Text> : null}
                <View style={styles.tag_row}>
                  {expense.is_capital && (
                    <View style={[styles.tag, styles.capital_tag]}>
                      <Text style={styles.tag_text}>Capital improvement</Text>
                    </View>
                  )}
                  {expense.billed_to_tenant && (
                    <View style={[styles.tag, styles.billed_tag]}>
                      <Text style={styles.tag_text}>
                        Billed to tenant · {formatMoney(expense.recovered || 0)} back
                      </Text>
                    </View>
                  )}
                  {expense.recurring_id && (
                    <View style={[styles.tag, styles.recurring_tag]}>
                      <Text style={styles.tag_text}>Recurring</Text>
                    </View>
                  )}
                  {expense.split_group && (
                    <View style={[styles.tag, styles.recurring_tag]}>
                      <Text style={styles.tag_text}>Split</Text>
                    </View>
                  )}
                  {linked_order && (
                    <Pressable
                      style={[styles.tag, styles.order_tag]}
                      onPress={() => props.navigation.navigate('WorkOrderDetail', { order_id: linked_order.id })}
                    >
                      <Text style={styles.tag_text} numberOfLines={1}>Work order: {linked_order.title}</Text>
                    </Pressable>
                  )}
                  {receipts.length === 0 && (
                    <View style={[styles.tag, styles.missing_tag]}>
                      <Text style={styles.tag_text}>No receipt</Text>
                    </View>
                  )}
                </View>
              </View>
              {receipts.length > 0 && (
                <View style={styles.receipt_box}>
                  <Image source={{ uri: receipts[0] }} style={styles.receipt_thumb} />
                  <Text style={styles.detail}>{receipts.length} receipt{receipts.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* the undo bar floats at the bottom for a few seconds after a delete */}
      {deleted_expense && (
        <View style={[styles.undo_bar, { bottom: insets.bottom + SPACING.md }]}>
          <Text style={styles.undo_text}>Expense deleted</Text>
          <Pressable onPress={undoDelete}>
            <Text style={styles.undo_action}>Undo</Text>
          </Pressable>
        </View>
      )}

      <AddExpenseModal
        visible={form_open}
        expense={editing_expense}
        allow_extras
        initial_receipts={prefill_receipts}
        default_property={property_filter !== 'All' ? property_filter : ''}
        property_names={properties}
        onSave={handleSave}
        onClose={closeForm}
        onDelete={handleDelete}
      />
      <RecurringModal
        visible={recurring_open}
        rules={recurring_rules}
        onToggle={toggleRecurringRule}
        onDelete={deleteRecurringRule}
        onClose={() => setRecurringOpen(false)}
      />
      <BudgetsModal
        visible={budgets_open}
        properties={properties}
        budgets={budgets}
        onSave={saveBudgets}
        onClose={() => setBudgetsOpen(false)}
      />
    </View>
  );
}

export default ExpensesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  add_button: {
    flex: 1,
    backgroundColor: COLORS.success,
    marginHorizontal: 0,
  },
  scan_button: {
    flex: 1,
    backgroundColor: COLORS.action,
    marginHorizontal: 0,
  },
  mileage_button: {
    flex: 1,
    backgroundColor: COLORS.accent,
    marginHorizontal: 0,
  },
  report_button: {
    flex: 1,
    backgroundColor: COLORS.highlight,
    marginHorizontal: 0,
  },
  grey_button: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    marginHorizontal: 0,
  },
  export_button: {
    flex: 1,
    backgroundColor: COLORS.action,
    marginHorizontal: 0,
  },
  section_label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
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
  filter_chip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  link_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  summary_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  summary_total: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 32,
    marginVertical: 4,
  },
  bar_row: {
    marginBottom: SPACING.sm,
  },
  dimmed: {
    opacity: 0.4,
  },
  bar_labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bar_name: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  bar_amount: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  over_budget_text: {
    color: COLORS.danger,
  },
  bar_track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  bar_fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  over_budget_fill: {
    backgroundColor: COLORS.danger,
  },
  property_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  search_input: {
    backgroundColor: COLORS.muted,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  sort_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sort_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  month_header: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row_text: {
    flex: 1,
  },
  row_top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  row_amount: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  row_category: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
    marginTop: 2,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
    maxWidth: 220,
  },
  capital_tag: {
    backgroundColor: COLORS.accent,
  },
  billed_tag: {
    backgroundColor: COLORS.tag_billed,
  },
  recurring_tag: {
    backgroundColor: COLORS.tag_recurring,
  },
  order_tag: {
    backgroundColor: COLORS.action,
  },
  missing_tag: {
    backgroundColor: COLORS.tag_missing_receipt,
  },
  tag_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 11,
  },
  receipt_box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  receipt_thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
  undo_bar: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.toast_background,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  undo_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  undo_action: {
    color: COLORS.highlight,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
});
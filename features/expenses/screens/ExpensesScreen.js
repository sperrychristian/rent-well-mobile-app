import { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import AddExpenseModal from '../components/AddExpenseModal';
import RecurringModal from '../components/RecurringModal';
import BudgetsModal from '../components/BudgetsModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { formatDate } from '../../../utils/formatDate';
import {
  sumAmounts,
  totalsByCategory,
  totalsByProperty,
  totalsByVendor,
  sumBilled,
  sumRecovered,
  splitAmount,
} from '../utils/expenseStats';
import { shareExpensesCsv } from '../utils/exportExpenses';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SHADOWS, SIZES, NUMBERS } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import EmptyState from '../../../components/ui/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import IconCircle from '../../../components/ui/IconCircle';
import ReceiptImage from '../../../components/ReceiptImage';
import ImportExpensesCard from '../components/ImportExpensesCard';
import TaxSummarySheet from '../../profit/components/TaxSummarySheet';
import SkeletonList from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ErrorState';
import { useToast } from '../../../components/ui/Toast';
import { useExpenses } from '../context/ExpensesContext';
import { themedStyles } from '../../../utils/themedStyles';

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
  // real mode: where the list came from (the server, or the copy saved on the phone), and the old phone expenses
  const expense_store = useExpenses();
  const toast = useToast();
  const [tax_open, setTaxOpen] = useState(false);

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

  // Search opens one expense by its id: its form opens once, then the id is cleared so coming back doesn't reopen it
  const linked_expense_id = props.route && props.route.params ? props.route.params.expenseId : null;
  const [opened_link, setOpenedLink] = useState(null);
  if (linked_expense_id && linked_expense_id !== opened_link) {
    setOpenedLink(linked_expense_id);
    if (expenses.some((expense) => expense.id === linked_expense_id)) {
      setEditingId(linked_expense_id);
      setFormOpen(true);
    }
  }
  const navigation = props.navigation;
  useEffect(() => {
    if (linked_expense_id) {
      navigation.setParams({ expenseId: undefined });
    }
  }, [linked_expense_id, navigation]);

  // looks for an existing expense with the same amount, date, and vendor
  function findDuplicate(expense) {
    return expenses.find(
      (existing) =>
        Math.abs(existing.amount - expense.amount) < 0.005 &&
        existing.date === expense.date &&
        (existing.vendor || '').trim().toLowerCase() ===
          (expense.vendor || '').trim().toLowerCase(),
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
        addExpense(null, {
          ...fields,
          property: name,
          amount: parts[index],
          split_group: group_id,
        });
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
  // on the server a delete can't be undone, so real mode asks first instead
  function handleDelete() {
    if (expense_store.is_remote) {
      const target_id = editing_id;
      Alert.alert('Delete this expense?', "It's removed from your lists and reports.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            closeForm();
            if (await deleteExpense(target_id)) {
              toast.show('Expense deleted', 'trash-outline');
            }
          },
        },
      ]);
      return;
    }
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
          variant="primary"
          style={styles.add_button}
          onPress={openNewForm}
        />
        <PrimaryButton
          title="Scan Receipt"
          icon="camera-outline"
          variant="secondary"
          style={styles.scan_button}
          onPress={scanReceipt}
        />
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Mileage"
          icon="car-outline"
          variant="tertiary"
          style={styles.mileage_button}
          onPress={() => props.navigation.navigate('Mileage')}
        />
        <PrimaryButton
          title="Year-End"
          icon="document-text-outline"
          variant="tertiary"
          style={styles.report_button}
          onPress={() => props.navigation.navigate('YearEndReport', { yearId: year })}
        />
      </View>
      <View style={styles.button_row}>
        {/* recurring rules make expenses on the phone, so they stay out of real mode until the server has them */}
        {!expense_store.is_remote && (
          <PrimaryButton
            title="Recurring"
            icon="repeat-outline"
            variant="tertiary"
            style={styles.grey_button}
            onPress={() => setRecurringOpen(true)}
          />
        )}
        <PrimaryButton
          title="Budgets"
          icon="wallet-outline"
          variant="tertiary"
          style={styles.grey_button}
          onPress={() => setBudgetsOpen(true)}
        />
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Export CSV"
          icon="share-outline"
          variant="tertiary"
          style={styles.export_button}
          onPress={exportCsv}
        />
        <PrimaryButton
          title="Tax Summary"
          icon="document-text-outline"
          variant="tertiary"
          style={styles.export_button}
          onPress={() => setTaxOpen(true)}
        />
      </View>
      {/* real mode only: the old phone expenses waiting to go up, and a note when the list is the saved copy */}
      {expense_store.is_remote && <ImportExpensesCard />}
      {expense_store.from_cache && (
        <Text style={styles.helper} accessibilityLiveRegion="polite">
          Offline: showing the copy saved on this phone. Adding or changing expenses needs a
          connection.
        </Text>
      )}

      <Text style={styles.section_label}>Year</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {years.map((option) => (
          <Pressable
            key={option}
            onPress={() => setYear(option)}
            style={[styles.chip, year === option && styles.chip_active]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: year === option }}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section_label}>Property</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {['All', ...properties].map((name) => (
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

      <Card>
        <Text style={styles.summary_label}>Deductible expenses in {year}</Text>
        <Text style={styles.summary_total}>{formatCurrency(deductible_total)}</Text>
        <Text style={styles.detail}>
          Capital improvements (depreciated): {formatCurrency(capital_total)}
        </Text>
        {billed_total > 0 && (
          <Text style={styles.detail}>
            Billed to tenants: {formatCurrency(billed_total)} · Recovered:{' '}
            {formatCurrency(recovered_total)}
          </Text>
        )}
        <Text style={styles.detail}>{filtered_expenses.length} expenses</Text>
      </Card>

      <Card>
        <Text style={styles.heading}>By category</Text>
        <Text style={styles.helper}>Tap a category to filter the list below.</Text>
        {category_totals.length === 0 && (
          <Text style={styles.detail}>Nothing for this selection</Text>
        )}
        {category_totals.map((row) => {
          const percent =
            deductible_total > 0 ? Math.round((row.total / deductible_total) * 100) : 0;
          const dimmed = category_filter !== null && category_filter !== row.category;
          return (
            <Pressable
              key={row.category}
              style={[styles.bar_row, dimmed && styles.dimmed]}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={
                row.category + ', ' + formatCurrency(row.total) + ', ' + percent + ' percent'
              }
              accessibilityState={{ selected: category_filter === row.category }}
              onPress={() =>
                setCategoryFilter(category_filter === row.category ? null : row.category)
              }
            >
              <View style={styles.bar_labels}>
                <Text style={styles.bar_name}>{row.category}</Text>
                <Text style={styles.bar_amount}>
                  {formatCurrency(row.total)} · {percent}%
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
        {property_totals.length === 0 && (
          <Text style={styles.detail}>Nothing for this selection</Text>
        )}
        {property_totals.map((row) => {
          const budget = budgets[row.property];
          const over_budget = budget !== undefined && row.total > budget;
          const budget_percent = budget ? Math.min(100, Math.round((row.total / budget) * 100)) : 0;
          return (
            <View key={row.property} style={styles.bar_row}>
              <View style={styles.bar_labels}>
                <Text style={styles.bar_name}>{row.property}</Text>
                <Text style={[styles.bar_amount, over_budget && styles.over_budget_text]}>
                  {formatCurrency(row.total)}
                  {budget !== undefined ? ' of ' + formatCurrency(budget) : ''}
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
          Paying one vendor over the IRS reporting limit can mean filing a 1099. Check the current
          rules.
        </Text>
        {vendor_totals.length === 0 && (
          <Text style={styles.detail}>No vendors recorded for this selection</Text>
        )}
        {shown_vendors.map((row) => (
          <View key={row.vendor} style={styles.property_row}>
            <Text style={styles.bar_name}>{row.vendor}</Text>
            <Text style={styles.bar_amount}>{formatCurrency(row.total)}</Text>
          </View>
        ))}
        {vendor_totals.length > 5 && (
          <Pressable
            onPress={() => setShowAllVendors(!show_all_vendors)}
            hitSlop={{ top: 12, bottom: 12 }}
            accessibilityRole="button"
          >
            <Text style={styles.link_text}>
              {show_all_vendors ? 'Show fewer' : 'Show all ' + vendor_totals.length}
            </Text>
          </Pressable>
        )}
      </Card>

      <TextInput
        style={styles.search_input}
        placeholder="Search notes, vendor, category, or property"
        placeholderTextColor={COLORS.text_muted}
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
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: sort_by === option }}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </View>
      {category_filter !== null && (
        <Pressable
          style={styles.filter_chip}
          onPress={() => setCategoryFilter(null)}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={'Clear the ' + category_filter + ' filter'}
        >
          {/* prettier-ignore */}
          <Text style={styles.chip_text}>Category: {category_filter}  ✕</Text>
        </Pressable>
      )}
    </View>
  );

  // the first load from the server, before there's even a saved copy to show
  if (expense_store.is_remote && expense_store.status === 'loading' && expenses.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: SPACING.md }]}>
        <SkeletonList rows={6} />
      </View>
    );
  }
  if (expense_store.is_remote && expense_store.status === 'error' && expenses.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={expense_store.error_message} onRetry={expense_store.refresh} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <FlatList
        refreshing={expense_store.refreshing}
        onRefresh={expense_store.is_remote ? expense_store.refresh : undefined}
        data={rows}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg + 56 }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={
          <EmptyState
            illustration="empty_expenses"
            title="No expenses match"
            message="Change the year or filters, or add an expense above."
            action_label="Add Expense"
            action_icon="add-circle-outline"
            onAction={openNewForm}
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={styles.month_header}>{item.title}</Text>;
          }
          const expense = item.expense;
          const linked_order = orders.find((order) => order.id === expense.work_order_id);
          const receipts = expense.receipts || [];
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => openEditForm(expense.id)}
              accessibilityRole="button"
              accessibilityLabel={
                expense.category + ', ' + formatCurrency(expense.amount) + ', ' + expense.date
              }
              accessibilityHint="Opens the expense to edit it"
            >
              {/* the fintech pass: a tinted icon on the left, the category and the amount on one line */}
              <IconCircle
                icon={expense.is_capital ? 'trending-up-outline' : 'receipt-outline'}
                tone={expense.is_capital ? 'accent' : 'neutral'}
              />
              <View style={styles.row_text}>
                <View style={styles.row_top}>
                  <Text style={styles.row_category}>{expense.category}</Text>
                  <Text style={styles.row_amount}>{formatCurrency(expense.amount)}</Text>
                </View>
                <Text style={styles.detail}>{formatDate(expense.date)}</Text>
                <Text style={styles.detail}>{expense.property}</Text>
                {expense.vendor ? <Text style={styles.detail}>{expense.vendor}</Text> : null}
                <View style={styles.tag_row}>
                  {expense.is_capital && (
                    <View style={[styles.tag, styles.capital_tag]}>
                      <Text style={[styles.tag_text, styles.capital_text]}>
                        Capital improvement
                      </Text>
                    </View>
                  )}
                  {expense.billed_to_tenant && (
                    <View style={[styles.tag, styles.billed_tag]}>
                      <Text style={[styles.tag_text, styles.billed_text]}>
                        Billed to tenant · {formatCurrency(expense.recovered || 0)} back
                      </Text>
                    </View>
                  )}
                  {expense.recurring_id && (
                    <View style={[styles.tag, styles.recurring_tag]}>
                      <Text style={[styles.tag_text, styles.recurring_text]}>Recurring</Text>
                    </View>
                  )}
                  {expense.split_group && (
                    <View style={[styles.tag, styles.recurring_tag]}>
                      <Text style={[styles.tag_text, styles.recurring_text]}>Split</Text>
                    </View>
                  )}
                  {linked_order && (
                    <Pressable
                      style={[styles.tag, styles.order_tag]}
                      hitSlop={{ top: 12, bottom: 12 }}
                      accessibilityRole="link"
                      accessibilityLabel={'Open work order ' + linked_order.title}
                      onPress={() =>
                        props.navigation.navigate('WorkOrderDetail', {
                          workOrderId: linked_order.id,
                        })
                      }
                    >
                      <Text style={[styles.tag_text, styles.order_text]} numberOfLines={1}>
                        Work order: {linked_order.title}
                      </Text>
                    </Pressable>
                  )}
                  {receipts.length === 0 && (
                    <View style={[styles.tag, styles.missing_tag]}>
                      <Text style={[styles.tag_text, styles.missing_text]}>No receipt</Text>
                    </View>
                  )}
                </View>
              </View>
              {receipts.length > 0 && (
                <View style={styles.receipt_box}>
                  <ReceiptImage value={receipts[0]} style={styles.receipt_thumb} />
                  <Text style={styles.detail}>
                    {receipts.length} receipt{receipts.length > 1 ? 's' : ''}
                  </Text>
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
          <Pressable
            onPress={undoDelete}
            style={styles.undo_button}
            accessibilityRole="button"
            accessibilityLabel="Undo delete"
          >
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
      {tax_open && (
        <TaxSummarySheet visible years={years} year={year} onClose={() => setTaxOpen(false)} />
      )}
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

const styles = themedStyles((COLORS) => ({
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
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  add_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  scan_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  mileage_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  report_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  grey_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  export_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  section_label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  chip_row: {
    ...list_styles.chip_row,
  },
  chip: {
    ...list_styles.chip,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_text: {
    ...list_styles.chip_text,
  },
  filter_chip: {
    ...list_styles.chip,
    ...list_styles.chip_active,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  heading: {
    ...list_styles.heading,
  },
  detail: {
    ...list_styles.detail,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  link_text: {
    ...TYPE.label,
    color: COLORS.cta,
    marginTop: SPACING.xs,
    textDecorationLine: 'underline',
  },
  summary_label: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  summary_total: {
    ...TYPE.display,
    ...NUMBERS,
    color: COLORS.text,
    marginVertical: SPACING.xs,
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
    marginBottom: SPACING.xs,
  },
  bar_name: {
    ...TYPE.body_small,
    flex: 1,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  bar_amount: {
    ...NUMBERS,
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text,
  },
  over_budget_text: {
    color: COLORS.danger_text,
  },
  bar_track: {
    height: SIZES.progress,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.hairline,
    overflow: 'hidden',
  },
  bar_fill: {
    height: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
  },
  over_budget_fill: {
    backgroundColor: COLORS.danger,
  },
  property_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  search_input: {
    ...list_styles.search_input,
    marginVertical: SPACING.sm,
  },
  sort_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sort_label: {
    ...list_styles.label,
  },
  month_header: {
    ...TYPE.label,
    color: COLORS.text_muted,
    textTransform: 'uppercase',
    letterSpacing: TYPE.overline.letterSpacing,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row: {
    ...list_styles.row,
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  row_text: {
    flex: 1,
  },
  row_top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  row_amount: {
    ...TYPE.subheading,
    ...NUMBERS,
    color: COLORS.text,
    textAlign: 'right',
  },
  row_category: {
    ...TYPE.subheading,
    color: COLORS.text,
    flexShrink: 1,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs + SPACING.xxs,
    marginTop: SPACING.xs + SPACING.xxs,
  },
  // the Hearth pass: tags are colored words with no pill behind them
  tag: {
    paddingVertical: SPACING.xxs,
    maxWidth: SIZES.content_max_width / 2,
  },
  capital_tag: {
    backgroundColor: 'transparent',
  },
  billed_tag: {
    backgroundColor: 'transparent',
  },
  recurring_tag: {
    backgroundColor: 'transparent',
  },
  order_tag: {
    backgroundColor: 'transparent',
  },
  missing_tag: {
    backgroundColor: 'transparent',
  },
  tag_text: {
    ...TYPE.caption,
    fontSize: TYPE.micro.fontSize,
    lineHeight: TYPE.micro.lineHeight,
    fontFamily: TYPE.label.fontFamily,
  },
  receipt_box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  receipt_thumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
  undo_bar: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.toast_background,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.high,
  },
  undo_text: {
    ...TYPE.body_small,
    color: COLORS.text_light,
  },
  undo_action: {
    ...TYPE.label,
    fontSize: TYPE.body_small.fontSize,
    color: COLORS.brand_tint,
  },
  undo_button: {
    minHeight: SIZES.touch,
    minWidth: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capital_text: {
    color: COLORS.accent_text,
  },
  billed_text: {
    color: COLORS.cta,
  },
  recurring_text: {
    color: COLORS.text_muted,
  },
  order_text: {
    color: COLORS.cta,
  },
  missing_text: {
    color: COLORS.warning_text,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
}));

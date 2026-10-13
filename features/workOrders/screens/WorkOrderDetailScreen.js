import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import AddExpenseModal from '../../expenses/components/AddExpenseModal';
import RemoteImage from '../../../components/RemoteImage';
import ErrorState from '../../../components/ErrorState';
import ImageViewerModal from '../../messages/components/ImageViewerModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

const priority_options = ['Emergency', 'Normal', 'Low'];

// in real mode a push tap can open an order that isn't in the list yet, so this asks the server for it first
// the content only shows once the order is here, so its text boxes start with the real notes and contractor
function WorkOrderDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const { getOrder, is_remote, ensureOrder } = useWorkOrders();
  const order_id = props.route.params.order_id;
  const order = getOrder(order_id);
  const [load_error, setLoadError] = useState('');
  // goes up on Try Again so the effect asks again
  const [attempt, setAttempt] = useState(0);

  const has_order = !!order;
  // the context hands out a new function every render, so the effect reads the latest one from here
  const ensure = useRef(ensureOrder);
  useEffect(() => {
    ensure.current = ensureOrder;
  });

  useEffect(() => {
    if (has_order || !is_remote) {
      return;
    }
    ensure.current(order_id).catch((error) => {
      console.log('Could not load the work order', error.message);
      setLoadError(error.message);
    });
  }, [order_id, attempt, is_remote, has_order]);

  if (!order && is_remote) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top + SPACING.md }]}>
        {load_error ? (
          <ErrorState
            message={load_error}
            onRetry={() => {
              setLoadError('');
              setAttempt((current) => current + 1);
            }}
          />
        ) : (
          <ActivityIndicator color={COLORS.title} size="large" />
        )}
      </View>
    );
  }

  return <WorkOrderDetailContent {...props} key={order_id} />;
}

function WorkOrderDetailContent(props) {
  const insets = useSafeAreaInsets();
  const {
    getOrder,
    startWorkOrder,
    resolveWorkOrder,
    setPriority,
    setNotes,
    setContractorInfo,
    addExpense,
    properties: known_properties,
  } = useWorkOrders();

  const order_id = props.route.params.order_id;
  const order = getOrder(order_id);

  // the text boxes keep their own copy until I tap save, so typing doesn't write on every key
  const [notes_text, setNotesText] = useState(order ? order.notes || '' : '');
  const [contractor_text, setContractorText] = useState(order ? order.contractor || '' : '');
  const [estimate_text, setEstimateText] = useState(
    order && order.estimate !== null && order.estimate !== undefined ? String(order.estimate) : '',
  );
  const [show_expense_form, setShowExpenseForm] = useState(false);
  // the photo open full size, null when the viewer is closed
  const [viewer_url, setViewerUrl] = useState(null);

  // if the order can't be found I show a simple message instead of crashing
  if (!order) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + SPACING.md }]}>
        <Text style={styles.detail}>That work order could not be found.</Text>
        <PrimaryButton title="Back" onPress={() => props.navigation.goBack()} />
      </View>
    );
  }

  const expenses = order.expenses || [];
  const expense_total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const has_estimate = order.estimate !== null && order.estimate !== undefined;
  const difference = has_estimate ? expense_total - order.estimate : 0;

  // in real mode the changes go to the server and can fail, so I show why (the local ones never throw)
  async function tryAction(action) {
    try {
      await action();
      return true;
    } catch (error) {
      Alert.alert('Could not update the work order', error.message);
      return false;
    }
  }

  async function saveNotes() {
    if (await tryAction(() => setNotes(order_id, notes_text.trim()))) {
      Alert.alert('Saved', 'Notes updated.');
    }
  }

  // I check the estimate before saving so a bad number never gets stored
  async function saveContractor() {
    let parsed_estimate = null;
    if (estimate_text.trim() !== '') {
      parsed_estimate = parseFloat(estimate_text);
      if (isNaN(parsed_estimate) || parsed_estimate < 0) {
        Alert.alert('Check the estimate', 'Type a dollar amount, or leave it blank.');
        return;
      }
    }
    if (
      await tryAction(() => setContractorInfo(order_id, contractor_text.trim(), parsed_estimate))
    ) {
      Alert.alert('Saved', 'Contractor and estimate updated.');
    }
  }

  // ask first so a stray tap doesn't close out a request
  function confirmResolve() {
    Alert.alert('Resolve work order', 'Mark this request as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: () => tryAction(() => resolveWorkOrder(order_id)) },
    ]);
  }

  function saveExpense(expense) {
    addExpense(order_id, expense);
    setShowExpenseForm(false);
  }

  return (
    // iOS needs padding to lift the form, Android already resizes the window so it uses height
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.md,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle>Details</ScreenTitle>

        <Card>
          <Text style={styles.heading}>{order.title}</Text>
          <Text style={styles.detail}>{order.property}</Text>
          <Text style={styles.detail}>{order.tenant || 'No tenant'}</Text>
          <Text style={styles.detail}>Status: {order.status}</Text>
          {order.description ? <Text style={styles.detail}>{order.description}</Text> : null}
          {/* I only show the issue photo if the work order has one */}
          {order.photo && <Image source={order.photo} style={styles.photo} />}
          {/* server orders can have up to 10 photos, tapping one opens it full size */}
          {order.photos && order.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photo_row}>
              {order.photos.map((key) => (
                <RemoteImage
                  key={key}
                  attachment_key={key}
                  style={styles.photo_thumb}
                  onPress={setViewerUrl}
                />
              ))}
            </ScrollView>
          )}
        </Card>

        <Card>
          <Text style={styles.heading}>History</Text>
          <Text style={styles.detail}>Created: {formatDate(order.created_at)}</Text>
          <Text style={styles.detail}>
            Started: {order.started_at ? formatDate(order.started_at) : '—'}
          </Text>
          <Text style={styles.detail}>
            Resolved: {order.resolved_at ? formatDate(order.resolved_at) : '—'}
          </Text>
        </Card>

        <Card>
          <Text style={styles.heading}>Priority</Text>
          <View style={styles.chip_row}>
            {priority_options.map((option) => (
              <Pressable
                key={option}
                onPress={() => tryAction(() => setPriority(order_id, option))}
                style={[styles.chip, (order.priority || 'Normal') === option && styles.chip_active]}
              >
                <Text style={styles.chip_text}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.heading}>Landlord notes</Text>
          <TextInput
            style={[styles.input, styles.notes_input]}
            placeholder="Notes about this request"
            placeholderTextColor={COLORS.text}
            multiline
            value={notes_text}
            onChangeText={setNotesText}
          />
          <PrimaryButton title="Save Notes" style={styles.save_button} onPress={saveNotes} />
        </Card>

        <Card>
          <Text style={styles.heading}>Contractor</Text>
          <TextInput
            style={styles.input}
            placeholder="Who is doing the work?"
            placeholderTextColor={COLORS.text}
            value={contractor_text}
            onChangeText={setContractorText}
          />
          <TextInput
            style={styles.input}
            placeholder="Estimate (e.g. 250.00)"
            placeholderTextColor={COLORS.text}
            keyboardType="decimal-pad"
            value={estimate_text}
            onChangeText={setEstimateText}
          />
          <PrimaryButton
            title="Save Contractor"
            style={styles.save_button}
            onPress={saveContractor}
          />
        </Card>

        <Card>
          <Text style={styles.heading}>Costs</Text>
          <Text style={styles.detail}>
            Estimate: {has_estimate ? '$' + order.estimate.toFixed(2) : 'Not set'}
          </Text>
          <Text style={styles.detail}>Actual: ${expense_total.toFixed(2)}</Text>
          {/* I only compare the two once there's an estimate to compare against */}
          {has_estimate && (
            <Text style={[styles.detail, difference > 0 && styles.over_budget]}>
              {difference > 0
                ? '$' + difference.toFixed(2) + ' over estimate'
                : '$' + Math.abs(difference).toFixed(2) + ' under estimate'}
            </Text>
          )}
        </Card>

        <Card>
          <Text style={styles.heading}>Expenses</Text>
          {expenses.length === 0 && <Text style={styles.detail}>No expenses yet</Text>}
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.expense_row}>
              <View style={styles.expense_text}>
                <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
                <Text style={styles.detail}>{expense.description || 'No description'}</Text>
              </View>
              {expense.photo_uri && (
                <Image source={{ uri: expense.photo_uri }} style={styles.thumb} />
              )}
            </View>
          ))}
        </Card>

        <View style={styles.button_area}>
          <View style={styles.button_row}>
            <PrimaryButton
              title="Add Expense"
              icon="cash-outline"
              style={styles.expense_button}
              onPress={() => setShowExpenseForm(true)}
            />
            {order.status === 'Open' && (
              <PrimaryButton
                title="Start Work"
                icon="play-circle-outline"
                style={styles.start_button}
                onPress={() => tryAction(() => startWorkOrder(order_id))}
              />
            )}
            {order.status === 'In Progress' && (
              <PrimaryButton
                title="Mark Resolved"
                icon="checkmark-circle-outline"
                style={styles.resolve_button}
                onPress={confirmResolve}
              />
            )}
          </View>
          <View style={styles.button_row}>
            <PrimaryButton
              title="Message Tenant"
              icon="chatbubble-ellipses-outline"
              style={styles.message_button}
              onPress={() => props.navigation.navigate('Messages', { tenant: order.tenant })}
            />
            <PrimaryButton
              title="Back"
              icon="arrow-back-outline"
              style={styles.back_button}
              onPress={() => props.navigation.goBack()}
            />
          </View>
        </View>
      </ScrollView>
      <AddExpenseModal
        visible={show_expense_form}
        default_property={order.property}
        property_names={known_properties}
        onSave={saveExpense}
        onClose={() => setShowExpenseForm(false)}
      />
      <ImageViewerModal url={viewer_url} onClose={() => setViewerUrl(null)} />
    </KeyboardAvoidingView>
  );
}

export default WorkOrderDetailScreen;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
  },
  photo_row: {
    marginTop: SPACING.sm,
  },
  photo_thumb: {
    width: 120,
    height: 120,
    marginRight: SPACING.sm,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
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
  over_budget: {
    color: COLORS.danger,
    opacity: 1,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  chip_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  notes_input: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  save_button: {
    backgroundColor: COLORS.success,
    marginHorizontal: 0,
  },
  expense_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  expense_text: {
    flex: 1,
  },
  amount: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: FONT_SIZES.body,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  button_area: {
    width: '90%',
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  expense_button: {
    flex: 1,
    backgroundColor: COLORS.action,
    marginHorizontal: 0,
  },
  start_button: {
    flex: 1,
    backgroundColor: COLORS.warning,
    marginHorizontal: 0,
  },
  resolve_button: {
    flex: 1,
    backgroundColor: COLORS.success,
    marginHorizontal: 0,
  },
  message_button: {
    flex: 1,
    backgroundColor: COLORS.accent,
    marginHorizontal: 0,
  },
  back_button: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    marginHorizontal: 0,
  },
});

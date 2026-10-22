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
import { useHeaderHeight } from '@react-navigation/elements';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import AddExpenseModal from '../../expenses/components/AddExpenseModal';
import RemoteImage from '../../../components/RemoteImage';
import ErrorState from '../../../components/ErrorState';
import ImageViewerModal from '../../messages/components/ImageViewerModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useMessages } from '../../messages/context/MessagesContext';
import { openConversationFor } from '../../messages/utils/openConversation';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, TYPE, RADIUS, SIZES, NUMBERS, BORDER } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import StatusLabel from '../../../components/ui/StatusLabel';
import { formatCurrency } from '../../../utils/formatCurrency';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import ReceiptImage from '../../../components/ReceiptImage';

const priority_options = ['Emergency', 'Normal', 'Low'];

// in real mode a push tap can open an order that isn't in the list yet, so this asks the server for it first
// the content only shows once the order is here, so its text boxes start with the real notes and contractor
function WorkOrderDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const { getOrder, is_remote, ensureOrder } = useWorkOrders();
  const order_id = props.route.params.workOrderId;
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
      <View style={[styles.flex, styles.center, { paddingBottom: insets.bottom }]}>
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
  // the header sits above this screen now, so the keyboard lift has to count its height too
  const header_height = useHeaderHeight();
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
  const { conversations } = useMessages();

  const order_id = props.route.params.workOrderId;
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
      <View style={[styles.flex, { paddingTop: SPACING.md }]}>
        <Text style={styles.detail}>That work order could not be found.</Text>
        <PrimaryButton title="Back" variant="secondary" onPress={() => props.navigation.goBack()} />
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
      keyboardVerticalOffset={header_height}
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          {/* the summary up top: the issue itself big, then where, who, and its status */}
          <Text style={[styles.heading, styles.title_big]}>{order.title}</Text>
          <Text style={styles.detail}>{order.property}</Text>
          <Text style={styles.detail}>{order.tenant || 'No tenant'}</Text>
          <View style={styles.pill_row}>
            <StatusLabel label={order.status} />
            <StatusLabel label={order.priority || 'Normal'} />
          </View>
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
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel={option + ' priority'}
                accessibilityState={{ selected: (order.priority || 'Normal') === option }}
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
            placeholderTextColor={COLORS.text_muted}
            multiline
            value={notes_text}
            onChangeText={setNotesText}
          />
          <PrimaryButton
            title="Save Notes"
            icon="save-outline"
            variant="secondary"
            style={styles.save_button}
            onPress={saveNotes}
          />
        </Card>

        <Card>
          <Text style={styles.heading}>Contractor</Text>
          <TextInput
            style={styles.input}
            placeholder="Who is doing the work?"
            placeholderTextColor={COLORS.text_muted}
            value={contractor_text}
            onChangeText={setContractorText}
          />
          <CurrencyInput
            style={styles.input}
            placeholder="Estimate (e.g. 250.00)"
            value={estimate_text}
            onChangeText={setEstimateText}
          />
          <PrimaryButton
            title="Save Contractor"
            icon="save-outline"
            variant="secondary"
            style={styles.save_button}
            onPress={saveContractor}
          />
        </Card>

        <Card>
          <Text style={styles.heading}>Costs</Text>
          {/* the fintech pass: the actual cost is the big figure, the estimate sits under it */}
          <Text style={styles.figure_label}>Actual</Text>
          <Text style={styles.figure}>{formatCurrency(expense_total)}</Text>
          <Text style={styles.detail}>
            Estimate: {has_estimate ? formatCurrency(order.estimate) : 'Not set'}
          </Text>
          {/* I only compare the two once there's an estimate to compare against */}
          {has_estimate && (
            <Text
              style={[
                styles.detail,
                styles.difference,
                difference > 0 ? styles.over_budget : styles.under_budget,
              ]}
            >
              {difference > 0
                ? formatCurrency(difference) + ' over estimate'
                : formatCurrency(Math.abs(difference)) + ' under estimate'}
            </Text>
          )}
        </Card>

        <Card>
          <Text style={styles.heading}>Expenses</Text>
          {expenses.length === 0 && <Text style={styles.detail}>No expenses yet</Text>}
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.expense_row}>
              <View style={styles.expense_text}>
                <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
                <Text style={styles.detail}>{expense.description || 'No description'}</Text>
              </View>
              {expense.photo_uri && <ReceiptImage value={expense.photo_uri} style={styles.thumb} />}
            </View>
          ))}
        </Card>

        <View style={styles.button_area}>
          <View style={styles.button_row}>
            <PrimaryButton
              title="Add Expense"
              icon="cash-outline"
              variant="secondary"
              style={styles.expense_button}
              onPress={() => setShowExpenseForm(true)}
            />
            {order.status === 'Open' && (
              <PrimaryButton
                title="Start Work"
                icon="play-circle-outline"
                variant="primary"
                style={styles.start_button}
                onPress={() => tryAction(() => startWorkOrder(order_id))}
              />
            )}
            {order.status === 'In Progress' && (
              <PrimaryButton
                title="Mark Resolved"
                icon="checkmark-circle-outline"
                text_color={COLORS.text_light}
                style={styles.resolve_button}
                onPress={confirmResolve}
              />
            )}
          </View>
          <View style={styles.button_row}>
            <PrimaryButton
              title="Message Tenant"
              icon="chatbubble-ellipses-outline"
              variant="secondary"
              style={styles.message_button}
              onPress={() =>
                openConversationFor(props.navigation, conversations, order.tenant, order.tenant_id)
              }
            />
            <PrimaryButton
              title="Back"
              icon="arrow-back-outline"
              variant="tertiary"
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
    paddingHorizontal: SIZES.screen_padding,
  },
  heading: {
    ...list_styles.heading,
  },
  detail: {
    ...list_styles.detail,
  },
  over_budget: {
    color: COLORS.danger_text,
    opacity: 1,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  chip_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
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
  input: {
    ...list_styles.field_input,
  },
  notes_input: {
    minHeight: SIZES.row_min_height + SPACING.md,
    textAlignVertical: 'top',
  },
  save_button: {
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
    ...NUMBERS,
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
  },
  button_area: {
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.border,
    width: '100%',
    maxWidth: SIZES.content_max_width,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  expense_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  start_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  resolve_button: {
    flex: 1,
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    marginHorizontal: 0,
  },
  message_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  back_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  // status and priority side by side, each pill says its words so it is never color only
  pill_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  title_big: {
    ...TYPE.title,
    color: COLORS.text,
  },
  figure_label: {
    ...TYPE.overline,
    color: COLORS.text_muted,
  },
  figure: {
    ...TYPE.display,
    ...NUMBERS,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  difference: {
    ...NUMBERS,
    fontFamily: TYPE.label.fontFamily,
    marginTop: SPACING.xs,
  },
  // under the estimate is good news, green, and the words say which way it went too
  under_budget: {
    color: COLORS.success_text,
  },
});

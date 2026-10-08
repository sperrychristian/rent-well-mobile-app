import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import Card from './Card';
import PrimaryButton from './PrimaryButton';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';
import { formatDate } from '../utils/formatDate';

// I keep one color per status so the badge is readable at a glance
const status_colors = {
  'Open': '#D9534F',
  'In Progress': '#F0A530',
  'Resolved': '#2E9E5B',
};

// one color per priority so emergencies stand out in the list
const priority_colors = {
  'Emergency': '#B71C1C',
  'Normal': '#6B6B6B',
  'Low': '#3F8F9F',
};

function WorkOrderCard(props) {
  const order = props.order;
  const expenses = order.expenses || [];
  const priority = order.priority || 'Normal';
  // I add up the expenses here so the card can show a running total
  const expense_total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  // estimate can be null, so I check before comparing it to the actual total
  const has_estimate = order.estimate !== null && order.estimate !== undefined;
  const over_budget = has_estimate && expense_total > order.estimate;

  return (
    <Card>
      {/* tapping the top part of the card opens the detail screen */}
      <Pressable onPress={props.onOpenDetail}>
        <View style={styles.top_row}>
          <Text style={styles.title}>{order.title}</Text>
          <View style={[styles.badge, { backgroundColor: status_colors[order.status] }]}>
            <Text style={styles.badge_text}>{order.status}</Text>
          </View>
        </View>
        <Text style={styles.detail}>{order.property}</Text>
        <Text style={styles.detail}>{order.tenant} · {formatDate(order.created_at)}</Text>
        <View style={styles.tag_row}>
          <View style={[styles.badge, { backgroundColor: priority_colors[priority] }]}>
            <Text style={styles.badge_text}>{priority}</Text>
          </View>
        </View>
      </Pressable>
      {/* I only show the landlord note, contractor, and estimate when they've been filled in */}
      {order.notes ? (
        <Text style={styles.note} numberOfLines={2}>Note: {order.notes}</Text>
      ) : null}
      {order.contractor ? (
        <Text style={styles.detail}>Contractor: {order.contractor}</Text>
      ) : null}
      {has_estimate && (
        <Text style={[styles.detail, over_budget && styles.over_budget]}>
          Estimate: ${order.estimate.toFixed(2)} · Actual: ${expense_total.toFixed(2)}
        </Text>
      )}
      {/* I only show the issue photo if the work order has one */}
      {order.photo && <Image source={order.photo} style={styles.issue_photo} />}
      {/* I only show the expense summary once at least one expense exists, tapping it opens the details */}
      {expenses.length > 0 && (
        <Pressable style={styles.expense_section} onPress={props.onViewExpenses}>
          <Text style={styles.detail}>
            Expenses: ${expense_total.toFixed(2)} ({expenses.length}) · Tap to view
          </Text>
          <View style={styles.thumb_row}>
            {expenses
              .filter((expense) => expense.photo_uri)
              .map((expense) => (
                <Image key={expense.id} source={{ uri: expense.photo_uri }} style={styles.thumb} />
              ))}
          </View>
        </Pressable>
      )}
      {/* put the action buttons in rows so they sit side by side */}
      <View style={styles.button_row}>
        <PrimaryButton
          title="Add Expense"
          icon="cash-outline"
          style={styles.expense_button}
          onPress={props.onAddExpense}
        />
        {/* open orders get a start button, in progress orders get the resolve button, resolved get neither */}
        {order.status === 'Open' && (
          <PrimaryButton
            title="Start Work"
            icon="play-circle-outline"
            style={styles.start_button}
            onPress={props.onStart}
          />
        )}
        {order.status === 'In Progress' && (
          <PrimaryButton
            title="Mark Resolved"
            icon="checkmark-circle-outline"
            style={styles.resolve_button}
            onPress={props.onResolve}
          />
        )}
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Message"
          icon="chatbubble-ellipses-outline"
          style={styles.message_button}
          onPress={props.onMessage}
        />
        <PrimaryButton
          title="Details"
          icon="document-text-outline"
          style={styles.details_button}
          onPress={props.onOpenDetail}
        />
      </View>
    </Card>
  );
}

export default WorkOrderCard;

const styles = StyleSheet.create({
  top_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: FONT_SIZES.body,
    marginRight: SPACING.sm,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  badge_text: {
    color: '#FFFFFF',
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  tag_row: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
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
    marginTop: SPACING.sm,
  },
  over_budget: {
    color: '#D9534F',
    opacity: 1,
  },
  issue_photo: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  expense_section: {
    marginTop: SPACING.sm,
  },
  thumb_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  expense_button: {
    flex: 1,
    backgroundColor: '#2F6FED',
    marginHorizontal: 0,
  },
  start_button: {
    flex: 1,
    backgroundColor: '#F0A530',
    marginHorizontal: 0,
  },
  resolve_button: {
    flex: 1,
    backgroundColor: '#2E9E5B',
    marginHorizontal: 0,
  },
  message_button: {
    flex: 1,
    backgroundColor: '#7B4FD6',
    marginHorizontal: 0,
  },
  details_button: {
    flex: 1,
    backgroundColor: '#6B6B6B',
    marginHorizontal: 0,
  },
});
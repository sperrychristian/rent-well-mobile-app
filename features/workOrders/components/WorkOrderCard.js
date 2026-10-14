import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import RemoteImage from '../../../components/RemoteImage';
import StatusPill from '../../../components/ui/StatusPill';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../../../theme';
import { formatDate } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

// I keep one color per status so the badge is readable at a glance
export const status_colors = {
  'Open': COLORS.danger,
  'In Progress': COLORS.warning,
  'Resolved': COLORS.success,
};

// one color per priority so emergencies stand out in the list
export const priority_colors = {
  'Emergency': COLORS.priority_emergency,
  'Normal': COLORS.secondary,
  'Low': COLORS.priority_low,
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
    <Card style={styles.card}>
      {/* tapping the top part of the card opens the detail screen */}
      <Pressable
        onPress={props.onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={order.title + ', ' + order.status + ', ' + priority + ' priority'}
        accessibilityHint="Opens the work order details"
      >
        <View style={styles.top_row}>
          <Text style={styles.title}>{order.title}</Text>
          <StatusPill label={order.status} />
        </View>
        <Text style={styles.detail}>{order.property}</Text>
        {/* an owner-made order can have no tenant, so the name can be empty */}
        <Text style={styles.detail}>
          {order.tenant || 'No tenant'} · {formatDate(order.created_at)}
        </Text>
        {order.description ? (
          <Text style={styles.detail} numberOfLines={2}>
            {order.description}
          </Text>
        ) : null}
        <View style={styles.tag_row}>
          <StatusPill label={priority} />
        </View>
      </Pressable>
      {/* only show the landlord note, contractor, and estimate when they've been filled in */}
      {order.notes ? (
        <Text style={styles.note} numberOfLines={2}>
          Note: {order.notes}
        </Text>
      ) : null}
      {order.contractor ? <Text style={styles.detail}>Contractor: {order.contractor}</Text> : null}
      {has_estimate && (
        <Text style={[styles.detail, over_budget && styles.over_budget]}>
          Estimate: {formatCurrency(order.estimate)} · Actual: {formatCurrency(expense_total)}
        </Text>
      )}
      {/* I only show the issue photo if the work order has one */}
      {order.photo && <Image source={order.photo} style={styles.issue_photo} />}
      {/* server orders have a list of photos instead, the card shows the first one */}
      {order.photos && order.photos.length > 0 && (
        <View>
          <RemoteImage attachment_key={order.photos[0]} style={styles.issue_photo} />
          {order.photos.length > 1 && (
            <Text style={styles.detail}>+{order.photos.length - 1} more in Details</Text>
          )}
        </View>
      )}
      {/* I only show the expense summary once at least one expense exists, tapping it opens the details */}
      {expenses.length > 0 && (
        <Pressable
          style={styles.expense_section}
          onPress={props.onViewExpenses}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={'Expenses, ' + expenses.length + ', tap to view'}
        >
          <Text style={styles.detail}>
            Expenses: {formatCurrency(expense_total)} ({expenses.length}) · Tap to view
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
          variant="tertiary"
          size="small"
          style={styles.row_button}
          onPress={props.onAddExpense}
        />
        {/* open orders get a start button, in progress orders get the resolve button, resolved get neither */}
        {order.status === 'Open' && (
          <PrimaryButton
            title="Start Work"
            icon="play-circle-outline"
            variant="primary"
            size="small"
            style={styles.row_button}
            onPress={props.onStart}
          />
        )}
        {order.status === 'In Progress' && (
          <PrimaryButton
            title="Mark Resolved"
            icon="checkmark-circle-outline"
            text_color={COLORS.text_light}
            size="small"
            style={[styles.row_button, styles.resolve_button]}
            onPress={props.onResolve}
          />
        )}
      </View>
      <View style={styles.button_row}>
        <PrimaryButton
          title="Message"
          icon="chatbubble-ellipses-outline"
          variant="tertiary"
          size="small"
          style={styles.row_button}
          onPress={props.onMessage}
        />
        <PrimaryButton
          title="Details"
          icon="document-text-outline"
          variant="tertiary"
          size="small"
          style={styles.row_button}
          onPress={props.onOpenDetail}
        />
      </View>
    </Card>
  );
}

export default WorkOrderCard;

const styles = StyleSheet.create({
  // the Hearth pass: each order is a ruled section on the paper with a hairline on top
  card: {
    marginTop: 0,
    paddingVertical: SPACING.md,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  top_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPE.subheading,
    flex: 1,
    color: COLORS.text,
  },
  tag_row: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  note: {
    ...TYPE.body_small,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  over_budget: {
    color: COLORS.danger_text,
    opacity: 1,
  },
  issue_photo: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.sm,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  // the next status step is the bright button, the rest are outlined so the card doesn't turn into a rainbow
  row_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  resolve_button: {
    backgroundColor: COLORS.cta,
    borderColor: COLORS.cta,
  },
});

import { View, Text } from 'react-native';
import StatusLabel from '../../../components/ui/StatusLabel';
import { leaseStatusLabel, daysLine, shortLeaseDate } from '../utils/leaseHelpers';
import { SPACING, TYPE, BORDER, NUMBERS } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// one lease as plain ruled lines on the paper: the status, the dates, the days left, the notice, and notes
// tenants see the same block without the notes (the server never sends them a tenant's copy anyway)
// props: lease (derived), today, show_notes
function LeaseBlock(props) {
  const lease = props.lease;
  const status = leaseStatusLabel(lease);
  const lines = [];
  if (lease.lease_status === 'none') {
    lines.push(['Lease', 'Not recorded yet']);
  } else {
    lines.push(['Starts', shortLeaseDate(lease.lease_start_on, props.today) || 'Not set']);
    lines.push([
      'Ends',
      lease.lease_term === 'month_to_month'
        ? 'Month to month'
        : shortLeaseDate(lease.lease_end_on, props.today),
    ]);
    lines.push(['Time left', daysLine(lease)]);
    lines.push(['Renewal notice', lease.renewal_notice_days + ' days']);
  }
  return (
    <View>
      <StatusLabel
        label={status.label}
        tone={status.tone}
        icon={status.icon}
        style={styles.status}
      />
      {lines.map(([label, value]) => (
        <View key={label} style={styles.line} accessible accessibilityLabel={label + ', ' + value}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, NUMBERS]}>{value}</Text>
        </View>
      ))}
      {props.show_notes && lease.lease_notes ? (
        <Text style={styles.notes}>{lease.lease_notes}</Text>
      ) : null}
    </View>
  );
}

export default LeaseBlock;

const styles = themedStyles((COLORS) => ({
  status: {
    marginBottom: SPACING.sm,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  label: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  value: {
    ...TYPE.body,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  notes: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
}));

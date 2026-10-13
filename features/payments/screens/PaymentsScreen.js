import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { COLORS, SPACING, TYPE } from '../../../theme';
import EmptyState from '../../../components/ui/EmptyState';
import ListRow from '../../../components/ui/ListRow';

// a few made-up payment ids so the detail screen has something to open, the real ones will come from the server
const sample_payments = {
  owner: [
    { id: 'pay-1001', label: 'October rent, 123 Maple St, Unit 2' },
    { id: 'pay-1002', label: 'October rent, 48 Cedar Ave' },
  ],
  tenant: [
    { id: 'pay-2001', label: 'October rent' },
    { id: 'pay-2002', label: 'September rent' },
  ],
};

// stub for the assignment: one screen for both roles, the note says what each one will see
// the demo has no account, so it gets the owner version like the rest of the demo
function PaymentsScreen(props) {
  const insets = useSafeAreaInsets();
  // the demo picks a side now, so the tenant demo gets the tenant version
  const role = useAppRole();
  const is_tenant = role === 'tenant';
  const payments = is_tenant ? sample_payments.tenant : sample_payments.owner;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
    >
      <Card>
        {/* the pixel card stands in until real payments exist */}
        <EmptyState
          illustration="empty_payments"
          title="Coming soon"
          message={
            is_tenant
              ? 'This is where you will see what rent is due, pay it, and look back at past payments.'
              : 'This is where you will see rent collected for each unit, who is paid up, and who is late.'
          }
          style={styles.empty}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>Sample payments</Text>
        {payments.map((payment) => (
          // each sample is a row now, tapping it opens the same detail the Open button did
          <ListRow
            key={payment.id}
            title={payment.label}
            subtitle={'Open ' + payment.id}
            icon="cash-outline"
            icon_color={COLORS.success_text}
            divider={payment !== payments[payments.length - 1]}
            onPress={() => props.navigation.navigate('PaymentDetail', { paymentId: payment.id })}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

export default PaymentsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    ...TYPE.body,
    color: COLORS.text,
  },
  empty: {
    paddingVertical: SPACING.md,
    paddingHorizontal: 0,
  },
});

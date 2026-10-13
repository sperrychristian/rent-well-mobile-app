import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { useAuth } from '../../auth/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

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
  const { role } = useAuth();
  const is_tenant = role === 'tenant';
  const payments = is_tenant ? sample_payments.tenant : sample_payments.owner;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
    >
      <Card>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          {is_tenant
            ? 'This is where you will see what rent is due, pay it, and look back at past payments.'
            : 'This is where you will see rent collected for each unit, who is paid up, and who is late.'}
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Sample payments</Text>
        {payments.map((payment) => (
          <View key={payment.id} style={styles.row}>
            <Text style={styles.body}>{payment.label}</Text>
            <PrimaryButton
              title={'Open ' + payment.id}
              icon="cash-outline"
              text_color={COLORS.text_light}
              onPress={() => props.navigation.navigate('PaymentDetail', { paymentId: payment.id })}
              style={styles.open_button}
            />
          </View>
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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  row: {
    marginBottom: SPACING.md,
  },
  open_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.action,
  },
});

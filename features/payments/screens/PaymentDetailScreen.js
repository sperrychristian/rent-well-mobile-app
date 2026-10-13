import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

// stub for the assignment: it only gets the payment's id and shows it, the real screen will look the payment up
function PaymentDetailScreen(props) {
  const insets = useSafeAreaInsets();
  // the id comes in as a route param, it's never the whole payment
  const payment_id =
    props.route.params && props.route.params.paymentId ? props.route.params.paymentId : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingHorizontal: SPACING.md,
        paddingBottom: insets.bottom + SPACING.lg,
      }}
    >
      <Card>
        <Text style={styles.label}>Payment ID</Text>
        <Text style={styles.id}>{payment_id || 'No payment picked'}</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          This will show the amount, the date it was paid, the unit, and a receipt you can share.
        </Text>
      </Card>
      <PrimaryButton
        title="Back to Payments"
        icon="arrow-back-outline"
        variant="secondary"
        onPress={() => props.navigation.goBack()}
        style={styles.back_button}
      />
    </ScrollView>
  );
}

export default PaymentDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text_muted,
  },
  id: {
    ...TYPE.title,
    color: COLORS.cta,
    marginTop: SPACING.xs,
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
  back_button: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    marginHorizontal: 0,
  },
});

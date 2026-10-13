import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// stub for the assignment: it only gets the payment's id and shows it, the real screen will look the payment up
function PaymentDetailScreen(props) {
  const insets = useSafeAreaInsets();
  // the id comes in as a route param, it's never the whole payment
  const payment_id =
    props.route.params && props.route.params.paymentId ? props.route.params.paymentId : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
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
        text_color={COLORS.text_light}
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
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    opacity: 0.8,
  },
  id: {
    color: COLORS.title,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.title,
    marginTop: SPACING.xs,
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
  back_button: {
    width: '90%',
    alignSelf: 'center',
    marginHorizontal: 0,
    backgroundColor: COLORS.secondary,
  },
});

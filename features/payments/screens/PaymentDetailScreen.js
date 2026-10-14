import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/ui/Card';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import SectionHeader from '../../../components/ui/SectionHeader';
import StatusPill from '../../../components/ui/StatusPill';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import RemoteImage from '../../../components/RemoteImage';
import { useLedger } from '../context/LedgerContext';
import { useLedgerReview } from '../hooks/useLedgerReview';
import { formatCents } from '../../../utils/formatCurrency';
import { paymentPill, methodLabel, timelineFor } from '../utils/ledgerHelpers';
import { shareReceipt } from '../utils/shareReceipt';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../../../theme';

const event_icons = {
  recorded: 'create-outline',
  claimed: 'paper-plane-outline',
  confirmed: 'checkmark-circle-outline',
  rejected: 'close-circle-outline',
  voided: 'remove-circle-outline',
};

// stub for the assignment: it only gets the payment's id and shows it, the real screen will look the payment up
// (the payments pass made it the real screen, it looks the payment up in the ledger store now)
// one payment's record: the amount, its status, who sent it and how, what happened to it over time,
// the receipt photo, a text receipt to share, and the landlord's confirm, reject, or void
// the tenant sees the same record, read only
// the only param is paymentId, the payment comes from the ledger store (or the server, for a push tap)
function PaymentDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const ledger_store = useLedger();
  const review = useLedgerReview();
  // the id comes in as a route param, it's never the whole payment
  const payment_id =
    props.route.params && props.route.params.paymentId ? props.route.params.paymentId : null;
  const found = payment_id ? ledger_store.findPayment(payment_id) : null;
  // asking the server only happens when it's not in the list yet, like after a push tap
  const [looking, setLooking] = useState(!found && ledger_store.mode === 'real');
  const [sharing, setSharing] = useState(false);
  const is_owner = ledger_store.role === 'owner';

  useEffect(() => {
    if (found || ledger_store.mode !== 'real' || !payment_id) {
      return undefined;
    }
    let active = true;
    ledger_store
      .ensurePayment(payment_id)
      .catch((error) => console.log('Could not load the payment', error.message))
      .finally(() => {
        if (active) {
          setLooking(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment_id]);

  if (!found) {
    return (
      <View style={[styles.container, styles.missing]}>
        {looking || ledger_store.status === 'loading' ? (
          <SkeletonList rows={3} />
        ) : (
          <EmptyState
            illustration="empty_payments"
            title="Payment not found"
            message="It may have been removed, or it belongs to another account."
            action_label="Go Back"
            action_icon="arrow-back-outline"
            onAction={() => props.navigation.goBack()}
          />
        )}
      </View>
    );
  }

  const payment = found.payment;
  const ledger = found.ledger;
  const pill = paymentPill(payment.status);
  const place = ledger.unit_label
    ? ledger.property_name + ', ' + ledger.unit_label
    : ledger.property_name;
  const timeline = timelineFor(payment);

  async function share() {
    setSharing(true);
    try {
      await shareReceipt(payment, ledger, ledger_store.today);
    } catch (error) {
      console.log('Could not share the receipt', error.message);
      Alert.alert("Couldn't share the receipt", error.message);
    }
    setSharing(false);
  }

  const facts = [
    { label: 'Tenant', value: ledger.tenant_name },
    { label: 'Property', value: place },
    { label: 'Paid on', value: payment.paid_on },
    { label: 'Method', value: methodLabel(payment.method) },
    { label: 'Applied to', value: payment.applies_to === 'deposit' ? 'Security deposit' : 'Rent' },
    { label: 'Sent in by', value: payment.source === 'tenant' ? 'Tenant' : 'Landlord' },
  ];
  if (payment.note) {
    facts.push({ label: 'Note', value: payment.note });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <SummaryBlock
          label={payment.is_refund ? 'Refund' : 'Payment'}
          value={formatCents(payment.amount_cents)}
          caption={ledger.tenant_name + ', ' + payment.paid_on}
        >
          <StatusPill label={pill.label} tone={pill.tone} icon={pill.icon} />
        </SummaryBlock>

        {/* why it was turned down or taken back, so both sides can see it */}
        {payment.status === 'rejected' && payment.reject_reason ? (
          <View style={[styles.banner, styles.banner_danger]} accessibilityRole="alert">
            <Ionicons name="close-circle" size={SIZES.icon} color={COLORS.danger_text} />
            <Text style={[styles.banner_text, styles.danger_text]}>
              {'Rejected: ' + payment.reject_reason}
            </Text>
          </View>
        ) : null}
        {payment.status === 'voided' && payment.void_reason ? (
          <View style={[styles.banner, styles.banner_neutral]}>
            <Ionicons name="remove-circle" size={SIZES.icon} color={COLORS.text_muted} />
            <Text style={[styles.banner_text, styles.muted_text]}>
              {'Voided: ' + payment.void_reason}
            </Text>
          </View>
        ) : null}
        {payment.status === 'pending' && !is_owner ? (
          <View style={[styles.banner, styles.banner_warning]}>
            <Ionicons name="hourglass" size={SIZES.icon} color={COLORS.warning_text} />
            <Text style={[styles.banner_text, styles.warning_text]}>
              Waiting for your landlord to confirm they got it. It counts toward your balance once
              they do.
            </Text>
          </View>
        ) : null}

        <Card style={styles.card}>
          {facts.map((fact, index) => (
            <View
              key={fact.label}
              style={[styles.fact, index < facts.length - 1 && styles.fact_divider]}
              accessible
              accessibilityLabel={fact.label + ', ' + fact.value}
            >
              <Text style={styles.fact_label}>{fact.label}</Text>
              <Text style={styles.fact_value}>{fact.value}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <SectionHeader title="Timeline" />
          {timeline.map((event, index) => (
            <View
              key={event.type + event.at}
              style={styles.event}
              accessible
              accessibilityLabel={
                event.title + ', ' + event.date + (event.reason ? ', ' + event.reason : '')
              }
            >
              <View style={styles.event_rail}>
                <Ionicons
                  name={event_icons[event.type] || 'ellipse-outline'}
                  size={SIZES.icon}
                  color={COLORS.cta}
                />
                {index < timeline.length - 1 ? <View style={styles.event_line} /> : null}
              </View>
              <View style={styles.event_words}>
                <Text style={styles.event_title}>{event.title}</Text>
                <Text style={styles.event_date}>{event.date}</Text>
                {event.reason ? <Text style={styles.event_date}>{event.reason}</Text> : null}
              </View>
            </View>
          ))}
        </Card>

        {payment.receipt_key || payment.receipt_uri ? (
          <Card style={styles.card}>
            <SectionHeader title="Receipt photo" />
            {payment.receipt_key ? (
              <RemoteImage attachment_key={payment.receipt_key} style={styles.receipt} />
            ) : (
              <Image
                source={{ uri: payment.receipt_uri }}
                style={styles.receipt}
                accessibilityLabel="Receipt photo"
              />
            )}
          </Card>
        ) : null}

        <Button
          variant="secondary"
          icon="share-outline"
          title="Share Receipt"
          loading={sharing}
          onPress={share}
          style={styles.wide_button}
        />

        {/* the landlord's choices depend on where the payment is: a claim gets confirm or reject, a counted one can be voided */}
        {is_owner && payment.status === 'pending' ? (
          <View style={styles.button_row}>
            <Button
              variant="secondary"
              icon="close-outline"
              title="Reject"
              onPress={() => review.reject(payment)}
              style={styles.half_button}
            />
            <Button
              variant="primary"
              icon="checkmark-outline"
              title="Confirm"
              loading={review.busy_id === payment.id}
              onPress={() => review.confirm(payment)}
              style={styles.half_button}
            />
          </View>
        ) : null}
        {is_owner && payment.status === 'confirmed' ? (
          <Button
            variant="destructive"
            icon="remove-circle-outline"
            title="Void Payment"
            onPress={() => review.voidPayment(payment)}
            style={styles.wide_button}
          />
        ) : null}
        {is_owner ? (
          <Button
            variant="tertiary"
            icon="reader-outline"
            title={'Open ' + ledger.tenant_name + "'s Ledger"}
            onPress={() =>
              props.navigation.navigate('TenantLedger', { tenancyId: ledger.tenancy_id })
            }
            style={styles.wide_button}
          />
        ) : null}
      </ScrollView>
      {review.sheet}
    </View>
  );
}

export default PaymentDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  missing: {
    padding: SPACING.md,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    gap: SPACING.md,
  },
  card: {
    width: '100%',
    marginVertical: 0,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + SPACING.xs,
  },
  banner_danger: {
    backgroundColor: COLORS.danger_tint,
  },
  banner_warning: {
    backgroundColor: COLORS.warning_tint,
  },
  banner_neutral: {
    backgroundColor: COLORS.neutral_tint,
  },
  banner_text: {
    ...TYPE.body_small,
    flexShrink: 1,
  },
  danger_text: {
    color: COLORS.danger_text,
  },
  warning_text: {
    color: COLORS.warning_text,
  },
  muted_text: {
    color: COLORS.text_muted,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  fact_divider: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.border,
  },
  fact_label: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  fact_value: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  event: {
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  event_rail: {
    alignItems: 'center',
    width: SIZES.icon,
  },
  event_line: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xxs,
  },
  event_words: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  event_title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  event_date: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  receipt: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface_raised,
  },
  wide_button: {
    marginHorizontal: 0,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  half_button: {
    flex: 1,
    marginHorizontal: 0,
  },
});

import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusLabel from '../../../components/ui/StatusLabel';
import ProgressLine from '../../../components/ui/ProgressLine';
import Button from '../../../components/ui/Button';
import { formatCents } from '../../../utils/formatCurrency';
import {
  chargeStatusLine,
  paymentStatusLine,
  methodLabel,
  chargeKindLabel,
} from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, BORDER, SIZES, NUMBERS } from '../../../theme';

// the rows the payments screens list: a charge, a payment, a pending claim with its review buttons,
// and a progress bar for collected over expected
// the Hearth pass: plain ruled rows on the paper, the title on top, the status as a line icon and colored
// words under it ("Overdue, was due Oct 1", "Paid Sep 2 by Zelle"), and the amount on the right at 17 medium

// a charge: what it's for, when it's due, how much, and its status
// props: charge (from deriveLedger), onPress (optional, the owner's void), divider
export const ChargeRow = memo(function ChargeRow(props) {
  const charge = props.charge;
  const line = chargeStatusLine(charge);
  const is_voided = charge.status === 'voided';
  const title = charge.description || chargeKindLabel(charge.kind);
  const content = (
    <>
      <View style={styles.middle}>
        <Text style={[styles.title, is_voided && styles.struck]}>{title}</Text>
        <StatusLabel label={line.text} tone={line.tone} icon={line.icon} />
      </View>
      <Text style={[styles.amount, NUMBERS, is_voided && styles.struck]}>
        {formatCents(charge.amount_cents)}
      </Text>
    </>
  );
  const label = title + ', ' + formatCents(charge.amount_cents) + ', ' + line.text;
  const row_style = [styles.row, !props.divider && styles.last];
  if (!props.onPress) {
    return (
      <View style={row_style} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Shows what you can do with this charge"
      style={({ pressed }) => [...row_style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
});

// a payment: method and date, the amount (green with a plus, or a refund with a minus), and its status
// props: payment, onPress (opens Payment Detail), divider, show_name (the tenant's name, for the owner's lists)
export const PaymentRow = memo(function PaymentRow(props) {
  const payment = props.payment;
  const line = paymentStatusLine(payment);
  const counts = payment.status === 'succeeded';
  const amount = formatCents(payment.is_refund ? -payment.amount_cents : payment.amount_cents, {
    signed: counts,
  });
  const title =
    (props.show_name ? props.show_name + ', ' : '') +
    (payment.is_refund
      ? 'Refund'
      : payment.applies_to === 'deposit'
        ? 'Deposit payment'
        : 'Payment');
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={title + ', ' + amount + ', ' + line.text}
      accessibilityHint="Opens the payment record"
      style={({ pressed }) => [
        styles.row,
        !props.divider && styles.last,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.middle}>
        <Text style={[styles.title, payment.status === 'voided' && styles.struck]}>{title}</Text>
        <StatusLabel label={line.text} tone={line.tone} icon={line.icon} />
      </View>
      <Text
        style={[
          styles.amount,
          NUMBERS,
          counts && !payment.is_refund && styles.amount_in,
          counts && payment.is_refund && styles.amount_out,
          !counts && styles.amount_muted,
          payment.status === 'voided' && styles.struck,
        ]}
      >
        {amount}
      </Text>
      <Ionicons name="chevron-forward-outline" size={SIZES.chevron} color={COLORS.text_muted} />
    </Pressable>
  );
});

// a tenant's "I paid" waiting on the landlord: who, how much, how and when, then Confirm and Reject right on the row
// props: payment, name (who sent it), place, busy, onOpen, onConfirm, onReject, divider
export const ClaimRow = memo(function ClaimRow(props) {
  const payment = props.payment;
  const amount = formatCents(payment.amount_cents);
  return (
    <View style={[styles.claim, !props.divider && styles.last]}>
      <Pressable
        onPress={props.onOpen}
        accessibilityRole="button"
        accessibilityLabel={
          props.name +
          ' says they paid ' +
          amount +
          ' by ' +
          methodLabel(payment.method) +
          ' on ' +
          payment.paid_on
        }
        accessibilityHint="Opens the payment record"
        style={({ pressed }) => [styles.claim_top, pressed && styles.pressed]}
      >
        <View style={styles.middle}>
          <Text style={styles.title}>{props.name}</Text>
          <Text style={styles.subtitle}>
            {(props.place ? props.place + ', ' : '') +
              methodLabel(payment.method) +
              ', ' +
              payment.paid_on}
          </Text>
          {payment.note ? <Text style={styles.subtitle}>{'"' + payment.note + '"'}</Text> : null}
        </View>
        <Text style={[styles.amount, NUMBERS]}>{amount}</Text>
      </Pressable>
      <View style={styles.claim_buttons}>
        <Button
          variant="secondary"
          size="small"
          icon="close-outline"
          title="Reject"
          accessibilityLabel={'Reject ' + amount + ' from ' + props.name}
          disabled={props.busy}
          onPress={props.onReject}
          style={styles.claim_button}
        />
        <Button
          variant="primary"
          size="small"
          icon="checkmark-outline"
          title="Confirm"
          accessibilityLabel={'Confirm ' + amount + ' from ' + props.name}
          loading={props.busy}
          onPress={props.onConfirm}
          style={styles.claim_button}
        />
      </View>
    </View>
  );
});

// collected over expected as a bar, the share is 0 to 1
// props: share, label (what screen readers hear), on_brand (white on the indigo card)
// (the Hearth pass: it's the shared green ProgressLine now, on_brand doesn't change anything)
export function ProgressBar(props) {
  return <ProgressLine share={props.share} label={props.label} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.row_min_height,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  // the last row closes the list with a line under it
  last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  middle: {
    flex: 1,
    gap: SPACING.xxs,
  },
  title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  subtitle: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  struck: {
    textDecorationLine: 'line-through',
    color: COLORS.text_muted,
  },
  amount: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  amount_in: {
    color: COLORS.success_text,
  },
  amount_out: {
    color: COLORS.danger_text,
  },
  amount_muted: {
    color: COLORS.text_muted,
  },
  claim: {
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  claim_top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.touch,
  },
  claim_buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  claim_button: {
    flex: 1,
    marginHorizontal: 0,
  },
});

import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import IconCircle from '../../../components/ui/IconCircle';
import StatusPill from '../../../components/ui/StatusPill';
import Button from '../../../components/ui/Button';
import { formatCents } from '../../../utils/formatCurrency';
import { chargePill, paymentPill, methodLabel, chargeKindLabel } from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, BORDER, SIZES, NUMBERS } from '../../../theme';

// the rows the payments screens list: a charge, a payment, a pending claim with its review buttons,
// and a progress bar for collected over expected

const charge_icons = {
  rent: 'home-outline',
  late_fee: 'alarm-outline',
  deposit: 'shield-checkmark-outline',
  other: 'pricetag-outline',
};

// a charge: what it's for, when it's due, how much, and its status
// props: charge (from deriveLedger), onPress (optional, the owner's void), divider
export const ChargeRow = memo(function ChargeRow(props) {
  const charge = props.charge;
  const pill = chargePill(charge.status);
  const left =
    charge.status === 'partial' ||
    (charge.status === 'overdue' && charge.remaining_cents < charge.amount_cents)
      ? formatCents(charge.remaining_cents) + ' left'
      : null;
  const content = (
    <>
      <IconCircle icon={charge_icons[charge.kind] || 'pricetag-outline'} tone="neutral" />
      <View style={styles.middle}>
        <Text style={[styles.title, charge.status === 'voided' && styles.struck]}>
          {charge.description || chargeKindLabel(charge.kind)}
        </Text>
        <Text style={styles.subtitle}>{'Due ' + charge.due_date + (left ? ', ' + left : '')}</Text>
        {charge.status === 'voided' && charge.void_reason ? (
          <Text style={styles.subtitle}>{'Voided: ' + charge.void_reason}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, NUMBERS, charge.status === 'voided' && styles.struck]}>
          {formatCents(charge.amount_cents)}
        </Text>
        <StatusPill label={pill.label} tone={pill.tone} icon={pill.icon} />
      </View>
    </>
  );
  const label =
    (charge.description || chargeKindLabel(charge.kind)) +
    ', ' +
    formatCents(charge.amount_cents) +
    ', due ' +
    charge.due_date +
    ', ' +
    pill.label;
  if (!props.onPress) {
    return (
      <View
        style={[styles.row, props.divider && styles.divider]}
        accessible
        accessibilityLabel={label}
      >
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
      style={({ pressed }) => [
        styles.row,
        props.divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
});

// a payment: method and date, the amount (green with a plus, or a refund with a minus), and its status
// props: payment, onPress (opens Payment Detail), divider, show_name (the tenant's name, for the owner's lists)
export const PaymentRow = memo(function PaymentRow(props) {
  const payment = props.payment;
  const pill = paymentPill(payment.status);
  const counts = payment.status === 'confirmed';
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
  const subtitle = methodLabel(payment.method) + ', ' + payment.paid_on;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={title + ', ' + amount + ', ' + subtitle + ', ' + pill.label}
      accessibilityHint="Opens the payment record"
      style={({ pressed }) => [
        styles.row,
        props.divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      <IconCircle
        icon={payment.is_refund ? 'arrow-undo-outline' : 'cash-outline'}
        tone={counts ? 'success' : pill.tone}
      />
      <View style={styles.middle}>
        <Text style={[styles.title, payment.status === 'voided' && styles.struck]}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.right}>
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
        <StatusPill label={pill.label} tone={pill.tone} icon={pill.icon} />
      </View>
      <Ionicons name="chevron-forward" size={SIZES.icon} color={COLORS.text_muted} />
    </Pressable>
  );
});

// a tenant's "I paid" waiting on the landlord: who, how much, how and when, then Confirm and Reject right on the row
// props: payment, name (who sent it), place, busy, onOpen, onConfirm, onReject, divider
export const ClaimRow = memo(function ClaimRow(props) {
  const payment = props.payment;
  const amount = formatCents(payment.amount_cents);
  return (
    <View style={[styles.claim, props.divider && styles.divider]}>
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
        <IconCircle icon="hourglass-outline" tone="warning" />
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
          variant="secondary"
          size="small"
          icon="checkmark-outline"
          title="Confirm"
          text_color={COLORS.success_text}
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
export function ProgressBar(props) {
  const percent = Math.round(props.share * 100);
  return (
    <View
      style={[styles.track, props.on_brand && styles.track_brand]}
      accessibilityRole="progressbar"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[styles.fill, props.on_brand && styles.fill_brand, { width: percent + '%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + SPACING.xs,
    minHeight: SIZES.touch + SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  divider: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.border,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  middle: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
    flexShrink: 0,
    maxWidth: '50%',
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
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  claim_top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + SPACING.xs,
    minHeight: SIZES.touch,
  },
  claim_buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingLeft: SIZES.icon_circle + SPACING.sm + SPACING.xs,
  },
  claim_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  track: {
    height: SPACING.sm,
    borderRadius: SPACING.xs,
    backgroundColor: COLORS.surface_raised,
    overflow: 'hidden',
  },
  track_brand: {
    backgroundColor: COLORS.cta_pressed,
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: SPACING.xs,
  },
  fill_brand: {
    backgroundColor: COLORS.on_cta,
  },
});

import { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/ui/Card';
import SectionHeader from '../../../components/ui/SectionHeader';
import StatusLabel from '../../../components/ui/StatusLabel';
import ActionSheet from '../../../components/ui/ActionSheet';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import HeaderIconButton from '../../../components/HeaderIconButton';
import { list_styles } from '../../../components/ui/listStyles';
import { useToast } from '../../../components/ui/Toast';
import { ChargeRow, PaymentRow, ClaimRow } from '../components/LedgerRows';
import PaymentFormModal from '../components/PaymentFormModal';
import ChargeFormModal from '../components/ChargeFormModal';
import ScheduleFormModal from '../components/ScheduleFormModal';
import ReminderSheet from '../../reminders/components/ReminderSheet';
import { useLedger } from '../context/LedgerContext';
import { useLedgerReview } from '../hooks/useLedgerReview';
import { hapticSuccess } from '../../../utils/haptics';
import { formatCents } from '../../../utils/formatCurrency';
import { deriveLedger } from '../utils/ledgerMath';
import {
  formatBalance,
  groupByMonth,
  rowPill,
  shortDate,
  upcomingRent,
} from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, SIZES, NUMBERS } from '../../../theme';

function placeOf(ledger) {
  return ledger.unit_label ? ledger.property_name + ', ' + ledger.unit_label : ledger.property_name;
}

// the rent schedule in one line, like "$1,450.00 a month, due on day 1, 5 grace days, $50.00 late fee"
function scheduleLine(schedule) {
  if (!schedule) {
    return 'No rent schedule yet. Set one and rent gets charged every month by itself.';
  }
  const parts = [
    formatCents(schedule.amount_cents) + ' a month',
    'due on day ' + schedule.due_day,
    schedule.grace_days + (schedule.grace_days === 1 ? ' grace day' : ' grace days'),
    schedule.late_fee_cents > 0
      ? formatCents(schedule.late_fee_cents) + ' late fee'
      : 'no late fee',
  ];
  return parts.join(', ') + '. Started ' + schedule.start_date + '.';
}

// one tenancy's rent ledger for the landlord: the balance, what's next, the deposit, the actions,
// claims waiting on them, and every charge and payment by month
// the only param is tenancyId, everything else comes from the ledger store
function TenantLedgerScreen(props) {
  const insets = useSafeAreaInsets();
  const ledger_store = useLedger();
  const review = useLedgerReview();
  const toast = useToast();
  const tenancy_id =
    props.route.params && props.route.params.tenancyId ? props.route.params.tenancyId : null;
  const ledger = ledger_store.getLedger(tenancy_id);
  const today = ledger_store.today;
  const derived = useMemo(() => (ledger ? deriveLedger(ledger, today) : null), [ledger, today]);
  // which form is open, and a key that goes up every time so each one opens fresh
  const [open_form, setOpenForm] = useState(null);
  const [form_key, setFormKey] = useState(0);
  // the More sheet, and the second sheet that picks what to void
  const [more_open, setMoreOpen] = useState(false);
  // the rent reminder sheet, from More
  const [reminder_open, setReminderOpen] = useState(false);
  const [void_open, setVoidOpen] = useState(false);

  function openForm(name) {
    setFormKey((current) => current + 1);
    setOpenForm(name);
  }

  // the header's button opens the same Record Payment form as the button on the screen
  const has_ledger = !!ledger;
  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerRight: has_ledger
        ? () => (
            <HeaderIconButton
              icon="add-circle-outline"
              label="Record a payment"
              onPress={() => openForm('payment')}
            />
          )
        : undefined,
    });
  }, [props.navigation, has_ledger]);

  const groups = useMemo(() => {
    if (!ledger || !derived) {
      return [];
    }
    return groupByMonth([
      ...derived.charges.map((charge) => ({
        type: 'charge',
        id: 'c-' + charge.id,
        date: charge.due_date,
        charge: charge,
      })),
      ...ledger.payments.map((payment) => ({
        type: 'payment',
        id: 'p-' + payment.created_at + payment.id,
        date: payment.paid_on,
        payment: payment,
      })),
    ]);
  }, [ledger, derived]);

  if (!ledger) {
    return (
      <View style={[styles.container, styles.missing]}>
        {ledger_store.status === 'loading' ? (
          <SkeletonList rows={4} />
        ) : (
          <EmptyState
            illustration="empty_payments"
            title="Ledger not found"
            message="This tenancy isn't in your ledgers. It may have been removed, or pull down on Payments to refresh."
            action_label="Back to Payments"
            action_icon="arrow-back-outline"
            onAction={() => props.navigation.goBack()}
          />
        )}
      </View>
    );
  }

  const is_ended = ledger.tenancy_status === 'ended';
  const balance = formatBalance(derived.balance_cents);
  const pill = rowPill(derived.row_status);
  const next_rent = upcomingRent(ledger, today);
  const place = ledger.tenant_name + ', ' + placeOf(ledger);
  // what the Void sheet offers: charges that still count and confirmed payments, newest first, up to 8
  const voidable = [
    ...derived.charges
      .filter((charge) => charge.status !== 'voided')
      .map((charge) => ({
        type: 'charge',
        date: charge.due_date,
        item: charge,
        label:
          (charge.description || 'Charge') +
          ', ' +
          formatCents(charge.amount_cents) +
          ', due ' +
          shortDate(charge.due_date),
      })),
    ...ledger.payments
      .filter((payment) => payment.status === 'succeeded')
      .map((payment) => ({
        type: 'payment',
        date: payment.paid_on,
        item: payment,
        label:
          (payment.is_refund ? 'Refund' : 'Payment') +
          ', ' +
          formatCents(payment.amount_cents) +
          ', ' +
          shortDate(payment.paid_on),
      })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  async function savePayment(value, receipt) {
    const payment = await ledger_store.recordPayment(tenancy_id, value, receipt);
    setOpenForm(null);
    hapticSuccess();
    toast.show(
      (value.is_refund ? 'Refund of ' : 'Payment of ') +
        formatCents(value.amount_cents) +
        ' recorded',
    );
    return payment;
  }

  async function saveCharge(value) {
    await ledger_store.addCharge(tenancy_id, value);
    setOpenForm(null);
    toast.show('Charge added');
  }

  async function saveSchedule(value) {
    await ledger_store.setRentSchedule(tenancy_id, value);
    setOpenForm(null);
    hapticSuccess();
    toast.show('Rent schedule saved');
  }

  // a charge row offers the one thing you can do with it, voiding it with a reason
  function chargeOptions(charge) {
    Alert.alert(charge.description, formatCents(charge.amount_cents) + ', due ' + charge.due_date, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Void Charge', style: 'destructive', onPress: () => review.voidCharge(charge) },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={ledger_store.refreshing}
            onRefresh={ledger_store.refresh}
            tintColor={COLORS.title}
          />
        }
      >
        {ledger_store.from_cache ? (
          <View style={list_styles.offline_banner}>
            <Text style={list_styles.offline_text}>
              {(ledger_store.error_message || "You're offline.") +
                ' Showing the last saved ledger, pull down to try again.'}
            </Text>
          </View>
        ) : null}

        {/* the Hearth pass: their name big in Fraunces with the address under it, then the balance as the
            one big number, a status line, and the next rent and deposit in one muted sentence */}
        <Text style={styles.name} accessibilityRole="header">
          {ledger.tenant_name}
        </Text>
        <Text style={styles.address}>{placeOf(ledger)}</Text>

        <View style={styles.hero}>
          <StatusLabel
            label={
              derived.overdue_cents > 0
                ? 'Overdue'
                : derived.balance_cents < 0
                  ? 'Credit'
                  : derived.balance_cents > 0
                    ? pill.label
                    : 'Paid up'
            }
            tone={
              derived.overdue_cents > 0
                ? 'danger'
                : derived.balance_cents > 0
                  ? 'warning'
                  : 'success'
            }
            icon={
              derived.overdue_cents > 0
                ? 'alert-circle-outline'
                : derived.balance_cents > 0
                  ? 'time-outline'
                  : 'checkmark-circle-outline'
            }
          />
          <Text
            style={[styles.balance, NUMBERS]}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.2}
            accessibilityLabel={balance.text}
          >
            {formatCents(Math.abs(derived.balance_cents))}
          </Text>
          <Text style={styles.muted_line}>
            {(next_rent && !is_ended
              ? 'Next rent ' +
                formatCents(next_rent.amount_cents) +
                ' on ' +
                shortDate(next_rent.date) +
                '. '
              : '') +
              'Deposit held ' +
              formatCents(derived.deposit_held_cents) +
              '.' +
              (derived.deposit_due_cents > 0
                ? ' ' + formatCents(derived.deposit_due_cents) + ' of the deposit still owed.'
                : '')}
          </Text>
          {derived.overdue_cents > 0 ? (
            <Text style={styles.overdue_line}>
              {formatCents(derived.overdue_cents) +
                ' is overdue across ' +
                derived.overdue_count +
                (derived.overdue_count === 1 ? ' charge.' : ' charges.')}
            </Text>
          ) : null}
          {is_ended ? (
            <Text style={styles.muted_line}>
              This tenancy has ended. You can still record a payment, a deposit refund, or a charge.
            </Text>
          ) : null}
        </View>

        <View style={styles.action_row}>
          <Button
            variant="primary"
            icon="add-outline"
            title="Record Payment"
            onPress={() => openForm('payment')}
            style={styles.action_main}
          />
          <Button
            variant="secondary"
            icon="ellipsis-horizontal-outline"
            title="More"
            accessibilityLabel="More actions: add charge, edit rent schedule, void"
            onPress={() => setMoreOpen(true)}
            style={styles.action_more}
          />
        </View>
        <Text style={styles.schedule_line}>{scheduleLine(ledger.schedule)}</Text>

        {derived.pending_payments.length > 0 ? (
          <Card style={styles.card}>
            <SectionHeader title="Claims to review" count={derived.pending_payments.length} />
            {derived.pending_payments.map((payment, index) => (
              <ClaimRow
                key={payment.id}
                payment={payment}
                name={ledger.tenant_name}
                busy={review.busy_id === payment.id}
                divider={index < derived.pending_payments.length - 1}
                onOpen={() => props.navigation.navigate('PaymentDetail', { paymentId: payment.id })}
                onConfirm={() => review.confirm(payment)}
                onReject={() => review.reject(payment)}
              />
            ))}
          </Card>
        ) : null}

        {groups.length === 0 ? (
          <Card style={styles.card}>
            <EmptyState
              illustration="empty_payments"
              title="Nothing here yet"
              message="Charges and payments show up here by month."
            />
          </Card>
        ) : null}
        {groups.map((group) => (
          <Card key={group.month} style={styles.card}>
            <SectionHeader title={group.title} />
            {group.items.map((item, index) =>
              item.type === 'charge' ? (
                <ChargeRow
                  key={item.id}
                  charge={item.charge}
                  divider={index < group.items.length - 1}
                  onPress={
                    item.charge.status === 'voided' ? undefined : () => chargeOptions(item.charge)
                  }
                />
              ) : (
                <PaymentRow
                  key={item.id}
                  payment={item.payment}
                  divider={index < group.items.length - 1}
                  onPress={() =>
                    props.navigation.navigate('PaymentDetail', { paymentId: item.payment.id })
                  }
                />
              ),
            )}
          </Card>
        ))}
      </ScrollView>

      {open_form === 'payment' ? (
        <PaymentFormModal
          key={'payment-' + form_key}
          visible
          is_claim={false}
          place={place}
          today={today}
          suggested_cents={derived.due_now_cents}
          onSubmit={savePayment}
          onClose={() => setOpenForm(null)}
        />
      ) : null}
      {open_form === 'charge' ? (
        <ChargeFormModal
          key={'charge-' + form_key}
          visible
          place={place}
          today={today}
          onSubmit={saveCharge}
          onClose={() => setOpenForm(null)}
        />
      ) : null}
      {open_form === 'schedule' ? (
        <ScheduleFormModal
          key={'schedule-' + form_key}
          visible
          place={place}
          schedule={ledger.schedule}
          today={today}
          onSubmit={saveSchedule}
          onClose={() => setOpenForm(null)}
        />
      ) : null}
      <ActionSheet
        visible={more_open}
        title="More"
        actions={[
          // the server takes charges on an ended tenancy too (move-out damage), but not a new rent schedule
          {
            label: 'Add Charge',
            icon: 'pricetag-outline',
            onPress: () => openForm('charge'),
          },
          // a nudge for rent that's owed, the sheet says why when it can't go (nothing owed, sent today)
          ...(!is_ended
            ? [
                {
                  label: 'Send Reminder',
                  icon: 'notifications-outline',
                  onPress: () => setReminderOpen(true),
                },
              ]
            : []),
          ...(!is_ended
            ? [
                {
                  label: ledger.schedule ? 'Edit Rent Schedule' : 'Set Rent Schedule',
                  icon: 'calendar-outline',
                  onPress: () => openForm('schedule'),
                },
              ]
            : []),
          {
            label: 'Void a Charge or Payment',
            icon: 'remove-circle-outline',
            destructive: true,
            onPress: () => setVoidOpen(true),
          },
        ]}
        onClose={() => setMoreOpen(false)}
      />
      {/* the newest things that can still be voided, picking one asks for the reason */}
      <ActionSheet
        visible={void_open}
        title="Void which one?"
        actions={voidable.map((item) => ({
          label: item.label,
          icon: item.type === 'charge' ? 'pricetag-outline' : 'cash-outline',
          destructive: true,
          onPress: () =>
            item.type === 'charge' ? review.voidCharge(item.item) : review.voidPayment(item.item),
        }))}
        onClose={() => setVoidOpen(false)}
      />
      {reminder_open ? (
        <ReminderSheet
          visible
          tenancy_id={ledger.tenancy_id}
          tenant_name={ledger.tenant_name}
          place={placeOf(ledger)}
          onClose={() => setReminderOpen(false)}
        />
      ) : null}
      {review.sheet}
    </View>
  );
}

export default TenantLedgerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  missing: {
    padding: SIZES.screen_padding,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    gap: SPACING.md,
  },
  card: {
    width: '100%',
    marginVertical: 0,
  },
  name: {
    ...TYPE.name,
    color: COLORS.text,
  },
  address: {
    ...TYPE.body,
    color: COLORS.text_muted,
    marginTop: -SPACING.sm,
  },
  hero: {
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  balance: {
    ...TYPE.hero,
    color: COLORS.text,
  },
  muted_line: {
    ...TYPE.body,
    color: COLORS.text_muted,
  },
  overdue_line: {
    ...TYPE.body,
    color: COLORS.danger_text,
  },
  // the pills wrap onto two lines at big text sizes instead of breaking words
  action_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  action_main: {
    flexGrow: 1,
    minWidth: '60%',
    marginHorizontal: 0,
  },
  action_more: {
    flexGrow: 1,
    marginHorizontal: 0,
  },
  schedule_line: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
});

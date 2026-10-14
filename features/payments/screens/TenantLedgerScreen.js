import { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/ui/Card';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import KpiTile from '../../../components/ui/KpiTile';
import SectionHeader from '../../../components/ui/SectionHeader';
import StatusPill from '../../../components/ui/StatusPill';
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
import { useLedger } from '../context/LedgerContext';
import { useLedgerReview } from '../hooks/useLedgerReview';
import { hapticSuccess } from '../../../utils/haptics';
import { formatCents } from '../../../utils/formatCurrency';
import { deriveLedger } from '../utils/ledgerMath';
import { formatBalance, groupByMonth, rowPill, shortDate } from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

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
  const place = ledger.tenant_name + ', ' + placeOf(ledger);

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

        <SummaryBlock
          label={derived.balance_cents < 0 ? 'Credit' : 'Balance'}
          value={formatCents(Math.abs(derived.balance_cents))}
          caption={place}
        >
          <StatusPill label={pill.label} tone={pill.tone} icon={pill.icon} />
        </SummaryBlock>

        {derived.overdue_cents > 0 ? (
          <View style={styles.danger_banner} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={SIZES.icon} color={COLORS.danger_text} />
            <Text style={styles.danger_text}>
              {formatCents(derived.overdue_cents) +
                ' is overdue across ' +
                derived.overdue_count +
                (derived.overdue_count === 1 ? ' charge.' : ' charges.')}
            </Text>
          </View>
        ) : null}

        {is_ended ? (
          <View style={styles.info_banner}>
            <Ionicons name="information-circle" size={SIZES.icon} color={COLORS.info_text} />
            <Text style={styles.info_text}>
              This tenancy has ended. You can still record a payment or a deposit refund.
            </Text>
          </View>
        ) : null}

        <View style={styles.kpi_row}>
          <KpiTile
            icon="calendar-outline"
            tone="brand"
            label="Next due"
            value={derived.next_due && !is_ended ? shortDate(derived.next_due.date) : 'None'}
            caption={
              derived.next_due && !is_ended
                ? formatCents(derived.next_due.amount_cents)
                : balance.text
            }
          />
          <KpiTile
            icon="shield-checkmark-outline"
            tone="info"
            label="Deposit held"
            value={formatCents(derived.deposit_held_cents)}
            caption={
              derived.deposit_due_cents > 0
                ? formatCents(derived.deposit_due_cents) + ' still owed'
                : 'Nothing owed'
            }
          />
        </View>

        <Card style={styles.card}>
          <Button
            variant="primary"
            icon="add-circle-outline"
            title="Record Payment"
            onPress={() => openForm('payment')}
            style={styles.action}
          />
          {!is_ended ? (
            <View style={styles.action_row}>
              <Button
                variant="secondary"
                icon="pricetag-outline"
                title="Add Charge"
                onPress={() => openForm('charge')}
                style={styles.action_half}
              />
              <Button
                variant="secondary"
                icon="calendar-outline"
                title={ledger.schedule ? 'Edit Rent' : 'Set Rent'}
                accessibilityLabel={ledger.schedule ? 'Edit rent schedule' : 'Set rent schedule'}
                onPress={() => openForm('schedule')}
                style={styles.action_half}
              />
            </View>
          ) : null}
          <Text style={styles.schedule_line}>{scheduleLine(ledger.schedule)}</Text>
        </Card>

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
  kpi_row: {
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  danger_banner: {
    ...list_styles.offline_banner,
    backgroundColor: COLORS.danger_tint,
    borderColor: COLORS.danger,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 0,
  },
  danger_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    flexShrink: 1,
  },
  info_banner: {
    ...list_styles.offline_banner,
    backgroundColor: COLORS.info_tint,
    borderColor: COLORS.info_text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 0,
  },
  info_text: {
    ...TYPE.body_small,
    color: COLORS.info_text,
    flexShrink: 1,
  },
  action: {
    marginHorizontal: 0,
  },
  action_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  action_half: {
    flex: 1,
    marginHorizontal: 0,
  },
  schedule_line: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.sm + SPACING.xs,
  },
});

import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Card from '../../../components/ui/Card';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import KpiTile from '../../../components/ui/KpiTile';
import SectionHeader from '../../../components/ui/SectionHeader';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ErrorState';
import { list_styles } from '../../../components/ui/listStyles';
import { useToast } from '../../../components/ui/Toast';
import { ChargeRow, PaymentRow } from './LedgerRows';
import PaymentFormModal from './PaymentFormModal';
import { useLedger } from '../context/LedgerContext';
import { hapticSuccess } from '../../../utils/haptics';
import { formatCents } from '../../../utils/formatCurrency';
import { deriveLedger, addDays } from '../utils/ledgerMath';
import { formatBalance, groupByMonth, shortDate, upcomingRent } from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// how far back a rejected claim stays pinned at the top, after that it's just in the history
const rejected_days = 60;

function placeOf(ledger) {
  return ledger.unit_label ? ledger.property_name + ', ' + ledger.unit_label : ledger.property_name;
}

// charges and payments mixed by month for one ledger
function activityFor(ledger, derived) {
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
}

// the tenant's Payments and Rent: what's due, how to pay the landlord, an "I paid" claim, and the history
// Rent Well never takes the money itself, the tenant pays the landlord directly and then tells them here
// a former tenant gets the history read only, with no claim button
function TenantPaymentsView(props) {
  const insets = useSafeAreaInsets();
  const ledger_store = useLedger();
  const toast = useToast();
  const today = ledger_store.today;
  const ledger = ledger_store.current_ledger;
  const derived = useMemo(() => (ledger ? deriveLedger(ledger, today) : null), [ledger, today]);
  const activity = useMemo(
    () => (ledger && derived ? activityFor(ledger, derived) : []),
    [ledger, derived],
  );
  const [claim_key, setClaimKey] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [show_all, setShowAll] = useState(false);
  const [show_past, setShowPast] = useState(ledger_store.is_read_only);

  function openPayment(payment_id) {
    props.navigation.navigate('PaymentDetail', { paymentId: payment_id });
  }

  async function copyInstructions(text) {
    await Clipboard.setStringAsync(text);
    toast.show('Payment instructions copied', 'copy');
  }

  async function sendClaim(value, receipt) {
    await ledger_store.claimPayment(ledger.tenancy_id, value, receipt);
    setClaiming(false);
    hapticSuccess();
    toast.show('Sent. Your landlord will confirm it.', 'paper-plane');
  }

  const is_loading = ledger_store.status === 'loading' && ledger_store.ledgers.length === 0;
  const is_error = ledger_store.status === 'error' && ledger_store.ledgers.length === 0;

  let current = null;
  if (ledger && derived) {
    const pending = derived.pending_payments;
    const rejected = ledger.payments.filter(
      (payment) =>
        payment.status === 'rejected' &&
        payment.source === 'tenant' &&
        payment.paid_on >= addDays(today, -rejected_days),
    );
    const due_now = derived.due_now_cents;
    let caption = 'All paid up. Nice.';
    if (derived.overdue_cents > 0 && derived.overdue_cents >= due_now) {
      caption = 'Overdue';
    } else if (derived.overdue_cents > 0) {
      caption = formatCents(derived.overdue_cents) + ' of it is overdue';
    } else if (due_now > 0) {
      caption = 'Due now';
    } else if (derived.balance_cents < 0) {
      caption = formatBalance(derived.balance_cents).text + ', paid ahead';
    }
    const instructions = ledger.payment_instructions;
    const next_rent = upcomingRent(ledger, today);
    // the first two months open, the rest behind Show all so the screen stays short
    const shown_months = show_all ? activity : activity.slice(0, 2);
    current = (
      <>
        <SummaryBlock
          variant="brand"
          label={due_now > 0 ? 'You owe' : 'Your balance'}
          value={formatCents(Math.max(due_now, 0))}
          caption={caption + ', ' + placeOf(ledger)}
        />

        {derived.overdue_cents > 0 ? (
          <View style={[styles.banner, styles.banner_danger]} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={SIZES.icon} color={COLORS.danger_text} />
            <Text style={[styles.banner_text, styles.danger_text]}>
              {'Rent is overdue. Pay ' +
                formatCents(derived.overdue_cents) +
                ' as soon as you can, then tap I Paid.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.kpi_row}>
          <KpiTile
            icon="calendar-outline"
            tone="brand"
            label="Next rent"
            value={next_rent ? shortDate(next_rent.date) : 'None'}
            caption={next_rent ? formatCents(next_rent.amount_cents) : 'No rent set'}
          />
          <KpiTile
            icon="shield-checkmark-outline"
            tone="info"
            label="Deposit held"
            value={formatCents(derived.deposit_held_cents)}
            caption={
              derived.deposit_due_cents > 0
                ? formatCents(derived.deposit_due_cents) + ' still owed'
                : 'With your landlord'
            }
          />
        </View>

        <Button
          variant="primary"
          icon="checkmark-done-outline"
          title="I Paid"
          accessibilityHint="Tell your landlord about a payment you sent them"
          onPress={() => {
            setClaimKey((key) => key + 1);
            setClaiming(true);
          }}
          style={styles.wide_button}
        />

        <Card style={styles.card}>
          <SectionHeader title="How to pay" />
          {instructions ? (
            <>
              <Text style={styles.instructions} selectable>
                {instructions}
              </Text>
              <Button
                variant="secondary"
                size="small"
                icon="copy-outline"
                title="Copy"
                accessibilityLabel="Copy the payment instructions"
                onPress={() => copyInstructions(instructions)}
                style={styles.copy_button}
              />
            </>
          ) : (
            <Text style={styles.muted}>
              Your landlord hasn&apos;t added payment instructions yet. Ask them in Messages.
            </Text>
          )}
          <Text style={styles.fine_print}>
            Rent Well doesn&apos;t take payments. Pay your landlord directly, then tap I Paid so
            they can confirm it.
          </Text>
        </Card>

        {pending.length > 0 ? (
          <Card style={styles.card}>
            <SectionHeader title="Waiting for confirmation" count={pending.length} />
            {pending.map((payment, index) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                divider={index < pending.length - 1}
                onPress={() => openPayment(payment.id)}
              />
            ))}
          </Card>
        ) : null}

        {rejected.length > 0 ? (
          <Card style={styles.card}>
            <SectionHeader title="Not accepted" count={rejected.length} />
            {rejected.map((payment, index) => (
              <View key={payment.id}>
                <PaymentRow
                  payment={payment}
                  divider={false}
                  onPress={() => openPayment(payment.id)}
                />
                {payment.reject_reason ? (
                  <Text style={[styles.reason, index < rejected.length - 1 && styles.reason_gap]}>
                    {'Your landlord said: ' + payment.reject_reason}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {shown_months.map((group) => (
          <Card key={group.month} style={styles.card}>
            <SectionHeader title={group.title} />
            {group.items.map((item, index) =>
              item.type === 'charge' ? (
                <ChargeRow
                  key={item.id}
                  charge={item.charge}
                  divider={index < group.items.length - 1}
                />
              ) : (
                <PaymentRow
                  key={item.id}
                  payment={item.payment}
                  divider={index < group.items.length - 1}
                  onPress={() => openPayment(item.payment.id)}
                />
              ),
            )}
          </Card>
        ))}
        {activity.length > 2 ? (
          <Button
            variant="tertiary"
            icon={show_all ? 'chevron-up-outline' : 'time-outline'}
            title={show_all ? 'Show less' : 'Show all history'}
            onPress={() => setShowAll((value) => !value)}
            style={styles.wide_button}
          />
        ) : null}
      </>
    );
  }

  const past = ledger_store.past_ledgers;
  let body;
  if (is_loading) {
    body = <SkeletonList rows={4} />;
  } else if (is_error) {
    body = <ErrorState message={ledger_store.error_message} onRetry={ledger_store.refresh} />;
  } else if (!ledger && past.length === 0) {
    body = (
      <Card style={styles.card}>
        <EmptyState
          illustration="empty_payments"
          title="No rent set up yet"
          message="Once your landlord sets your rent, what's due and your payments show up here."
        />
      </Card>
    );
  } else {
    body = (
      <>
        {/* a former tenant only gets their history */}
        {ledger_store.is_read_only ? (
          <View style={[styles.banner, styles.banner_info]}>
            <Ionicons
              name="information-circle-outline"
              size={SIZES.icon}
              color={COLORS.info_text}
            />
            <Text style={[styles.banner_text, styles.info_text]}>
              Your rental has ended, so this is read-only. Your payment history stays here.
            </Text>
          </View>
        ) : null}
        {current}
        {past.length > 0 ? (
          <Card style={styles.card}>
            <Pressable
              onPress={() => setShowPast((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: show_past }}
              accessibilityLabel={'Past rentals, ' + past.length}
              style={styles.fold}
            >
              <Text style={styles.fold_text}>{'Past rentals (' + past.length + ')'}</Text>
              <Ionicons
                name={show_past ? 'chevron-up-outline' : 'chevron-down'}
                size={SIZES.icon}
                color={COLORS.text_muted}
              />
            </Pressable>
            {show_past
              ? past.map((old) => {
                  const old_derived = deriveLedger(old, today);
                  return (
                    <View key={old.tenancy_id} style={styles.past}>
                      <Text style={styles.past_title}>{placeOf(old)}</Text>
                      <Text style={styles.muted}>
                        {formatBalance(old_derived.balance_cents).text}
                      </Text>
                      {old.payments.map((payment, index) => (
                        <PaymentRow
                          key={payment.id}
                          payment={payment}
                          divider={index < old.payments.length - 1}
                          onPress={() => openPayment(payment.id)}
                        />
                      ))}
                    </View>
                  );
                })
              : null}
          </Card>
        ) : null}
      </>
    );
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
                ' Showing the last saved copy, pull down to try again.'}
            </Text>
          </View>
        ) : null}
        {body}
      </ScrollView>
      {claiming && ledger && derived ? (
        <PaymentFormModal
          key={'claim-' + claim_key}
          visible
          is_claim
          today={today}
          suggested_cents={
            derived.due_now_cents > 0
              ? derived.due_now_cents
              : upcomingRent(ledger, today)
                ? upcomingRent(ledger, today).amount_cents
                : 0
          }
          onSubmit={sendClaim}
          onClose={() => setClaiming(false)}
        />
      ) : null}
    </View>
  );
}

export default TenantPaymentsView;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  kpi_row: {
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  wide_button: {
    marginHorizontal: 0,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  banner_danger: {
    // the Hearth pass: no fill, the icon and the colored words carry it
    backgroundColor: 'transparent',
  },
  banner_info: {
    // the Hearth pass: no fill, the icon and the colored words carry it
    backgroundColor: 'transparent',
  },
  banner_text: {
    ...TYPE.body_small,
    flexShrink: 1,
  },
  danger_text: {
    color: COLORS.danger_text,
    fontFamily: TYPE.label.fontFamily,
  },
  info_text: {
    color: COLORS.info_text,
  },
  instructions: {
    ...TYPE.body,
    color: COLORS.text,
  },
  copy_button: {
    alignSelf: 'flex-start',
    marginHorizontal: 0,
    marginTop: SPACING.sm,
  },
  muted: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  fine_print: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.sm + SPACING.xs,
  },
  reason: {
    ...TYPE.body_small,
    color: COLORS.danger_text,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.sm,
  },
  reason_gap: {
    marginBottom: SPACING.md,
  },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SIZES.touch,
  },
  fold_text: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  past: {
    marginTop: SPACING.sm,
  },
  past_title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
}));

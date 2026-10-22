import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/ui/Card';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import KpiTile from '../../../components/ui/KpiTile';
import SectionHeader from '../../../components/ui/SectionHeader';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import Chip from '../../../components/ui/Chip';
import ListRow from '../../../components/ui/ListRow';
import StatusLabel from '../../../components/ui/StatusLabel';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ErrorState';
import { list_styles } from '../../../components/ui/listStyles';
import { ClaimRow, ProgressBar } from './LedgerRows';
import ReminderSheet from '../../reminders/components/ReminderSheet';
import { useLedger } from '../context/LedgerContext';
import { useLedgerReview } from '../hooks/useLedgerReview';
import { formatCents } from '../../../utils/formatCurrency';
import {
  deriveLedger,
  monthSummary,
  collectedShare,
  monthOf,
  shiftMonth,
} from '../utils/ledgerMath';
import { formatBalance, monthTitle, rowPill } from '../utils/ledgerHelpers';
import { COLORS, SPACING, TYPE, SIZES, OPACITY } from '../../../theme';

// the order rows sort in, what needs the landlord first
const row_order = { overdue: 0, pending: 1, due: 2, credit: 3, paid: 4 };

function placeOf(ledger) {
  return ledger.unit_label ? ledger.property_name + ', ' + ledger.unit_label : ledger.property_name;
}

// the landlord's Payments and Rent: a month at a time, what came in against what was expected,
// what's overdue, claims to review right from the list, and every tenant's balance
function OwnerPaymentsView(props) {
  const insets = useSafeAreaInsets();
  const ledger_store = useLedger();
  const review = useLedgerReview();
  const today = ledger_store.today;
  const this_month = monthOf(today);
  const [month, setMonth] = useState(this_month);
  const [property_id, setPropertyId] = useState('all');
  const [show_past, setShowPast] = useState(false);
  // the overdue rows' Remind button opens the rent reminder sheet for that tenancy
  const [remind_ledger, setRemindLedger] = useState(null);

  const ledgers = ledger_store.ledgers;

  // every property that has a ledger, for the filter
  const properties = useMemo(() => {
    const seen = {};
    ledgers.forEach((ledger) => {
      seen[ledger.property_id] = ledger.property_name;
    });
    return Object.keys(seen)
      .map((id) => ({ id: id, name: seen[id] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers]);

  // the picked property can disappear after a refresh, then it goes back to all
  const picked = properties.some((item) => item.id === property_id) ? property_id : 'all';
  const shown = useMemo(
    () => (picked === 'all' ? ledgers : ledgers.filter((ledger) => ledger.property_id === picked)),
    [ledgers, picked],
  );
  const local_summary = useMemo(() => monthSummary(shown, month, today), [shown, month, today]);
  // real mode takes the month's numbers from the server (GET /ledger/summary), the claims queue still
  // comes from the ledgers since the summary only counts them, and the local numbers fill in until it answers
  const [server_summary, setServerSummary] = useState(null);
  const is_demo = ledger_store.is_demo;
  const getMonthSummary = ledger_store.getMonthSummary;
  useEffect(() => {
    if (is_demo) {
      return undefined;
    }
    let active = true;
    getMonthSummary(month, picked === 'all' ? null : picked)
      .then((result) => {
        if (active && result) {
          setServerSummary({ key: month + ':' + picked, value: result });
        }
      })
      .catch((error) => console.log('Could not load the month summary', error.message));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_demo, month, picked, ledgers]);
  const summary =
    server_summary && server_summary.key === month + ':' + picked
      ? { ...server_summary.value, pending: local_summary.pending }
      : local_summary;
  const rows = useMemo(
    () =>
      shown
        .map((ledger) => ({ ledger: ledger, derived: deriveLedger(ledger, today) }))
        .sort(
          (a, b) =>
            row_order[a.derived.row_status] - row_order[b.derived.row_status] ||
            a.ledger.tenant_name.localeCompare(b.ledger.tenant_name),
        ),
    [shown, today],
  );
  const current_rows = rows.filter((row) => row.ledger.tenancy_status !== 'ended');
  const past_rows = rows.filter((row) => row.ledger.tenancy_status === 'ended');

  // the earliest month with anything on it, so the arrows stop where the history does
  const first_month = useMemo(() => {
    let first = this_month;
    ledgers.forEach((ledger) =>
      (ledger.charges || []).forEach((charge) => {
        const charge_month = monthOf(charge.due_date);
        if (charge_month < first) {
          first = charge_month;
        }
      }),
    );
    return first;
  }, [ledgers, this_month]);
  const last_month = shiftMonth(this_month, 1);

  function openLedger(tenancy_id) {
    props.navigation.navigate('TenantLedger', { tenancyId: tenancy_id });
  }

  function openPayment(payment_id) {
    props.navigation.navigate('PaymentDetail', { paymentId: payment_id });
  }

  const share = collectedShare(summary.collected_cents, summary.expected_cents);
  const is_loading = ledger_store.status === 'loading' && ledgers.length === 0;
  const is_error = ledger_store.status === 'error' && ledgers.length === 0;

  let body;
  if (is_loading) {
    body = <SkeletonList rows={4} />;
  } else if (is_error) {
    body = <ErrorState message={ledger_store.error_message} onRetry={ledger_store.refresh} />;
  } else if (ledgers.length === 0) {
    body = (
      <Card style={styles.card}>
        <EmptyState
          illustration="empty_payments"
          title="No rent to track yet"
          message="Once a tenant moves in, open their profile and set a rent schedule. Charges add themselves every month."
          action_label="Go to Tenants"
          action_icon="people-outline"
          onAction={() => props.navigation.navigate('Tenants')}
        />
      </Card>
    );
  } else {
    body = (
      <>
        {/* the month picker: arrows on each side, the month in words in the middle */}
        <View style={styles.month_row}>
          <Pressable
            onPress={() => setMonth(shiftMonth(month, -1))}
            disabled={month <= first_month}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: month <= first_month }}
            style={[styles.month_arrow, month <= first_month && styles.disabled]}
          >
            <Ionicons name="chevron-back-outline" size={SIZES.icon_large} color={COLORS.text} />
          </Pressable>
          <Text style={styles.month_title} accessibilityRole="header">
            {monthTitle(month)}
          </Text>
          <Pressable
            onPress={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= last_month}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: month >= last_month }}
            style={[styles.month_arrow, month >= last_month && styles.disabled]}
          >
            <Ionicons name="chevron-forward-outline" size={SIZES.icon_large} color={COLORS.text} />
          </Pressable>
        </View>

        {/* properties filter, a segmented control for a few, chips once there are more */}
        {properties.length > 1 && properties.length <= 3 ? (
          <SegmentedControl
            label="Property"
            options={[
              { value: 'all', label: 'All' },
              ...properties.map((item) => ({ value: item.id, label: item.name })),
            ]}
            value={picked}
            onChange={setPropertyId}
            style={styles.segments}
          />
        ) : null}
        {properties.length > 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chip_row}
          >
            {[{ id: 'all', name: 'All properties' }, ...properties].map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                selected={picked === item.id}
                onPress={() => setPropertyId(item.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <SummaryBlock
          variant="brand"
          label={'Collected in ' + monthTitle(month)}
          value={formatCents(summary.collected_cents)}
          caption={
            'of ' +
            formatCents(summary.expected_cents) +
            ' expected, ' +
            formatCents(summary.outstanding_cents) +
            ' still out'
          }
          style={styles.summary}
        >
          <ProgressBar
            share={share}
            on_brand
            label={Math.round(share * 100) + ' percent of expected rent collected'}
          />
        </SummaryBlock>

        <View style={styles.kpi_row}>
          <KpiTile
            icon="alert-circle-outline"
            tone={summary.overdue_count > 0 ? 'danger' : 'success'}
            label="Overdue charges"
            value={String(summary.overdue_count)}
            caption={
              summary.overdue_count > 0 ? formatCents(summary.overdue_cents) : 'Nothing late'
            }
          />
          <KpiTile
            icon="hourglass-outline"
            tone={summary.pending.length > 0 ? 'warning' : 'neutral'}
            label="To confirm"
            value={String(summary.pending.length)}
            caption={
              summary.pending.length > 0
                ? formatCents(
                    summary.pending.reduce((sum, item) => sum + item.payment.amount_cents, 0),
                  )
                : 'No claims waiting'
            }
          />
        </View>

        {summary.pending.length > 0 ? (
          <Card style={styles.card}>
            <SectionHeader title="Claims to review" count={summary.pending.length} />
            {summary.pending.map((item, index) => (
              <ClaimRow
                key={item.payment.id}
                payment={item.payment}
                name={item.ledger.tenant_name}
                place={placeOf(item.ledger)}
                busy={review.busy_id === item.payment.id}
                divider={index < summary.pending.length - 1}
                onOpen={() => openPayment(item.payment.id)}
                onConfirm={() => review.confirm(item.payment)}
                onReject={() => review.reject(item.payment)}
              />
            ))}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <SectionHeader title="Tenants" count={current_rows.length} />
          {current_rows.length === 0 ? (
            <Text style={styles.empty_line}>No current tenants at this property.</Text>
          ) : null}
          {current_rows.map((row, index) => {
            const pill = rowPill(row.derived.row_status);
            const balance = formatBalance(row.derived.balance_cents);
            return (
              <ListRow
                key={row.ledger.tenancy_id}
                avatar_name={row.ledger.tenant_name}
                title={row.ledger.tenant_name}
                subtitle={placeOf(row.ledger) + '\n' + balance.text}
                detail={<StatusLabel label={pill.label} tone={pill.tone} icon={pill.icon} />}
                trailing={
                  row.derived.row_status === 'overdue' ? (
                    <Pressable
                      onPress={() => setRemindLedger(row.ledger)}
                      hitSlop={SPACING.xs}
                      accessibilityRole="button"
                      accessibilityLabel={'Send ' + row.ledger.tenant_name + ' a rent reminder'}
                      style={({ pressed }) => [styles.remind, pressed && styles.remind_pressed]}
                    >
                      <Ionicons name="notifications-outline" size={SIZES.icon} color={COLORS.cta} />
                      <Text style={styles.remind_text}>Remind</Text>
                    </Pressable>
                  ) : null
                }
                accessibilityLabel={
                  row.ledger.tenant_name +
                  ', ' +
                  placeOf(row.ledger) +
                  ', ' +
                  balance.text +
                  ', ' +
                  pill.label
                }
                accessibilityHint="Opens their rent ledger"
                divider={index < current_rows.length - 1}
                onPress={() => openLedger(row.ledger.tenancy_id)}
              />
            );
          })}
        </Card>

        {past_rows.length > 0 ? (
          <Card style={styles.card}>
            <Pressable
              onPress={() => setShowPast((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: show_past }}
              accessibilityLabel={'Past tenants, ' + past_rows.length}
              style={styles.fold}
            >
              <Text style={styles.fold_text}>{'Past tenants (' + past_rows.length + ')'}</Text>
              <Ionicons
                name={show_past ? 'chevron-up-outline' : 'chevron-down'}
                size={SIZES.icon}
                color={COLORS.text_muted}
              />
            </Pressable>
            {show_past
              ? past_rows.map((row, index) => (
                  <ListRow
                    key={row.ledger.tenancy_id}
                    avatar_name={row.ledger.tenant_name}
                    title={row.ledger.tenant_name}
                    subtitle={
                      placeOf(row.ledger) + '\n' + formatBalance(row.derived.balance_cents).text
                    }
                    accessibilityHint="Opens their rent ledger"
                    divider={index < past_rows.length - 1}
                    onPress={() => openLedger(row.ledger.tenancy_id)}
                  />
                ))
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
        {/* what's on screen is the last copy that loaded, pulling down tries again */}
        {ledger_store.from_cache ? (
          <View style={list_styles.offline_banner}>
            <Text style={list_styles.offline_text}>
              {(ledger_store.error_message || "You're offline.") +
                ' Showing the last saved ledger, pull down to try again.'}
            </Text>
          </View>
        ) : null}
        {body}
      </ScrollView>
      {remind_ledger ? (
        <ReminderSheet
          visible
          tenancy_id={remind_ledger.tenancy_id}
          tenant_name={remind_ledger.tenant_name}
          place={placeOf(remind_ledger)}
          onClose={() => setRemindLedger(null)}
        />
      ) : null}
      {review.sheet}
    </View>
  );
}

export default OwnerPaymentsView;

const styles = StyleSheet.create({
  // the overdue row's quick action: a green bell and the word, a full 44 tall
  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: SIZES.touch,
    paddingHorizontal: SPACING.xs,
  },
  remind_pressed: {
    opacity: OPACITY.pressed,
  },
  remind_text: {
    ...TYPE.label,
    color: COLORS.cta,
  },
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
  month_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  month_arrow: {
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: OPACITY.disabled,
  },
  month_title: {
    ...TYPE.heading,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'center',
  },
  segments: {
    marginHorizontal: 0,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  summary: {
    gap: SPACING.sm,
  },
  kpi_row: {
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  empty_line: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    paddingVertical: SPACING.sm,
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
});

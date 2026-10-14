import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE, SIZES, RADIUS, BORDER } from '../../../theme';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import FeatureTile from '../../../components/ui/FeatureTile';
import KpiTile from '../../../components/ui/KpiTile';
import QuickAction from '../../../components/ui/QuickAction';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import Sparkline from '../../../components/ui/Sparkline';
import SectionHeader from '../../../components/ui/SectionHeader';
import FadeInView from '../../../components/ui/FadeInView';
import LogoutButton from '../../auth/components/LogoutButton';
import { useMessages } from '../../messages/context/MessagesContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { openCount } from '../../workOrders/utils/workOrderHelpers';
import { monthlyTotals, percentChange, shortMonth } from '../utils/overviewStats';
import { formatCurrency, formatCents } from '../../../utils/formatCurrency';
import { useLedger } from '../../payments/context/LedgerContext';
import { ownerPaymentsLine } from '../../payments/utils/ledgerHelpers';

// the fintech pass: an overview like a bank's home screen, a hello, one indigo summary card with this month's
// spending and its trend, three key numbers, the four things landlords open most, then everything else
function DashboardScreen(props) {
  // need the insets so the demo banner clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { unread_total } = useMessages();
  // open_count only exists in real mode, so the badge stays hidden in the demo
  const { is_remote, open_count, orders, expenses } = useWorkOrders();
  const { user } = useAuth();
  const { tenants } = useTenants();
  // the summary row counts from the lists already on hand, the same numbers the list screens show
  const open_orders = openCount(orders);
  const active_tenants = tenants.filter((tenant) => tenant.is_active).length;
  const first_name = user && user.name ? user.name.trim().split(/\s+/)[0] : '';
  // rent this month from the ledger already in memory: what needs doing first, and what's come in
  const ledger_store = useLedger();
  const rent = ownerPaymentsLine(ledger_store.ledgers, ledger_store.today);
  // this month's spending and the five months before it, from the expenses already loaded on the phone
  const months = monthlyTotals(expenses, new Date(), 6);
  const this_month = months[months.length - 1];
  const last_month = months[months.length - 2];
  const change = percentChange(this_month.total, last_month.total);
  let change_text = 'Nothing spent yet this month';
  if (this_month.total > 0 && change === null) {
    change_text = 'Nothing was spent in ' + shortMonth(last_month.month);
  } else if (change !== null) {
    change_text =
      (change === 0
        ? 'Same as '
        : Math.abs(change) + '% ' + (change > 0 ? 'more' : 'less') + ' than ') +
      shortMonth(last_month.month);
  }
  const trend_label =
    'Spending by month: ' +
    months.map((row) => shortMonth(row.month) + ' ' + formatCurrency(row.total)).join(', ');

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* only shows while the demo is running */}
      <DemoBanner />
      {/* it scrolls now, the header takes some room and a small phone can't fit every button */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* the hero: the big title, a hello, and the numbers worth a glance */}
        <FadeInView index={0}>
          <Text style={styles.overline}>Overview</Text>
          <Text style={styles.greeting} accessibilityRole="header">
            {first_name ? 'Hi, ' + first_name : 'Welcome back'}
          </Text>
          <SummaryBlock
            variant="brand"
            label={'Spent in ' + shortMonth(this_month.month)}
            value={formatCurrency(this_month.total)}
            caption={change_text}
            style={styles.summary}
          >
            <Sparkline
              values={months.map((row) => row.total)}
              color={COLORS.on_cta}
              height={44}
              label={trend_label}
              style={styles.sparkline}
            />
            <View style={styles.month_row}>
              <Text style={styles.month_label}>{shortMonth(months[0].month)}</Text>
              <Text style={styles.month_label}>{shortMonth(this_month.month)}</Text>
            </View>
          </SummaryBlock>
          <View style={styles.kpi_row}>
            <KpiTile
              label="Open orders"
              value={open_orders}
              caption="Not started"
              icon="construct"
              tone="danger"
            />
            <KpiTile
              label="Unread"
              value={unread_total || 0}
              caption="Messages"
              icon="chatbubble-ellipses"
              tone="info"
            />
            <KpiTile
              label="Tenants"
              value={active_tenants}
              caption="Active now"
              icon="people"
              tone="success"
            />
          </View>
          <View style={[styles.kpi_row, styles.collected]}>
            <KpiTile
              label={'Collected in ' + shortMonth(this_month.month)}
              value={formatCents(rent.collected_cents)}
              caption={'of ' + formatCents(rent.expected_cents) + ' rent expected'}
              icon="cash"
              tone="success"
              accessibilityHint="Opens Payments and Rent"
              onPress={() => props.navigation.navigate('Payments')}
            />
          </View>
        </FadeInView>

        <FadeInView index={1}>
          <SectionHeader title="Quick actions" />
          <View style={styles.quick_row}>
            {/* counts the orders nobody has started yet */}
            <QuickAction
              label="Work orders"
              icon="construct-outline"
              tone="brand"
              badge_count={open_count}
              badge_label={open_count + ' open work orders'}
              onPress={() => props.navigation.navigate('WorkOrders')}
            />
            {/* the badge sits on the corner of the button and hides itself at zero */}
            <QuickAction
              label="Messages"
              icon="chatbubble-ellipses-outline"
              tone="info"
              badge_count={unread_total}
              badge_label={unread_total + ' unread messages'}
              onPress={() => props.navigation.navigate('Messages')}
            />
            <QuickAction
              label="Tenants"
              icon="people-outline"
              tone="success"
              onPress={() => props.navigation.navigate('Tenants')}
            />
            <QuickAction
              label="Expenses"
              icon="receipt-outline"
              tone="warning"
              onPress={() => props.navigation.navigate('Expenses')}
            />
          </View>

          {/* the temporary tenant form, real mode hides it since only tenants can file requests there */}
          {!is_remote && (
            <PrimaryButton
              title="New Work Order"
              icon="add-circle-outline"
              variant="secondary"
              style={styles.new_order_button}
              onPress={() => props.navigation.navigate('NewWorkOrder')}
            />
          )}

          <SectionHeader title="More" />
          <View style={styles.grid}>
            <FeatureTile
              title="Payments and Rent"
              detail={rent.text}
              icon="card-outline"
              tone={rent.tone}
              badge_count={rent.claims}
              badge_label={rent.claims + ' payment claims to review'}
              accessibilityLabel={'Payments and Rent, ' + rent.text}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Payments')}
            />
            <FeatureTile
              title="Documents"
              detail="Leases and files"
              icon="document-text-outline"
              tone="neutral"
              style={styles.tile}
              onPress={() => props.navigation.navigate('Documents')}
            />
            <FeatureTile
              title="Checklist"
              detail="Move-in and move-out"
              icon="checkbox-outline"
              tone="accent"
              style={styles.tile}
              onPress={() => props.navigation.navigate('Checklist')}
            />
            {/* an empty half next to the odd third tile, so it stays the same size instead of stretching */}
            <View style={styles.tile} importantForAccessibility="no-hide-descendants" />
          </View>
          {/* only shows for a signed-in account, not in the demo */}
          <LogoutButton style={styles.logout_button} />
        </FadeInView>
      </ScrollView>
    </View>
  );
}

export default DashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  scroll: {
    width: '100%',
  },
  // capped so the tiles don't stretch across a whole iPad
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
    paddingBottom: SPACING.lg,
  },
  overline: {
    ...TYPE.overline,
    color: COLORS.text_muted,
  },
  greeting: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summary: {
    marginBottom: SPACING.sm + SPACING.xs,
  },
  sparkline: {
    marginTop: SPACING.sm + SPACING.xs,
  },
  month_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  month_label: {
    ...TYPE.caption,
    color: COLORS.on_brand_muted,
  },
  kpi_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  collected: {
    marginTop: SPACING.sm,
  },
  quick_row: {
    flexDirection: 'row',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  new_order_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm + SPACING.xs,
  },
  // two tiles to a row, they grow taller instead of squishing when the text is big
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm + SPACING.xs,
  },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  logout_button: {
    marginHorizontal: 0,
    marginTop: SPACING.lg,
  },
});

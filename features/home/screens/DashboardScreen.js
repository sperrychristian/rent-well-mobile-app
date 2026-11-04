import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, SIZES } from '../../../theme';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import ProgressLine from '../../../components/ui/ProgressLine';
import ListRow from '../../../components/ui/ListRow';
import FadeInView from '../../../components/ui/FadeInView';
import LogoutButton from '../../auth/components/LogoutButton';
import HomeTopBar from '../components/HomeTopBar';
import HeroNote from '../components/HeroNote';
import OnboardingCard from '../components/OnboardingCard';
import DemoTourSheet from '../components/DemoTourSheet';
import { useDemoTour } from '../hooks/useDemoTour';
import { useMessages } from '../../messages/context/MessagesContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { openCount, activeCount } from '../../workOrders/utils/workOrderHelpers';
import { monthlyTotals, shortMonth } from '../utils/overviewStats';
import { formatCurrency, formatCents } from '../../../utils/formatCurrency';
import { useLedger } from '../../payments/context/LedgerContext';
import { ownerPaymentsLine, behindSummary, monthTitle } from '../../payments/utils/ledgerHelpers';
import { collectedShare, monthOf } from '../../payments/utils/ledgerMath';
import { demo_landlord } from '../../messages/data/sampleThreads';
import { leasesSummary, urgentLease } from '../../leases/utils/leaseHelpers';
import { useProfitReport } from '../../profit/hooks/useProfitReport';
import { themedStyles } from '../../../utils/themedStyles';

// the fintech pass: an overview like a bank's home screen, a hello, one indigo summary card with this month's
// spending and its trend, three key numbers, the four things landlords open most, then everything else
// the Hearth pass: the wordmark and your initials on top, then one big number (rent collected this month)
// with a thin progress line and one line about who's behind, then every place to go as plain rows
function DashboardScreen(props) {
  // need the insets so the demo banner clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { unread_total } = useMessages();
  // open_count only exists in real mode, so the badge stays hidden in the demo
  const { orders, expenses, documents, checklists, demo_mode, is_remote } = useWorkOrders();
  const { user } = useAuth();
  const { tenants } = useTenants();
  // the summary row counts from the lists already on hand, the same numbers the list screens show
  const open_orders = openCount(orders);
  const in_progress_orders = activeCount(orders) - open_orders;
  const active_tenants = tenants.filter((tenant) => tenant.is_active).length;
  // leases come with the tenants, the row says how many end soon and the terracotta line names the soonest
  const leases_line = leasesSummary(tenants);
  const urgent_lease = urgentLease(tenants);
  // this month's net from the profit report (the server's in real mode), like "$2,340 net this month"
  const profit = useProfitReport(String(new Date().getFullYear()), null);
  const this_profit_month = profit.report
    ? profit.report.total.months[new Date().getMonth()]
    : null;
  // rent this month from the ledger already in memory: what needs doing first, and what's come in
  const ledger_store = useLedger();
  const rent = ownerPaymentsLine(
    ledger_store.ledgers,
    ledger_store.today,
    ledger_store.current_summary,
  );
  const behind = behindSummary(ledger_store.ledgers, ledger_store.today);
  // this month's spending and the five months before it, from the expenses already loaded on the phone
  const months = monthlyTotals(expenses, new Date(), 6);
  const this_month = months[months.length - 1];
  const open_checklists = checklists.filter((checklist) => !checklist.completed).length;
  const name = user && user.name ? user.name : demo_mode ? demo_landlord.name : '';
  // the demo opens a short tour the first time, real mode never does
  const tour = useDemoTour(demo_mode);

  let note = { text: 'Everyone is paid up', tone: 'success', icon: 'checkmark-circle-outline' };
  if (behind.count > 0) {
    note = {
      text:
        (behind.count === 1 ? '1 tenant is behind, ' : behind.count + ' tenants are behind, ') +
        formatCents(behind.cents) +
        ' in total',
      tone: 'danger',
      icon: 'time-outline',
    };
  } else if (rent.claims > 0) {
    note = { text: rent.text, tone: 'warning', icon: 'hourglass-outline' };
  } else if (ledger_store.ledgers.length === 0) {
    note = { text: 'Set up rent to start tracking', tone: 'neutral', icon: 'card-outline' };
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* it scrolls now, the header takes some room and a small phone can't fit every button */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* only shows while the demo is running */}
        <DemoBanner />
        <HomeTopBar name={name} onProfile={() => props.navigation.navigate('Settings')} />
        {/* a new landlord's first-run checklist, it hides itself in the demo and once it's done */}
        <OnboardingCard navigation={props.navigation} />

        {/* the hero: the big title, a hello, and the numbers worth a glance */}
        <FadeInView index={0}>
          <SummaryBlock
            label={'Collected in ' + monthTitle(monthOf(ledger_store.today)).split(' ')[0]}
            value={formatCents(rent.collected_cents)}
            caption={'of ' + formatCents(rent.expected_cents) + ' expected'}
          >
            <ProgressLine
              share={collectedShare(rent.collected_cents, rent.expected_cents)}
              label={
                Math.round(collectedShare(rent.collected_cents, rent.expected_cents) * 100) +
                ' percent of expected rent collected'
              }
              style={styles.progress}
            />
          </SummaryBlock>
          <HeroNote
            text={note.text}
            tone={note.tone}
            icon={note.icon}
            accessibilityHint="Opens Payments and Rent"
            onPress={() => props.navigation.navigate('Payments')}
          />
          {/* only when a lease ends within 30 days, so it stays quiet the rest of the year */}
          {urgent_lease ? (
            <HeroNote
              text={urgent_lease.text}
              tone="danger"
              icon="document-text-outline"
              accessibilityHint="Opens the lease"
              onPress={() =>
                props.navigation.navigate('TenantLease', { tenancyId: urgent_lease.tenancy_id })
              }
            />
          ) : null}
        </FadeInView>

        <FadeInView index={1} style={styles.rows}>
          <ListRow
            icon="card-outline"
            title="Payments"
            subtitle={rent.text}
            subtitle_tone={rent.tone === 'danger' ? 'danger' : undefined}
            divider
            onPress={() => props.navigation.navigate('Payments')}
          />
          {/* counts the orders nobody has started yet */}
          <ListRow
            icon="construct-outline"
            title="Work orders"
            subtitle={
              open_orders === 0 && in_progress_orders <= 0
                ? 'Nothing open'
                : open_orders +
                  ' open' +
                  (in_progress_orders > 0 ? ', ' + in_progress_orders + ' in progress' : '')
            }
            divider
            onPress={() => props.navigation.navigate('WorkOrders')}
          />
          <ListRow
            icon="chatbubble-outline"
            title="Messages"
            subtitle={unread_total ? unread_total + ' unread' : 'All caught up'}
            divider
            onPress={() => props.navigation.navigate('Messages')}
          />
          <ListRow
            icon="people-outline"
            title="Tenants"
            subtitle={
              active_tenants + (active_tenants === 1 ? ' current tenant' : ' current tenants')
            }
            divider
            onPress={() => props.navigation.navigate('Tenants')}
          />
          <ListRow
            icon="document-outline"
            title="Leases"
            subtitle={leases_line.text}
            divider
            onPress={() => props.navigation.navigate('Leases')}
          />
          <ListRow
            icon="trending-up-outline"
            title="Profit"
            subtitle={
              this_profit_month
                ? formatCents(this_profit_month.net_cents, { cents: false }) + ' net this month'
                : 'Rent in, expenses out'
            }
            subtitle_tone={
              this_profit_month && this_profit_month.net_cents < 0 ? 'danger' : undefined
            }
            divider
            onPress={() => props.navigation.navigate('Profit')}
          />
          <ListRow
            icon="receipt-outline"
            title="Expenses"
            subtitle={
              formatCurrency(this_month.total) + ' spent in ' + shortMonth(this_month.month)
            }
            divider
            onPress={() => props.navigation.navigate('Expenses')}
          />
          <ListRow
            icon="document-text-outline"
            title="Documents"
            subtitle={documents.length + (documents.length === 1 ? ' file' : ' files')}
            divider
            onPress={() => props.navigation.navigate('Documents')}
          />
          <ListRow
            icon="checkbox-outline"
            title="Checklist"
            subtitle={
              open_checklists === 0
                ? 'Move-in and move-out'
                : open_checklists + (open_checklists === 1 ? ' in progress' : ' in progress')
            }
            divider
            onPress={() => props.navigation.navigate('Checklist')}
          />
          {/* rent due dates, lease ends, and work order dates on one month */}
          <ListRow
            icon="calendar-outline"
            title="Calendar"
            subtitle="Rent due dates, lease ends, repairs"
            onPress={() => props.navigation.navigate('Calendar')}
          />

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
          {/* only shows for a signed-in account, not in the demo */}
          <LogoutButton style={styles.logout_button} />
        </FadeInView>
      </ScrollView>
      <DemoTourSheet visible={tour.visible} role="owner" onClose={tour.close} />
    </View>
  );
}

export default DashboardScreen;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    paddingBottom: SPACING.xl,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  progress: {
    marginTop: SPACING.sm,
  },
  rows: {
    marginTop: SPACING.lg,
  },
  new_order_button: {
    marginHorizontal: 0,
    marginTop: SPACING.lg,
  },
  logout_button: {
    marginTop: SPACING.md,
  },
}));

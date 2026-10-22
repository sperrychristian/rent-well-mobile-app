import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DemoBanner from '../../../components/DemoBanner';
import LogoutButton from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/context/AuthContext';
import { useMessages } from '../../messages/context/MessagesContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { placeLabel } from '../../tenants/utils/tenantHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { ordersForTenant, activeCount } from '../../workOrders/utils/workOrderHelpers';
import { useLedger } from '../../payments/context/LedgerContext';
import { tenantRentLine, upcomingRent, shortDate } from '../../payments/utils/ledgerHelpers';
import { deriveLedger } from '../../payments/utils/ledgerMath';
import { formatCents } from '../../../utils/formatCurrency';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import ListRow from '../../../components/ui/ListRow';
import FadeInView from '../../../components/ui/FadeInView';
import HomeTopBar from '../components/HomeTopBar';
import { tenantLeaseLine, leaseStatusLabel, shortLeaseDate } from '../../leases/utils/leaseHelpers';
import HeroNote from '../components/HeroNote';
import DemoTourSheet from '../components/DemoTourSheet';
import { useDemoTour } from '../hooks/useDemoTour';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

// the tenant's home: message the landlord or report something that needs fixing
// the Hearth pass: the wordmark and your initials, then what you owe right now as one big number with the
// next rent under it, one line saying if anything is late, and the places to go as plain rows
function TenantHomeScreen(props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unread_total } = useMessages();
  const { active_count, demo_mode, orders } = useWorkOrders();
  // the demo has no server count, so it counts Sam's requests in the shared demo list
  const in_progress = demo_mode
    ? activeCount(ordersForTenant(orders, demo_tenant.name))
    : active_count;
  // all of their requests, for the summary card's caption (real mode's list only has their own already)
  const total_requests = demo_mode
    ? ordersForTenant(orders, demo_tenant.name).length
    : orders.length;
  const name = demo_mode ? demo_tenant.name : user ? user.name : '';
  // the demo opens a short tour the first time, real mode never does
  const tour = useDemoTour(demo_mode);
  // with no active rental the tenant can only read, and this flips back on its own if they're assigned again
  const { is_read_only, my_active_tenancies, my_ended_tenancies } = useTenants();
  // rent from the ledger already in memory: overdue, due now, or "Rent due Nov 1: $1,200.00"
  const ledger_store = useLedger();
  const rent = tenantRentLine(ledger_store.current_ledger, ledger_store.today);
  const derived = ledger_store.current_ledger
    ? deriveLedger(ledger_store.current_ledger, ledger_store.today)
    : null;
  const next_rent = upcomingRent(ledger_store.current_ledger, ledger_store.today);
  const due_now = derived ? derived.due_now_cents : 0;
  // the one line under the hero: overdue in terracotta, due in amber, or all paid up in green
  let note = { text: "You're all paid up", tone: 'success', icon: 'checkmark-circle-outline' };
  if (!derived) {
    note = { text: "Your landlord hasn't set up rent yet", tone: 'neutral', icon: 'card-outline' };
  } else if (derived.overdue_cents > 0) {
    note = {
      text: formatCents(derived.overdue_cents) + ' is overdue',
      tone: 'danger',
      icon: 'alert-circle-outline',
    };
  } else if (due_now > 0) {
    note = { text: 'Due now', tone: 'warning', icon: 'time-outline' };
  }

  // their lease, read only: the line under the hero shows up within 90 days of the end
  const my_lease = my_active_tenancies.length > 0 ? my_active_tenancies[0].lease : null;
  const lease_line = tenantLeaseLine(my_lease, ledger_store.today);
  let lease_subtitle = 'Not recorded yet';
  if (my_lease && my_lease.lease_status === 'month_to_month') {
    lease_subtitle = 'Month to month';
  } else if (my_lease && my_lease.lease_end_on) {
    lease_subtitle =
      leaseStatusLabel(my_lease).label + ', ends ' + shortLeaseDate(my_lease.lease_end_on);
  }

  if (is_read_only) {
    const last = my_ended_tenancies[0];
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* only shows while the demo is running, with the switch to the landlord side */}
        <DemoBanner />
        <HomeTopBar name={name} onProfile={() => props.navigation.navigate('Settings')} />
        <Text style={styles.name_line} accessibilityRole="header">
          No Active Rental
        </Text>
        <View style={styles.ended}>
          <Ionicons name="home-outline" size={SIZES.row_icon} color={COLORS.text_muted} />
          <View style={styles.ended_text}>
            <Text style={styles.ended_title}>Your tenancy has ended</Text>
            <Text style={styles.muted}>
              {last
                ? 'You moved out of ' +
                  placeLabel(last.property_name, last.unit_label) +
                  ' on ' +
                  last.ended_at +
                  '.'
                : "You don't have an active rental right now."}
            </Text>
            <Text style={styles.muted}>
              Your messages and past requests are still here to read. If your landlord adds you to a
              rental again, everything opens back up.
            </Text>
          </View>
        </View>

        <View style={styles.rows}>
          <ListRow
            icon="chatbubble-outline"
            title="Message History"
            subtitle={unread_total ? 'Read only, ' + unread_total + ' unread' : 'Read only'}
            accessibilityLabel="Message history, read only"
            divider
            onPress={() => props.navigation.navigate('Messages')}
          />
          {/* their rent history stays readable too, with no I Paid button */}
          <ListRow
            icon="card-outline"
            title="Payment History"
            subtitle="Read only"
            accessibilityLabel="Payment history, read only"
            divider
            onPress={() => props.navigation.navigate('Payments')}
          />
          <ListRow
            icon="list-outline"
            title="Past Requests"
            subtitle="Read only"
            accessibilityLabel="Past requests, read only"
            onPress={() => props.navigation.navigate('PastRequests')}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <LogoutButton />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* only shows while the demo is running, with the switch to the landlord side */}
      <DemoBanner />
      <HomeTopBar name={name} onProfile={() => props.navigation.navigate('Settings')} />
      {/* the hero: the big title, a hello, where they live, and the two numbers they care about */}
      {/* the fintech pass: a hello, an indigo summary card with their requests in progress, two key numbers,
          the two things tenants do most, then the rest */}
      <FadeInView index={0}>
        {/* where they live now, once GET /me has answered */}
        {my_active_tenancies.length > 0 && (
          <View style={styles.place_row}>
            <Ionicons name="location-outline" size={SIZES.icon_small} color={COLORS.text_muted} />
            <Text style={styles.place}>
              {my_active_tenancies
                .map((tenancy) => placeLabel(tenancy.property_name, tenancy.unit_label))
                .join(' · ')}
            </Text>
          </View>
        )}
        <SummaryBlock
          label={due_now > 0 ? 'Due now' : 'Your balance'}
          value={formatCents(Math.max(due_now, 0))}
          caption={
            next_rent
              ? 'Next rent ' +
                formatCents(next_rent.amount_cents) +
                ' on ' +
                shortDate(next_rent.date)
              : 'No rent scheduled'
          }
        />
        <HeroNote
          text={note.text}
          tone={note.tone}
          icon={note.icon}
          accessibilityHint="Opens Payments and Rent"
          onPress={() => props.navigation.navigate('Payments')}
        />
        {lease_line ? (
          <HeroNote text={lease_line.text} tone={lease_line.tone} icon="document-text-outline" />
        ) : null}
      </FadeInView>

      <FadeInView index={1} style={styles.rows}>
        <ListRow
          icon="card-outline"
          title="Payments"
          subtitle={rent.text}
          subtitle_tone={rent.tone === 'danger' ? 'danger' : undefined}
          accessibilityLabel={'Payments and rent, ' + rent.text}
          divider
          onPress={() => props.navigation.navigate('Payments')}
        />
        <ListRow
          icon="list-outline"
          title="My Requests"
          subtitle={
            in_progress
              ? in_progress + (in_progress === 1 ? ' request' : ' requests') + ' in progress'
              : total_requests === 0
                ? 'Nothing reported yet'
                : 'See what you reported and where it is at'
          }
          accessibilityLabel="My requests"
          divider
          onPress={() => props.navigation.navigate('MyRequests')}
        />
        {/* still saves on this phone only, it moves to the server in a later phase */}
        <ListRow
          icon="construct-outline"
          title="Report an Issue"
          subtitle="Something broken or leaking"
          accessibilityLabel="Report an issue"
          divider
          onPress={() => props.navigation.navigate('NewWorkOrder')}
        />
        <ListRow
          icon="chatbubble-outline"
          title="Message Landlord"
          subtitle={unread_total ? unread_total + ' unread' : 'All caught up'}
          accessibilityLabel={'Messages' + (unread_total ? ', ' + unread_total + ' unread' : '')}
          divider
          onPress={() => props.navigation.navigate('Messages')}
        />
        {/* read only, the landlord sets and renews the lease */}
        <ListRow
          icon="document-outline"
          title="Your Lease"
          subtitle={lease_subtitle}
          accessibilityLabel={'Your lease, ' + lease_subtitle}
        />
      </FadeInView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <LogoutButton style={styles.logout_button} />
      </View>
      <DemoTourSheet visible={tour.visible} role="tenant" onClose={tour.close} />
    </ScrollView>
  );
}

export default TenantHomeScreen;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // flexGrow instead of flex so it can scroll, the footer still sits at the bottom when there's room
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screen_padding,
    paddingTop: SPACING.md,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  place_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  place: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    flexShrink: 1,
  },
  name_line: {
    ...TYPE.name,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  ended: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  ended_text: {
    flex: 1,
    gap: SPACING.xs,
  },
  ended_title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  muted: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  rows: {
    marginTop: SPACING.lg,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: SPACING.lg,
  },
  logout_button: {
    marginHorizontal: 0,
  },
});

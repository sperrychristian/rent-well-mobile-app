import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import DemoBanner from '../../../components/DemoBanner';
import UnreadBadge from '../../messages/components/UnreadBadge';
import LogoutButton from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/context/AuthContext';
import { useMessages } from '../../messages/context/MessagesContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { placeLabel } from '../../tenants/utils/tenantHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { ordersForTenant, activeCount } from '../../workOrders/utils/workOrderHelpers';
import FeatureTile from '../../../components/ui/FeatureTile';
import { useLedger } from '../../payments/context/LedgerContext';
import { tenantRentLine } from '../../payments/utils/ledgerHelpers';
import KpiTile from '../../../components/ui/KpiTile';
import QuickAction from '../../../components/ui/QuickAction';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import SectionHeader from '../../../components/ui/SectionHeader';
import FadeInView from '../../../components/ui/FadeInView';
import { COLORS, SPACING, TYPE, SIZES, OPACITY, RADIUS, BORDER } from '../../../theme';

// the tenant's home: message the landlord or report something that needs fixing
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
  // with no active rental the tenant can only read, and this flips back on its own if they're assigned again
  const { is_read_only, my_active_tenancies, my_ended_tenancies } = useTenants();
  // rent from the ledger already in memory: overdue, due now, or "Rent due Nov 1: $1,200.00"
  const ledger_store = useLedger();
  const rent = tenantRentLine(ledger_store.current_ledger, ledger_store.today);

  if (is_read_only) {
    const last = my_ended_tenancies[0];
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* only shows while the demo is running, with the switch to the landlord side */}
        <DemoBanner />
        <ScreenTitle>No Active Rental</ScreenTitle>
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="home-outline" size={32} color={COLORS.text_muted} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Your tenancy has ended</Text>
              <Text style={styles.card_detail}>
                {last
                  ? 'You moved out of ' +
                    placeLabel(last.property_name, last.unit_label) +
                    ' on ' +
                    last.ended_at +
                    '.'
                  : "You don't have an active rental right now."}
              </Text>
              <Text style={styles.card_detail}>
                Your messages and past requests are still here to read. If your landlord adds you to
                a rental again, everything opens back up.
              </Text>
            </View>
          </View>
        </Card>

        <Pressable
          onPress={() => props.navigation.navigate('Messages')}
          accessibilityRole="button"
          accessibilityLabel="Message history, read only"
          style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
        >
          <Card>
            <View style={styles.card_row}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.info_text} />
              <View style={styles.card_text}>
                <Text style={styles.card_title}>Message History</Text>
                <Text style={styles.card_detail}>Read only</Text>
              </View>
              <UnreadBadge count={unread_total} />
              <Ionicons name="chevron-forward" size={20} color={COLORS.text_muted} />
            </View>
          </Card>
        </Pressable>

        {/* their rent history stays readable too, with no I Paid button */}
        <Pressable
          onPress={() => props.navigation.navigate('Payments')}
          accessibilityRole="button"
          accessibilityLabel="Payment history, read only"
          style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
        >
          <Card>
            <View style={styles.card_row}>
              <Ionicons name="card-outline" size={32} color={COLORS.info_text} />
              <View style={styles.card_text}>
                <Text style={styles.card_title}>Payment History</Text>
                <Text style={styles.card_detail}>Read only</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text_muted} />
            </View>
          </Card>
        </Pressable>

        <Pressable
          onPress={() => props.navigation.navigate('PastRequests')}
          accessibilityRole="button"
          accessibilityLabel="Past requests, read only"
          style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
        >
          <Card>
            <View style={styles.card_row}>
              <Ionicons name="list-outline" size={32} color={COLORS.success_text} />
              <View style={styles.card_text}>
                <Text style={styles.card_title}>Past Requests</Text>
                <Text style={styles.card_detail}>Read only</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text_muted} />
            </View>
          </Card>
        </Pressable>

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
      {/* the hero: the big title, a hello, where they live, and the two numbers they care about */}
      {/* the fintech pass: a hello, an indigo summary card with their requests in progress, two key numbers,
          the two things tenants do most, then the rest */}
      <FadeInView index={0}>
        <Text style={styles.overline}>Your home</Text>
        <Text style={styles.greeting} accessibilityRole="header">
          Hi{name ? ', ' + name : ''}!
        </Text>
        {/* where they live now, once GET /me has answered */}
        {my_active_tenancies.length > 0 && (
          <View style={styles.place_row}>
            <Ionicons name="location-outline" size={16} color={COLORS.text_muted} />
            <Text style={styles.place}>
              {my_active_tenancies
                .map((tenancy) => placeLabel(tenancy.property_name, tenancy.unit_label))
                .join(' · ')}
            </Text>
          </View>
        )}
        <SummaryBlock
          variant="brand"
          label="Requests in progress"
          value={String(in_progress || 0)}
          caption={
            total_requests === 0
              ? 'Nothing reported yet'
              : 'Out of ' + total_requests + (total_requests === 1 ? ' request' : ' requests')
          }
          style={styles.summary}
        />
        <View style={styles.summary_row}>
          <KpiTile
            label="Unread"
            value={unread_total || 0}
            caption="Messages"
            icon="chatbubble-ellipses"
            tone="info"
          />
          <KpiTile
            label="Requests"
            value={total_requests}
            caption="All time"
            icon="list"
            tone="success"
          />
        </View>
      </FadeInView>

      <FadeInView index={1}>
        <SectionHeader title="Quick actions" />
        <View style={styles.quick_row}>
          {/* still saves on this phone only, it moves to the server in a later phase */}
          <QuickAction
            label="Report an issue"
            icon="construct-outline"
            tone="brand"
            accessibilityLabel="Report an issue"
            onPress={() => props.navigation.navigate('NewWorkOrder')}
          />
          <QuickAction
            label="Message landlord"
            icon="chatbubble-ellipses-outline"
            tone="info"
            badge_count={unread_total}
            badge_label={unread_total + ' unread messages'}
            accessibilityLabel={'Messages' + (unread_total ? ', ' + unread_total + ' unread' : '')}
            onPress={() => props.navigation.navigate('Messages')}
          />
        </View>

        <SectionHeader title="Your rental" />
        <View style={styles.grid}>
          <FeatureTile
            title="My Requests"
            detail={
              in_progress
                ? in_progress + (in_progress === 1 ? ' request' : ' requests') + ' in progress'
                : 'See what you reported and where it is at'
            }
            icon="list-outline"
            tone="success"
            accessibilityLabel="My requests"
            style={styles.tile}
            onPress={() => props.navigation.navigate('MyRequests')}
          />
          <FeatureTile
            title="Payments and Rent"
            detail={rent.text}
            icon={rent.tone === 'danger' ? 'alert-circle-outline' : 'card-outline'}
            tone={rent.tone}
            accessibilityLabel={'Payments and rent, ' + rent.text}
            style={styles.tile}
            onPress={() => props.navigation.navigate('Payments')}
          />
        </View>
      </FadeInView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <LogoutButton style={styles.logout_button} />
      </View>
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
  },
  place_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  place: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    flexShrink: 1,
  },
  greeting: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  summary_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
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
  // the read-only home still uses the full-width cards
  card_press: {
    width: '100%',
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
  card_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  card_text: {
    flex: 1,
  },
  card_title: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  card_detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: SPACING.lg,
  },
  logout_button: {
    marginHorizontal: 0,
  },
  overline: {
    ...TYPE.overline,
    color: COLORS.text_muted,
  },
  summary: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm + SPACING.xs,
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
});

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
import StatTile from '../../../components/ui/StatTile';
import SectionHeader from '../../../components/ui/SectionHeader';
import FadeInView from '../../../components/ui/FadeInView';
import { COLORS, SPACING, TYPE, SIZES, OPACITY } from '../../../theme';

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
  const name = demo_mode ? demo_tenant.name : user ? user.name : '';
  // with no active rental the tenant can only read, and this flips back on its own if they're assigned again
  const { is_read_only, my_active_tenancies, my_ended_tenancies } = useTenants();

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
      <FadeInView index={0}>
        <ScreenTitle>Home</ScreenTitle>
        <Text style={styles.greeting}>Hi{name ? ', ' + name : ''}!</Text>
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
        <View style={styles.summary_row}>
          <StatTile
            value={unread_total || 0}
            label="Unread messages"
            icon="chatbubble-ellipses"
            color={COLORS.info_text}
          />
          <StatTile
            value={in_progress || 0}
            label="Requests in progress"
            icon="time"
            color={COLORS.warning_text}
          />
        </View>
      </FadeInView>

      <FadeInView index={1}>
        <SectionHeader title="Your rental" />
        <View style={styles.grid}>
          <FeatureTile
            title="Messages"
            detail="Talk with your landlord"
            icon="chatbubble-ellipses-outline"
            fill={COLORS.action}
            badge_count={unread_total}
            badge_label={unread_total + ' unread messages'}
            accessibilityLabel={'Messages' + (unread_total ? ', ' + unread_total + ' unread' : '')}
            style={styles.tile}
            onPress={() => props.navigation.navigate('Messages')}
          />
          <FeatureTile
            title="My Requests"
            detail={
              in_progress
                ? in_progress + (in_progress === 1 ? ' request' : ' requests') + ' in progress'
                : 'See what you reported and where it is at'
            }
            icon="list-outline"
            fill={COLORS.success}
            accessibilityLabel="My requests"
            style={styles.tile}
            onPress={() => props.navigation.navigate('MyRequests')}
          />
          {/* still saves on this phone only, it moves to the server in a later phase */}
          <FeatureTile
            title="Report an Issue"
            detail="Something broken or not working"
            icon="construct-outline"
            fill={COLORS.cta}
            icon_color={COLORS.on_cta}
            accessibilityLabel="Report an issue"
            style={styles.tile}
            onPress={() => props.navigation.navigate('NewWorkOrder')}
          />
          <FeatureTile
            title="Payments and Rent"
            detail="Coming soon: pay rent and see past payments"
            icon="card-outline"
            fill={COLORS.priority_low}
            accessibilityLabel="Payments and rent"
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
    ...TYPE.heading,
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
});

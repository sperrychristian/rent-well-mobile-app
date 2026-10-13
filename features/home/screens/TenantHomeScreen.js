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
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

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
            <Ionicons name="home-outline" size={32} color={COLORS.secondary} />
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
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.action} />
              <View style={styles.card_text}>
                <Text style={styles.card_title}>Message History</Text>
                <Text style={styles.card_detail}>Read only</Text>
              </View>
              <UnreadBadge count={unread_total} />
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
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
              <Ionicons name="list-outline" size={32} color={COLORS.success} />
              <View style={styles.card_text}>
                <Text style={styles.card_title}>Past Requests</Text>
                <Text style={styles.card_detail}>Read only</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
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
      <ScreenTitle>Home</ScreenTitle>
      <Text style={styles.greeting}>Hi{name ? ', ' + name : ''}!</Text>
      {/* where they live now, once GET /me has answered */}
      {my_active_tenancies.length > 0 && (
        <Text style={styles.place}>
          {my_active_tenancies
            .map((tenancy) => placeLabel(tenancy.property_name, tenancy.unit_label))
            .join(' · ')}
        </Text>
      )}

      <Pressable
        onPress={() => props.navigation.navigate('Messages')}
        accessibilityRole="button"
        accessibilityLabel={'Messages' + (unread_total ? ', ' + unread_total + ' unread' : '')}
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.action} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Messages</Text>
              <Text style={styles.card_detail}>Talk with your landlord</Text>
            </View>
            <UnreadBadge count={unread_total} />
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      <Pressable
        onPress={() => props.navigation.navigate('MyRequests')}
        accessibilityRole="button"
        accessibilityLabel="My requests"
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="list-outline" size={32} color={COLORS.success} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>My Requests</Text>
              <Text style={styles.card_detail}>
                {in_progress
                  ? in_progress + (in_progress === 1 ? ' request' : ' requests') + ' in progress'
                  : 'See what you reported and where it is at'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      {/* still saves on this phone only, it moves to the server in a later phase */}
      <Pressable
        onPress={() => props.navigation.navigate('NewWorkOrder')}
        accessibilityRole="button"
        accessibilityLabel="Report an issue"
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="construct-outline" size={32} color={COLORS.danger} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Report an Issue</Text>
              <Text style={styles.card_detail}>Something broken or not working</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      <Pressable
        onPress={() => props.navigation.navigate('Payments')}
        accessibilityRole="button"
        accessibilityLabel="Payments and rent"
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="card-outline" size={32} color={COLORS.priority_low} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Payments and Rent</Text>
              <Text style={styles.card_detail}>Coming soon: pay rent and see past payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <LogoutButton />
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
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  place: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  greeting: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: FONT_SIZES.body,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  card_press: {
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
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
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  card_detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});

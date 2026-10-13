import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import ScreenTitle from '../../../components/ScreenTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import FeatureTile from '../../../components/ui/FeatureTile';
import StatTile from '../../../components/ui/StatTile';
import SectionHeader from '../../../components/ui/SectionHeader';
import FadeInView from '../../../components/ui/FadeInView';
import LogoutButton from '../../auth/components/LogoutButton';
import { useMessages } from '../../messages/context/MessagesContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { openCount } from '../../workOrders/utils/workOrderHelpers';

function DashboardScreen(props) {
  // need the insets so the demo banner clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { unread_total } = useMessages();
  // open_count only exists in real mode, so the badge stays hidden in the demo
  const { is_remote, open_count, orders } = useWorkOrders();
  const { user } = useAuth();
  const { tenants } = useTenants();
  // the summary row counts from the lists already on hand, the same numbers the list screens show
  const open_orders = openCount(orders);
  const active_tenants = tenants.filter((tenant) => tenant.is_active).length;
  const first_name = user && user.name ? user.name.trim().split(/\s+/)[0] : '';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* only shows while the demo is running */}
      <DemoBanner />
      {/* it scrolls now, the header takes some room and a small phone can't fit every button */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* the hero: the big title, a hello, and the numbers worth a glance */}
        <FadeInView index={0}>
          <ScreenTitle>Dashboard</ScreenTitle>
          <Text style={styles.greeting}>
            {first_name ? 'Hi, ' + first_name + '!' : 'Hi there!'}
          </Text>
          <Text style={styles.subgreeting}>{"Here's what needs you today."}</Text>
          <View style={styles.summary_row}>
            <StatTile
              value={open_orders}
              label="Open work orders"
              icon="construct"
              color={COLORS.danger_text}
            />
            <StatTile
              value={unread_total}
              label="Unread messages"
              icon="chatbubble-ellipses"
              color={COLORS.info_text}
            />
            <StatTile
              value={active_tenants}
              label="Active tenants"
              icon="people"
              color={COLORS.success_text}
            />
          </View>
        </FadeInView>

        <FadeInView index={1}>
          {/* the temporary tenant form, real mode hides it since only tenants can file requests there */}
          {!is_remote && (
            <PrimaryButton
              title="New Work Order"
              icon="add-circle-outline"
              variant="primary"
              style={styles.new_order_button}
              onPress={() => props.navigation.navigate('NewWorkOrder')}
            />
          )}
          <SectionHeader title="Manage" />
          <View style={styles.grid}>
            {/* counts the orders nobody has started yet */}
            <FeatureTile
              title="Work Orders"
              detail="Repairs and requests"
              icon="construct-outline"
              fill={COLORS.cta}
              icon_color={COLORS.on_cta}
              badge_count={open_count}
              badge_label={open_count + ' open work orders'}
              style={styles.tile}
              onPress={() => props.navigation.navigate('WorkOrders')}
            />
            {/* the badge sits on the corner of the button and hides itself at zero */}
            <FeatureTile
              title="Messages"
              detail="Talk with tenants"
              icon="chatbubble-ellipses-outline"
              fill={COLORS.action}
              badge_count={unread_total}
              badge_label={unread_total + ' unread messages'}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Messages')}
            />
            <FeatureTile
              title="Tenants"
              detail="Units, invites, history"
              icon="people-outline"
              fill={COLORS.success}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Tenants')}
            />
            <FeatureTile
              title="Payments and Rent"
              detail="Coming soon"
              icon="card-outline"
              fill={COLORS.priority_low}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Payments')}
            />
          </View>

          <SectionHeader title="Records" />
          <View style={styles.grid}>
            <FeatureTile
              title="Documents"
              detail="Leases and files"
              icon="document-text-outline"
              fill={COLORS.tag_billed}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Documents')}
            />
            <FeatureTile
              title="Checklist"
              detail="Move-in and move-out"
              icon="checkbox-outline"
              fill={COLORS.accent}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Checklist')}
            />
            <FeatureTile
              title="Expenses"
              detail="Costs, mileage, taxes"
              icon="receipt-outline"
              fill={COLORS.highlight}
              icon_color={COLORS.on_light}
              style={styles.tile}
              onPress={() => props.navigation.navigate('Expenses')}
            />
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
  greeting: {
    ...TYPE.heading,
    color: COLORS.text,
  },
  subgreeting: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginBottom: SPACING.md,
  },
  summary_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  new_order_button: {
    marginHorizontal: 0,
    marginTop: SPACING.md,
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

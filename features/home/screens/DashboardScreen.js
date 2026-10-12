import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../../theme';
import ScreenTitle from '../../../components/ScreenTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import UnreadBadge from '../../messages/components/UnreadBadge';
import LogoutButton from '../../auth/components/LogoutButton';
import { useMessages } from '../../messages/context/MessagesContext';

function DashboardScreen(props) {
  // need the insets so the demo banner clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { unread_total } = useMessages();

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      {/* only shows while the demo is running */}
      <DemoBanner />
      <View style={styles.content}>
        <View>
          <ScreenTitle>Dashboard</ScreenTitle>
        </View>
        <View style={styles.options_container}>
          <PrimaryButton
            title="Work Orders"
            icon="construct-outline"
            style={styles.work_order_button}
            onPress={() => props.navigation.navigate('WorkOrders')}
          />
          <PrimaryButton
            title="New Work Order"
            icon="add-circle-outline"
            style={styles.new_order_button}
            onPress={() => props.navigation.navigate('NewWorkOrder')}
          />
          {/* the badge sits on the corner of the button and hides itself at zero */}
          <View>
            <PrimaryButton
              title="Messages"
              icon="chatbubble-ellipses-outline"
              style={styles.messages_button}
              onPress={() => props.navigation.navigate('Messages')}
            />
            <UnreadBadge count={unread_total} style={styles.unread_badge} />
          </View>
          <PrimaryButton
            title="Tenants"
            icon="people-outline"
            style={styles.tenants_button}
            text_color={COLORS.text_light}
            onPress={() => props.navigation.navigate('Tenants')}
          />
          <PrimaryButton
            title="Documents"
            icon="document-text-outline"
            style={styles.documents_button}
            text_color={COLORS.text_dark}
            onPress={() => props.navigation.navigate('Documents')}
          />
          <PrimaryButton
            title="Checklist"
            icon="checkbox-outline"
            style={styles.checklist_button}
            onPress={() => props.navigation.navigate('Checklist')}
          />
          <PrimaryButton
            title="Expenses"
            icon="receipt-outline"
            style={styles.expenses_button}
            text_color={COLORS.text_dark}
            onPress={() => props.navigation.navigate('Expenses')}
          />
          {/* only shows for a signed-in account, not in the demo */}
          <LogoutButton />
        </View>
      </View>
    </View>
  );
}

export default DashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    padding: SPACING.lg,
  },

  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  options_container: {
    width: '100%',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },

  work_order_button: {
    backgroundColor: COLORS.success,
  },
  messages_button: {
    backgroundColor: COLORS.action,
  },
  documents_button: {
    backgroundColor: COLORS.surface_light,
  },
  checklist_button: {
    backgroundColor: COLORS.accent,
  },
  tenants_button: {
    backgroundColor: COLORS.title,
  },
  expenses_button: {
    backgroundColor: COLORS.highlight,
  },
  new_order_button: {
    backgroundColor: COLORS.danger,
  },
  unread_badge: {
    position: 'absolute',
    top: -8,
    right: 0,
  },
});

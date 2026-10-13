import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import LogoutButton from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/context/AuthContext';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { formatMoney } from '../../expenses/utils/expenseStats';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// stub for the assignment: the future home for account details, notification settings, the mileage rate,
// and Log Out (the old Log Out buttons on the homes still work, this is just the spot it moves to later)
function SettingsScreen(props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { demo_mode, mileage_rate } = useWorkOrders();
  // the demo has a side now, so the role comes from the demo while it runs and from the account otherwise
  const role = useAppRole();
  // owners and the demo get the mileage rate, tenants don't track mileage
  // (the tenant side of the demo is a tenant here too, so it skips it)
  const shows_mileage = role === 'owner';

  return (
    <ScrollView
      style={styles.container}
      // the first card has its own top margin, the demo banner needs the padding since it has none
      contentContainerStyle={{
        paddingTop: demo_mode ? SPACING.md : 0,
        paddingBottom: insets.bottom + SPACING.lg,
      }}
    >
      {/* only shows while the demo is running, it's the demo's way out */}
      <DemoBanner />

      <Card>
        <Text style={styles.heading}>Profile</Text>
        {user ? (
          <>
            <Text style={styles.body}>{user.name}</Text>
            <Text style={styles.detail}>{user.email}</Text>
            <Text style={styles.detail}>{user.role === 'tenant' ? 'Tenant' : 'Landlord'}</Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {role === 'tenant' ? demo_tenant.name : 'Demo landlord'}
            </Text>
            <Text style={styles.detail}>
              {role === 'tenant' ? 'Tenant (demo)' : 'Landlord (demo)'}
            </Text>
            <Text style={styles.detail}>Demo mode, no account. Nothing here is saved.</Text>
          </>
        )}
      </Card>

      {shows_mileage && (
        <Card>
          <Text style={styles.heading}>Mileage rate</Text>
          <Text style={styles.body}>{formatMoney(mileage_rate)} per mile</Text>
          <Text style={styles.detail}>You change it in the Mileage Log for now.</Text>
          <PrimaryButton
            title="Open Mileage Log"
            icon="car-outline"
            text_color={COLORS.text_light}
            onPress={() => props.navigation.navigate('Mileage')}
            style={styles.mileage_button}
          />
        </Card>
      )}

      <Card>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          Editing your name and email, changing your password, and picking which notifications you
          get.
        </Text>
      </Card>

      {/* only shows for a signed-in account */}
      <LogoutButton style={styles.logout_button} />
    </ScrollView>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  mileage_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.action,
  },
  logout_button: {
    width: '90%',
    alignSelf: 'center',
    marginHorizontal: 0,
  },
});

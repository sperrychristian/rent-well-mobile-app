import { Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import LogoutButton from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/context/AuthContext';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { SIZES, SPACING, TYPE } from '../../../theme';
import { formatCurrency } from '../../../utils/formatCurrency';
import ListRow from '../../../components/ui/ListRow';
import DemoTourSheet from '../../home/components/DemoTourSheet';
import { useDemoTour } from '../../home/hooks/useDemoTour';
import { themedStyles } from '../../../utils/themedStyles';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import { useTheme } from '../../../context/ThemeContext';

const appearance_choices = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

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
  // the demo tour opens again from here, it only means something while the demo runs
  const tour = useDemoTour(false);
  // Appearance is saved on this phone, so it stays the same before login, in the demo, and after logging out
  const theme = useTheme();

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

      <Card>
        <Text style={styles.heading}>Appearance</Text>
        <SegmentedControl
          label="Appearance"
          options={appearance_choices}
          value={theme.preference}
          onChange={theme.setPreference}
        />
        <Text style={styles.detail}>
          {theme.preference === 'system'
            ? "Follows your phone, it's " + (theme.is_dark ? 'dark' : 'light') + ' right now.'
            : 'Saved on this phone, for every account and the demo.'}
        </Text>
      </Card>

      {shows_mileage && (
        <Card>
          <Text style={styles.heading}>Mileage rate</Text>
          <Text style={styles.body}>{formatCurrency(mileage_rate)} per mile</Text>
          <Text style={styles.detail}>You change it in the Mileage Log for now.</Text>
          <PrimaryButton
            title="Open Mileage Log"
            icon="car-outline"
            variant="secondary"
            onPress={() => props.navigation.navigate('Mileage')}
            style={styles.mileage_button}
          />
        </Card>
      )}

      {demo_mode && (
        <ListRow
          icon="compass-outline"
          title="Take the tour"
          subtitle="Four things to try in the demo"
          onPress={tour.open}
          style={styles.tour_row}
        />
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
      <DemoTourSheet
        visible={tour.visible}
        role={role === 'tenant' ? 'tenant' : 'owner'}
        onClose={tour.close}
      />
    </ScrollView>
  );
}

export default SettingsScreen;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screen_padding,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    ...TYPE.body,
    color: COLORS.text,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  mileage_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm,
  },
  tour_row: {
    marginTop: SPACING.md,
  },
  logout_button: {
    width: '100%',
    alignSelf: 'center',
    marginHorizontal: 0,
  },
}));

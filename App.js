import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions, StyleSheet } from 'react-native';
import WelcomeScreen from './features/home/screens/WelcomeScreen';
import DemoChooserScreen from './features/home/screens/DemoChooserScreen';
import DashboardScreen from './features/home/screens/DashboardScreen';
import ChecklistScreen from './features/checklist/screens/ChecklistScreen';
import ChecklistDetailScreen from './features/checklist/screens/ChecklistDetailScreen';
import WorkOrdersScreen from './features/workOrders/screens/WorkOrdersScreen';
import MessagesScreen from './features/messages/screens/MessagesScreen';
import DocumentsScreen from './features/documents/screens/DocumentsScreen';
import ExpensesScreen from './features/expenses/screens/ExpensesScreen';
import { WorkOrdersProvider, useWorkOrders } from './context/WorkOrdersContext';
import WorkOrderDetailScreen from './features/workOrders/screens/WorkOrderDetailScreen';
import MileageScreen from './features/mileage/screens/MileageScreen';
import YearEndReportScreen from './features/expenses/screens/YearEndReportScreen';
import NewWorkOrderScreen from './features/workOrders/screens/NewWorkOrderScreen';
import TenantHomeScreen from './features/home/screens/TenantHomeScreen';
import LoginScreen from './features/auth/screens/LoginScreen';
import RegisterOwnerScreen from './features/auth/screens/RegisterOwnerScreen';
import RegisterTenantScreen from './features/auth/screens/RegisterTenantScreen';
import MessageThreadScreen from './features/messages/screens/MessageThreadScreen';
import InviteTenantScreen from './features/invites/screens/InviteTenantScreen';
import { AuthProvider, useAuth, homeRouteFor } from './features/auth/context/AuthContext';
import { MessagesProvider } from './features/messages/context/MessagesContext';
import { RemoteWorkOrdersProvider } from './features/workOrders/context/RemoteWorkOrdersProvider';
import MyRequestsScreen from './features/workOrders/screens/MyRequestsScreen';
import RequestDetailScreen from './features/workOrders/screens/RequestDetailScreen';
import { TenantsProvider } from './features/tenants/context/TenantsContext';
import { LedgerProvider } from './features/payments/context/LedgerContext';
import { ExpensesProvider } from './features/expenses/context/ExpensesContext';
import TenantsScreen from './features/tenants/screens/TenantsScreen';
import TenantDetailScreen from './features/tenants/screens/TenantDetailScreen';
import PropertiesScreen from './features/tenants/screens/PropertiesScreen';
import LeasesScreen from './features/leases/screens/LeasesScreen';
import ProfitScreen from './features/profit/screens/ProfitScreen';
import PastRequestsScreen from './features/tenants/screens/PastRequestsScreen';
import PaymentsScreen from './features/payments/screens/PaymentsScreen';
import PaymentDetailScreen from './features/payments/screens/PaymentDetailScreen';
import TenantLedgerScreen from './features/payments/screens/TenantLedgerScreen';
import { ToastProvider } from './components/ui/Toast';
import SettingsScreen from './features/settings/screens/SettingsScreen';
import PropertyDetailScreen from './features/tenants/screens/PropertyDetailScreen';
import TenantLeaseScreen from './features/tenants/screens/TenantLeaseScreen';
import { navigation_ref } from './services/navigationRef';
import {
  shared_screen_options,
  optionsFor,
  shared_tab_options,
  tabOptionsFor,
  shared_drawer_options,
  drawerOptionsFor,
} from './navigation/screenOptions';
import { hubRouter } from './navigation/hubRouter';
import { parentsOf, main_route, tabs_route } from './navigation/navigationMap';
import DrawerContent from './navigation/DrawerContent';
import { useTabBadges } from './navigation/tabBadges';
import { useAppRole } from './features/auth/hooks/useAppRole';
import { SIZES } from './theme';
import {
  SettingsHeaderButton,
  AddWorkOrderHeaderButton,
  InviteHeaderButton,
  AddRequestHeaderButton,
} from './navigation/headerButtons';
import { setupNotificationHandler } from './services/push';
import { StatusBar } from 'expo-status-bar';

import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';

// I make the stack once out here so every screen can be registered on it
const Stack = createNativeStackNavigator();
// and the drawer and the tab bar the same way, the root stack holds the drawer and the drawer holds the tabs
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

// set once at startup so a push that arrives while the app is open still shows a banner
setupNotificationHandler();

// the splash stays up until the fonts are ready, so the first screen never flashes in the wrong font
SplashScreen.preventAutoHideAsync().catch(() => {});

// the local data is saved per account, so it needs the signed-in user's id
function AccountData(props) {
  const { user } = useAuth();
  return (
    <WorkOrdersProvider user_id={user ? user.id : null}>
      {/* in real mode the work orders come from the server, demo and signed out keep the local ones */}
      <RemoteWorkOrdersProvider>
        <MessagesProvider>
          {/* tenants and properties: the demo's local copy, or the server's in real mode */}
          <TenantsProvider>
            {/* rent and payments: the demo's ledgers in memory, or the server's in real mode */}
            <LedgerProvider>
              {/* expenses: the server's for a real landlord, the phone's own everywhere else */}
              <ExpensesProvider>{props.children}</ExpensesProvider>
            </LedgerProvider>
          </TenantsProvider>
        </MessagesProvider>
      </RemoteWorkOrdersProvider>
    </WorkOrdersProvider>
  );
}

// the tab bar inside the drawer: the role's four daily places, from navigation/navigationMap.js (hubs)
// each one keeps the header title from the map and gets the menu button on the left (shared_tab_options)
// signed out shows both sides' tabs, but nobody sees that: login and the demo remount the navigator on their own side
function MainTabs() {
  const role = useAppRole();
  const shows_owner = role !== 'tenant';
  const shows_tenant = role !== 'owner';
  // the unread count on Messages, and the terracotta dots on Payments and Work Orders
  const badges = useTabBadges(shows_owner ? 'owner' : 'tenant');
  // the default bar is 49 and clipped the labels, so it's a little taller, plus the home indicator's space
  const insets = useSafeAreaInsets();
  const tab_options = {
    ...shared_tab_options,
    tabBarStyle: [shared_tab_options.tabBarStyle, { height: SIZES.tab_bar + insets.bottom }],
  };
  return (
    // back from any tab goes to the first one (the home), and back from the home leaves the app
    <Tab.Navigator
      initialRouteName={homeRouteFor({ role: role })}
      backBehavior="firstRoute"
      screenOptions={tab_options}
    >
      {shows_owner && (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={tabOptionsFor('Dashboard', null, {
            headerRight: () => <SettingsHeaderButton />,
          })}
        />
      )}
      {shows_tenant && (
        <Tab.Screen
          name="TenantHome"
          component={TenantHomeScreen}
          options={tabOptionsFor('TenantHome', null, {
            headerRight: () => <SettingsHeaderButton />,
          })}
        />
      )}
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={tabOptionsFor('Payments', badges.Payments)}
      />
      {shows_owner && (
        <Tab.Screen
          name="WorkOrders"
          component={WorkOrdersScreen}
          options={tabOptionsFor('WorkOrders', badges.WorkOrders, {
            headerRight: () => <AddWorkOrderHeaderButton />,
          })}
        />
      )}
      {shows_tenant && (
        <Tab.Screen
          name="MyRequests"
          component={MyRequestsScreen}
          options={tabOptionsFor('MyRequests', null, {
            headerRight: () => <AddRequestHeaderButton />,
          })}
        />
      )}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={tabOptionsFor('Messages', badges.Messages, {
          headerRight: () => <InviteHeaderButton />,
        })}
      />
    </Tab.Navigator>
  );
}

// the drawer holds the tabs as its first screen, then the sections you open now and then
// on an iPad (768 wide or more) it stays open on the side and the menu button hides
function MainDrawer() {
  const role = useAppRole();
  const shows_owner = role !== 'tenant';
  const shows_tenant = role !== 'owner';
  const { width } = useWindowDimensions();
  const is_wide = width >= SIZES.wide_layout;
  return (
    // history: back from a section goes to wherever you were before it (the menu cuts that back to the tabs)
    <Drawer.Navigator
      initialRouteName={tabs_route}
      backBehavior="history"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ ...shared_drawer_options, drawerType: is_wide ? 'permanent' : 'front' }}
    >
      {/* the tabs draw their own headers, so the drawer's header stays off here (one header per screen) */}
      <Drawer.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />

      {/* owner sections, left out for tenants */}
      {shows_owner && (
        <Drawer.Group>
          <Drawer.Screen
            name="Properties"
            component={PropertiesScreen}
            options={drawerOptionsFor('Properties')}
          />
          <Drawer.Screen
            name="Tenants"
            component={TenantsScreen}
            options={drawerOptionsFor('Tenants', { headerRight: () => <InviteHeaderButton /> })}
          />
          <Drawer.Screen
            name="Leases"
            component={LeasesScreen}
            options={drawerOptionsFor('Leases')}
          />
          <Drawer.Screen
            name="Expenses"
            component={ExpensesScreen}
            options={drawerOptionsFor('Expenses')}
          />
          <Drawer.Screen
            name="Mileage"
            component={MileageScreen}
            options={drawerOptionsFor('Mileage')}
          />
          <Drawer.Screen
            name="Profit"
            component={ProfitScreen}
            options={drawerOptionsFor('Profit')}
          />
          <Drawer.Screen
            name="Documents"
            component={DocumentsScreen}
            options={drawerOptionsFor('Documents')}
          />
          <Drawer.Screen
            name="Checklist"
            component={ChecklistScreen}
            options={drawerOptionsFor('Checklist')}
          />
        </Drawer.Group>
      )}

      {/* tenant sections, left out for owners */}
      {shows_tenant && (
        <Drawer.Group>
          <Drawer.Screen
            name="PastRequests"
            component={PastRequestsScreen}
            options={drawerOptionsFor('PastRequests')}
          />
        </Drawer.Group>
      )}

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={drawerOptionsFor('Settings')}
      />
    </Drawer.Navigator>
  );
}

// waits for the saved session, then starts on the right home for a signed-in account or on Welcome
// the providers above start fresh (and remount this) whenever the mode or account changes,
// so the first screen has to match the mode: the demo's dashboard, a role's home, or Login after a session ran out
function AppNavigator() {
  const { status, user, session_expired } = useAuth();
  const { demo_mode, demo_role } = useWorkOrders();
  const role = useAppRole();
  if (status === 'restoring') {
    return null;
  }
  let first_route = 'Welcome';
  if (user) {
    first_route = homeRouteFor(user);
  } else if (demo_mode) {
    // the demo opens on the home of the side picked in the chooser (or switched to from the banner)
    first_route = homeRouteFor({ role: demo_role });
  } else if (session_expired) {
    first_route = 'Login';
  }
  // the homes are tabs inside Main now, so the root stack starts on Main and the tabs pick the home
  const root_first_route = parentsOf(first_route).length > 0 ? main_route : first_route;
  // the demo only registers its own side's screens, so the tenant demo can't open an owner screen even by name
  // (and the landlord demo can't open a tenant one), signed in and signed out keep every screen like before
  // with the tabs a signed-in account gets its own side too (its tab bar and drawer are only its role's),
  // signed out still registers both so a login can reset straight to either home
  const shows_owner = role !== 'tenant';
  const shows_tenant = role !== 'owner';
  // a new key starts the navigator over, so switching demo sides rebuilds the stack on that side's home
  // the role is in it for real accounts too, so logging in as the other role never keeps the old tabs
  const navigator_key = demo_mode ? 'demo-' + demo_role : 'app-' + (role || 'signed-out');

  return (
    <NavigationContainer key={navigator_key} ref={navigation_ref}>
      {/* I'm hiding the default header since my screens have their own title */}
      {/* that changed for the navigation assignment: every screen gets a header with one shared style now, */}
      {/* the titles come from navigation/navigationMap.js, and the ScreenTitle card stays as the big title */}
      {/* later the card came off every screen but the two homes, since it only repeated the header */}
      {/* the tabs and drawer pass: the root stack holds the signed-out screens, Main (the drawer with the tabs */}
      {/* inside it), and every detail screen, so a detail pushes over the tab bar and back returns to the tab */}
      {/* hubRouter lets a detail screen or a push tap still say navigate('Payments') and land in the right tab */}
      <Stack.Navigator
        initialRouteName={root_first_route}
        screenOptions={shared_screen_options}
        UNSTABLE_router={hubRouter}
      >
        {/* first screen listed is the one that shows on launch */}
        {/* (initialRouteName above picks the real first screen from the saved session and the mode) */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={optionsFor('Welcome')} />
        <Stack.Screen name="Login" component={LoginScreen} options={optionsFor('Login')} />
        <Stack.Screen
          name="RegisterOwner"
          component={RegisterOwnerScreen}
          options={optionsFor('RegisterOwner')}
        />
        <Stack.Screen
          name="RegisterTenant"
          component={RegisterTenantScreen}
          options={optionsFor('RegisterTenant')}
        />
        <Stack.Screen
          name="DemoChooser"
          component={DemoChooserScreen}
          options={optionsFor('DemoChooser')}
        />

        {/* the drawer and the tabs, they draw their own headers so the stack's is off (one header per screen) */}
        <Stack.Screen name="Main" component={MainDrawer} options={{ headerShown: false }} />

        {/* owner screens, left out in the tenant demo */}
        {/* (the owner's tabs and drawer sections moved into MainTabs and MainDrawer, these are the details) */}
        {shows_owner && (
          <Stack.Group>
            <Stack.Screen
              name="WorkOrderDetail"
              component={WorkOrderDetailScreen}
              options={optionsFor('WorkOrderDetail')}
            />
            <Stack.Screen
              name="TenantDetail"
              component={TenantDetailScreen}
              options={optionsFor('TenantDetail')}
            />
            <Stack.Screen
              name="TenantLease"
              component={TenantLeaseScreen}
              options={optionsFor('TenantLease')}
            />
            <Stack.Screen
              name="PropertyDetail"
              component={PropertyDetailScreen}
              options={optionsFor('PropertyDetail')}
            />
            {/* one tenancy's rent ledger, the header's add button is set by the screen since the form lives there */}
            <Stack.Screen
              name="TenantLedger"
              component={TenantLedgerScreen}
              options={optionsFor('TenantLedger')}
            />
            <Stack.Screen
              name="InviteTenant"
              component={InviteTenantScreen}
              options={optionsFor('InviteTenant')}
            />
            <Stack.Screen
              name="ChecklistDetail"
              component={ChecklistDetailScreen}
              options={optionsFor('ChecklistDetail')}
            />
            <Stack.Screen
              name="YearEndReport"
              component={YearEndReportScreen}
              options={optionsFor('YearEndReport')}
            />
          </Stack.Group>
        )}

        {/* tenant screens, left out in the landlord demo */}
        {shows_tenant && (
          <Stack.Group>
            <Stack.Screen
              name="RequestDetail"
              component={RequestDetailScreen}
              options={optionsFor('RequestDetail')}
            />
          </Stack.Group>
        )}

        <Stack.Screen
          name="NewWorkOrder"
          component={NewWorkOrderScreen}
          options={optionsFor('NewWorkOrder')}
        />
        <Stack.Screen
          name="MessageThread"
          component={MessageThreadScreen}
          options={optionsFor('MessageThread')}
        />
        <Stack.Screen
          name="PaymentDetail"
          component={PaymentDetailScreen}
          options={optionsFor('PaymentDetail')}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // load the fonts first and show nothing until they're ready
  // the Hearth pass: Fraunces for the big moments and DM Sans for the rest, and if they fail to load
  // the app still opens and the system font fills in for any family it doesn't have
  const [fonts_loaded, fonts_error] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });
  const fonts_done = fonts_loaded || !!fonts_error;

  useEffect(() => {
    if (fonts_error) {
      console.log('Fonts did not load, using the system font', fonts_error.message);
    }
    if (fonts_done) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fonts_done, fonts_error]);

  if (!fonts_done) {
    return null;
  }

  return (
    // the drawer's swipe needs the gesture handler's root around everything
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        {/* light clock and battery icons, the app is navy */}
        {/* the fintech pass made the app light again, so the clock and battery are dark now */}
        <StatusBar style="dark" />
        <AccountData>
          {/* toasts sit above every screen so one still shows after its form closes */}
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </AccountData>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

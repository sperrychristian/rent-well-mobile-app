import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import TenantsScreen from './features/tenants/screens/TenantsScreen';
import TenantDetailScreen from './features/tenants/screens/TenantDetailScreen';
import PropertiesScreen from './features/tenants/screens/PropertiesScreen';
import PastRequestsScreen from './features/tenants/screens/PastRequestsScreen';
import PaymentsScreen from './features/payments/screens/PaymentsScreen';
import PaymentDetailScreen from './features/payments/screens/PaymentDetailScreen';
import SettingsScreen from './features/settings/screens/SettingsScreen';
import PropertyDetailScreen from './features/tenants/screens/PropertyDetailScreen';
import TenantLeaseScreen from './features/tenants/screens/TenantLeaseScreen';
import { navigation_ref } from './services/navigationRef';
import { shared_screen_options, optionsFor } from './navigation/screenOptions';
import {
  SettingsHeaderButton,
  AddWorkOrderHeaderButton,
  InviteHeaderButton,
  AddRequestHeaderButton,
} from './navigation/headerButtons';
import { setupNotificationHandler } from './services/push';
import { StatusBar } from 'expo-status-bar';

import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// I make the stack once out here so every screen can be registered on it
const Stack = createNativeStackNavigator();

// set once at startup so a push that arrives while the app is open still shows a banner
setupNotificationHandler();

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
            <LedgerProvider>{props.children}</LedgerProvider>
          </TenantsProvider>
        </MessagesProvider>
      </RemoteWorkOrdersProvider>
    </WorkOrdersProvider>
  );
}

// waits for the saved session, then starts on the right home for a signed-in account or on Welcome
// the providers above start fresh (and remount this) whenever the mode or account changes,
// so the first screen has to match the mode: the demo's dashboard, a role's home, or Login after a session ran out
function AppNavigator() {
  const { status, user, session_expired } = useAuth();
  const { demo_mode, demo_role } = useWorkOrders();
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
  // the demo only registers its own side's screens, so the tenant demo can't open an owner screen even by name
  // (and the landlord demo can't open a tenant one), signed in and signed out keep every screen like before
  const shows_owner = !demo_mode || demo_role === 'owner';
  const shows_tenant = !demo_mode || demo_role === 'tenant';
  // a new key starts the navigator over, so switching demo sides rebuilds the stack on that side's home
  const navigator_key = demo_mode ? 'demo-' + demo_role : 'app';

  return (
    <NavigationContainer key={navigator_key} ref={navigation_ref}>
      {/* I'm hiding the default header since my screens have their own title */}
      {/* that changed for the navigation assignment: every screen gets a header with one shared style now, */}
      {/* the titles come from navigation/navigationMap.js, and the ScreenTitle card stays as the big title */}
      {/* later the card came off every screen but the two homes, since it only repeated the header */}
      <Stack.Navigator initialRouteName={first_route} screenOptions={shared_screen_options}>
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

        {/* owner screens, left out in the tenant demo */}
        {shows_owner && (
          <Stack.Group>
            {/* this name has to match navigate('Dashboard') exactly */}
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={optionsFor('Dashboard', { headerRight: () => <SettingsHeaderButton /> })}
            />
            <Stack.Screen
              name="WorkOrders"
              component={WorkOrdersScreen}
              options={optionsFor('WorkOrders', {
                headerRight: () => <AddWorkOrderHeaderButton />,
              })}
            />
            <Stack.Screen
              name="WorkOrderDetail"
              component={WorkOrderDetailScreen}
              options={optionsFor('WorkOrderDetail')}
            />
            <Stack.Screen
              name="Tenants"
              component={TenantsScreen}
              options={optionsFor('Tenants', { headerRight: () => <InviteHeaderButton /> })}
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
              name="Properties"
              component={PropertiesScreen}
              options={optionsFor('Properties')}
            />
            <Stack.Screen
              name="PropertyDetail"
              component={PropertyDetailScreen}
              options={optionsFor('PropertyDetail')}
            />
            <Stack.Screen
              name="InviteTenant"
              component={InviteTenantScreen}
              options={optionsFor('InviteTenant')}
            />
            <Stack.Screen
              name="Documents"
              component={DocumentsScreen}
              options={optionsFor('Documents')}
            />
            <Stack.Screen
              name="Checklist"
              component={ChecklistScreen}
              options={optionsFor('Checklist')}
            />
            <Stack.Screen
              name="ChecklistDetail"
              component={ChecklistDetailScreen}
              options={optionsFor('ChecklistDetail')}
            />
            <Stack.Screen
              name="Expenses"
              component={ExpensesScreen}
              options={optionsFor('Expenses')}
            />
            <Stack.Screen
              name="Mileage"
              component={MileageScreen}
              options={optionsFor('Mileage')}
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
              name="TenantHome"
              component={TenantHomeScreen}
              options={optionsFor('TenantHome', { headerRight: () => <SettingsHeaderButton /> })}
            />
            <Stack.Screen
              name="MyRequests"
              component={MyRequestsScreen}
              options={optionsFor('MyRequests', { headerRight: () => <AddRequestHeaderButton /> })}
            />
            <Stack.Screen
              name="RequestDetail"
              component={RequestDetailScreen}
              options={optionsFor('RequestDetail')}
            />
            <Stack.Screen
              name="PastRequests"
              component={PastRequestsScreen}
              options={optionsFor('PastRequests')}
            />
          </Stack.Group>
        )}

        <Stack.Screen
          name="NewWorkOrder"
          component={NewWorkOrderScreen}
          options={optionsFor('NewWorkOrder')}
        />
        <Stack.Screen
          name="Messages"
          component={MessagesScreen}
          options={optionsFor('Messages', { headerRight: () => <InviteHeaderButton /> })}
        />
        <Stack.Screen
          name="MessageThread"
          component={MessageThreadScreen}
          options={optionsFor('MessageThread')}
        />
        <Stack.Screen name="Payments" component={PaymentsScreen} options={optionsFor('Payments')} />
        <Stack.Screen
          name="PaymentDetail"
          component={PaymentDetailScreen}
          options={optionsFor('PaymentDetail')}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={optionsFor('Settings')} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // load the fonts first and show nothing until they're ready
  const [fonts_loaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fonts_loaded) {
    return null;
  }

  return (
    <AuthProvider>
      {/* light clock and battery icons, the app is navy */}
      {/* the fintech pass made the app light again, so the clock and battery are dark now */}
      <StatusBar style="dark" />
      <AccountData>
        <AppNavigator />
      </AccountData>
    </AuthProvider>
  );
}

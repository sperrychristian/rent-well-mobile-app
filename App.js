import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './features/home/screens/WelcomeScreen';
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
import { navigation_ref } from './services/navigationRef';
import { setupNotificationHandler } from './services/push';

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
        <MessagesProvider>{props.children}</MessagesProvider>
      </RemoteWorkOrdersProvider>
    </WorkOrdersProvider>
  );
}

// waits for the saved session, then starts on the right home for a signed-in account or on Welcome
// the providers above start fresh (and remount this) whenever the mode or account changes,
// so the first screen has to match the mode: the demo's dashboard, a role's home, or Login after a session ran out
function AppNavigator() {
  const { status, user, session_expired } = useAuth();
  const { demo_mode } = useWorkOrders();
  if (status === 'restoring') {
    return null;
  }
  let first_route = 'Welcome';
  if (user) {
    first_route = homeRouteFor(user);
  } else if (demo_mode) {
    first_route = 'Dashboard';
  } else if (session_expired) {
    first_route = 'Login';
  }

  return (
    <NavigationContainer ref={navigation_ref}>
      {/* I'm hiding the default header since my screens have their own title */}
      <Stack.Navigator initialRouteName={first_route} screenOptions={{ headerShown: false }}>
        {/* first screen listed is the one that shows on launch */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        {/* this name has to match navigate('Dashboard') exactly */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="TenantHome" component={TenantHomeScreen} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          initialParams={session_expired ? { expired: true } : undefined}
        />
        <Stack.Screen name="RegisterOwner" component={RegisterOwnerScreen} />
        <Stack.Screen name="RegisterTenant" component={RegisterTenantScreen} />
        <Stack.Screen name="WorkOrders" component={WorkOrdersScreen} />
        <Stack.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} />
        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="MessageThread" component={MessageThreadScreen} />
        <Stack.Screen name="InviteTenant" component={InviteTenantScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="Checklist" component={ChecklistScreen} />
        <Stack.Screen name="ChecklistDetail" component={ChecklistDetailScreen} />
        <Stack.Screen name="Expenses" component={ExpensesScreen} />
        <Stack.Screen name="Mileage" component={MileageScreen} />
        <Stack.Screen name="YearEndReport" component={YearEndReportScreen} />
        <Stack.Screen name="NewWorkOrder" component={NewWorkOrderScreen} />
        <Stack.Screen name="MyRequests" component={MyRequestsScreen} />
        <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
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
      <AccountData>
        <AppNavigator />
      </AccountData>
    </AuthProvider>
  );
}

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './features/home/screens/WelcomeScreen';
import DashboardScreen from './features/home/screens/DashboardScreen';
import ChecklistScreen from './features/checklist/screens/ChecklistScreen';
import WorkOrdersScreen from './features/workOrders/screens/WorkOrdersScreen';
import MessagesScreen from './features/messages/screens/MessagesScreen';
import DocumentsScreen from './features/documents/screens/DocumentsScreen';
import ExpensesScreen from './features/expenses/screens/ExpensesScreen';
import { WorkOrdersProvider } from './context/WorkOrdersContext';
import WorkOrderDetailScreen from './features/workOrders/screens/WorkOrderDetailScreen';
import MileageScreen from './features/mileage/screens/MileageScreen';
import YearEndReportScreen from './features/expenses/screens/YearEndReportScreen';
import NewWorkOrderScreen from './features/workOrders/screens/NewWorkOrderScreen';

import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// I make the stack once out here so every screen can be registered on it
const Stack = createNativeStackNavigator();

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
    <WorkOrdersProvider>
      <NavigationContainer>
        {/* I'm hiding the default header since my screens have their own title */}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* first screen listed is the one that shows on launch */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          {/* this name has to match navigate('Dashboard') exactly */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="WorkOrders" component={WorkOrdersScreen} />
          <Stack.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Documents" component={DocumentsScreen} />
          <Stack.Screen name="Checklist" component={ChecklistScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="Mileage" component={MileageScreen} />
          <Stack.Screen name="YearEndReport" component={YearEndReportScreen} />
          <Stack.Screen name="NewWorkOrder" component={NewWorkOrderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </WorkOrdersProvider>
  );
}

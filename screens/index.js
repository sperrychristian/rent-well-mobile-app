// every screen in the app in one place, for the navigation assignment's "screens folder" rule
// the files themselves stay in their feature folders (features/<feature>/screens/), this only re-exports them,
// so nothing that imports a screen had to change. App.js still imports from the feature folders directly

export { default as ChecklistDetailScreen } from '../features/checklist/screens/ChecklistDetailScreen';
export { default as ChecklistScreen } from '../features/checklist/screens/ChecklistScreen';
export { default as DashboardScreen } from '../features/home/screens/DashboardScreen';
export { default as DemoChooserScreen } from '../features/home/screens/DemoChooserScreen';
export { default as DocumentsScreen } from '../features/documents/screens/DocumentsScreen';
export { default as ExpensesScreen } from '../features/expenses/screens/ExpensesScreen';
export { default as InviteTenantScreen } from '../features/invites/screens/InviteTenantScreen';
export { default as LeasesScreen } from '../features/leases/screens/LeasesScreen';
export { default as LoginScreen } from '../features/auth/screens/LoginScreen';
export { default as MessageThreadScreen } from '../features/messages/screens/MessageThreadScreen';
export { default as MessagesScreen } from '../features/messages/screens/MessagesScreen';
export { default as MileageScreen } from '../features/mileage/screens/MileageScreen';
export { default as MyRequestsScreen } from '../features/workOrders/screens/MyRequestsScreen';
export { default as NewWorkOrderScreen } from '../features/workOrders/screens/NewWorkOrderScreen';
export { default as PastRequestsScreen } from '../features/tenants/screens/PastRequestsScreen';
export { default as PaymentDetailScreen } from '../features/payments/screens/PaymentDetailScreen';
export { default as PaymentsScreen } from '../features/payments/screens/PaymentsScreen';
export { default as ProfitScreen } from '../features/profit/screens/ProfitScreen';
export { default as PropertiesScreen } from '../features/tenants/screens/PropertiesScreen';
export { default as PropertyDetailScreen } from '../features/tenants/screens/PropertyDetailScreen';
export { default as RegisterOwnerScreen } from '../features/auth/screens/RegisterOwnerScreen';
export { default as RegisterTenantScreen } from '../features/auth/screens/RegisterTenantScreen';
export { default as RequestDetailScreen } from '../features/workOrders/screens/RequestDetailScreen';
export { default as SearchScreen } from '../features/search/screens/SearchScreen';
export { default as SettingsScreen } from '../features/settings/screens/SettingsScreen';
export { default as TenantDetailScreen } from '../features/tenants/screens/TenantDetailScreen';
export { default as TenantHomeScreen } from '../features/home/screens/TenantHomeScreen';
export { default as TenantLeaseScreen } from '../features/tenants/screens/TenantLeaseScreen';
export { default as TenantLedgerScreen } from '../features/payments/screens/TenantLedgerScreen';
export { default as TenantsScreen } from '../features/tenants/screens/TenantsScreen';
export { default as WelcomeScreen } from '../features/home/screens/WelcomeScreen';
export { default as WorkOrderDetailScreen } from '../features/workOrders/screens/WorkOrderDetailScreen';
export { default as WorkOrdersScreen } from '../features/workOrders/screens/WorkOrdersScreen';
export { default as YearEndReportScreen } from '../features/expenses/screens/YearEndReportScreen';

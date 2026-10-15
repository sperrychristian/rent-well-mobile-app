# Design audit (fintech pass)

Phase 0 of the fintech restyle on branch `fintech-polish`. Made by grepping the source on the starting point (`design-polish`), before any change. Each section ends with what the pass does about it.

## Screens (30)

- `features/auth/screens/LoginScreen.js`
- `features/auth/screens/RegisterOwnerScreen.js`
- `features/auth/screens/RegisterTenantScreen.js`
- `features/checklist/screens/ChecklistDetailScreen.js`
- `features/checklist/screens/ChecklistScreen.js`
- `features/documents/screens/DocumentsScreen.js`
- `features/expenses/screens/ExpensesScreen.js`
- `features/expenses/screens/YearEndReportScreen.js`
- `features/home/screens/DashboardScreen.js`
- `features/home/screens/DemoChooserScreen.js`
- `features/home/screens/TenantHomeScreen.js`
- `features/home/screens/WelcomeScreen.js`
- `features/invites/screens/InviteTenantScreen.js`
- `features/messages/screens/MessageThreadScreen.js`
- `features/messages/screens/MessagesScreen.js`
- `features/mileage/screens/MileageScreen.js`
- `features/payments/screens/PaymentDetailScreen.js`
- `features/payments/screens/PaymentsScreen.js`
- `features/settings/screens/SettingsScreen.js`
- `features/tenants/screens/PastRequestsScreen.js`
- `features/tenants/screens/PropertiesScreen.js`
- `features/tenants/screens/PropertyDetailScreen.js`
- `features/tenants/screens/TenantDetailScreen.js`
- `features/tenants/screens/TenantLeaseScreen.js`
- `features/tenants/screens/TenantsScreen.js`
- `features/workOrders/screens/MyRequestsScreen.js`
- `features/workOrders/screens/NewWorkOrderScreen.js`
- `features/workOrders/screens/RequestDetailScreen.js`
- `features/workOrders/screens/WorkOrderDetailScreen.js`
- `features/workOrders/screens/WorkOrdersScreen.js`

## Modals and sheets (15)

- `features/checklist/components/ChecklistItemModal.js`
- `features/checklist/components/NameModal.js`
- `features/checklist/components/NewChecklistModal.js`
- `features/checklist/components/SignOffModal.js`
- `features/documents/components/DocumentDetailModal.js`
- `features/documents/components/DocumentFormModal.js`
- `features/expenses/components/AddExpenseModal.js`
- `features/expenses/components/BudgetsModal.js`
- `features/expenses/components/ExpenseDetailsModal.js`
- `features/expenses/components/RecurringModal.js`
- `features/messages/components/ImageViewerModal.js`
- `features/mileage/components/TripModal.js`
- `features/tenants/components/EndTenancyModal.js`
- `features/tenants/components/PlaceModal.js`
- `features/tenants/components/PropertyFormModal.js`

Shared pieces that draw on every screen: `components/DemoBanner.js`, `components/ScreenTitle.js`, `components/Card.js`, `components/PrimaryButton.js`, `components/TextField.js`, `components/DateField.js`, `components/ErrorState.js`, `components/HeaderIconButton.js`, `navigation/screenOptions.js`, everything in `components/ui/`.

**Plan:** restyle the shared pieces first (tokens, `components/ui`, `listStyles.js`, `sheet.js`), then walk every file above.

## Places that assume the dark navy theme

- `App.js:48` import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
- `App.js:277` PixelifySans_700Bold,
- `App.js:287` <StatusBar style="light" />
- `app.json:8` "userInterfaceStyle": "dark",
- `components/DateField.js:30` themeVariant="dark"
- `components/DateField.js:31` accentColor={COLORS.cta}
- `components/DateField.js:63` backgroundColor: COLORS.surface_sunken,
- `components/ScreenTitle.js:74` borderBottomColor: COLORS.cta,
- `components/TextField.js:17` keyboardAppearance="dark"
- `components/TextField.js:60` backgroundColor: COLORS.surface_sunken,
- `components/TextField.js:69` borderColor: COLORS.focus,
- `components/ui/Badge.js:41` backgroundColor: COLORS.cta,
- `components/ui/Badge.js:50` color: COLORS.on_cta,
- `components/ui/Button.js:11` primary: { fill: COLORS.cta, text: COLORS.on_cta, border: 'transparent' },
- `components/ui/PixelGridBackground.js:20` function PixelGridBackground(props) {
- `components/ui/PixelGridBackground.js:42` stroke={COLORS.grid_line}
- `components/ui/PixelGridBackground.js:55` fill={COLORS.grid_line}
- `components/ui/PixelGridBackground.js:64` export default PixelGridBackground;
- `components/ui/Wordmark.js:45` fontFamily: FONTS.wordmark,
- `components/ui/Wordmark.js:52` color: COLORS.cta,
- `components/ui/listStyles.js:70` color: COLORS.on_light,
- `components/ui/listStyles.js:83` backgroundColor: COLORS.surface_sunken,
- `components/ui/sheet.js:55` backgroundColor: COLORS.surface_sunken,
- `components/ui/uiHelpers.js:10` 'In Progress': { fill: COLORS.warning, text: COLORS.on_light, icon: 'time' },
- `components/ui/uiHelpers.js:19` 'Pending': { fill: COLORS.warning, text: COLORS.on_light, icon: 'hourglass' },
- `components/ui/uiHelpers.js:25` 'In progress': { fill: COLORS.warning, text: COLORS.on_light, icon: 'time' },
- `components/ui/uiHelpers.js:28` 'Fair': { fill: COLORS.warning, text: COLORS.on_light, icon: 'remove-circle' },
- `components/ui/uiHelpers.js:33` 'Due': { fill: COLORS.warning, text: COLORS.on_light, icon: 'calendar' },
- `components/ui/uiHelpers.js:39` 'Demo': { fill: COLORS.warning, text: COLORS.on_light, icon: 'play-circle' },
- `features/checklist/components/ChecklistItemModal.js:399` backgroundColor: COLORS.surface_sunken,
- `features/checklist/components/ChecklistItemModal.js:505` color: COLORS.on_light,
- `features/checklist/components/ProgressBar.js:25` backgroundColor: COLORS.surface_sunken,
- `features/documents/components/DocumentDetailModal.js:227` color: COLORS.on_light,
- `features/documents/components/DocumentFormModal.js:328` backgroundColor: COLORS.surface_sunken,
- `features/documents/screens/DocumentsScreen.js:304` keyboardAppearance="dark"
- `features/documents/screens/DocumentsScreen.js:455` color: COLORS.cta,
- `features/documents/screens/DocumentsScreen.js:535` color: COLORS.on_light,
- `features/expenses/components/ExpenseDetailsModal.js:90` color: COLORS.cta,
- `features/expenses/components/RecurringModal.js:95` backgroundColor: COLORS.surface_sunken,
- `features/expenses/screens/ExpensesScreen.js:759` color: COLORS.cta,
- `features/expenses/screens/ExpensesScreen.js:790` backgroundColor: COLORS.surface_sunken,
- `features/expenses/screens/ExpensesScreen.js:796` backgroundColor: COLORS.cta,
- `features/expenses/screens/ExpensesScreen.js:919` color: COLORS.cta,
- `features/expenses/screens/YearEndReportScreen.js:211` color: COLORS.cta,
- `features/home/screens/DashboardScreen.js:84` fill={COLORS.cta}
- `features/home/screens/DashboardScreen.js:85` icon_color={COLORS.on_cta}
- `features/home/screens/DashboardScreen.js:143` icon_color={COLORS.on_light}
- `features/home/screens/TenantHomeScreen.js:176` fill={COLORS.cta}
- `features/home/screens/TenantHomeScreen.js:177` icon_color={COLORS.on_cta}
- `features/home/screens/WelcomeScreen.js:7` import PixelGridBackground from '../../../components/ui/PixelGridBackground';
- `features/home/screens/WelcomeScreen.js:21` <PixelGridBackground />
- `features/invites/screens/InviteTenantScreen.js:356` color: COLORS.cta,
- `features/invites/screens/InviteTenantScreen.js:357` backgroundColor: COLORS.surface_sunken,
- `features/invites/screens/InviteTenantScreen.js:437` color: COLORS.cta,
- `features/messages/components/ConversationRow.js:121` borderLeftColor: COLORS.cta,
- `features/messages/screens/MessageThreadScreen.js:329` keyboardAppearance="dark"
- `features/messages/screens/MessageThreadScreen.js:419` color: COLORS.on_light,
- `features/mileage/screens/MileageScreen.js:146` keyboardAppearance="dark"
- `features/mileage/screens/MileageScreen.js:254` color: COLORS.cta,
- `features/payments/screens/PaymentDetailScreen.js:53` color: COLORS.cta,
- `features/tenants/screens/TenantsScreen.js:180` <Ionicons name="construct-outline" size={12} color={COLORS.on_light} />
- `features/tenants/screens/TenantsScreen.js:439` color: COLORS.on_light,
- `features/workOrders/screens/WorkOrdersScreen.js:182` keyboardAppearance="dark"
- `theme.js:129` wordmark: 'PixelifySans_700Bold',

Also by value rather than name: every `COLORS.title`, `COLORS.text`, and `COLORS.text_muted` is a light color today, `surface_sunken` is darker than cards, shadows are heavy (`SHADOWS.medium` on every card), and the status bar and keyboards are set to dark.

**Plan:** flip the token values to the light palette (ink text, white cards on cool gray), swap the amber `cta` for an indigo brand primary with white text, make `surface_sunken` a light gray input fill, set keyboards and the date picker to light, the status bar to dark, `userInterfaceStyle` to light, drop the pixel font and the pixel grid, and lighten the shadows to hairline borders.

## Hardcoded numbers in styles that should be tokens

- `components/DemoBanner.js`: 86 `marginHorizontal: 0,`; 90 `marginHorizontal: 0,`
- `components/ErrorState.js`: 39 `width: 64,`; 40 `height: 64,`; 62 `minWidth: 160,`
- `components/RemoteImage.js`: 98 `borderRadius: 8,`; 107 `fontSize: 11,`; 108 `marginTop: 2,`
- `components/ScreenTitle.js`: 84 `letterSpacing: 0.5,`
- `components/ui/Badge.js`: 27 `minWidth: 22,`; 28 `minHeight: 22,`; 46 `fontSize: 12,`; 47 `lineHeight: 16,`
- `components/ui/Button.js`: 118 `fontSize: 14,`; 119 `lineHeight: 20,`
- `components/ui/FeatureTile.js`: 38 `minHeight: 120,`
- `components/ui/SectionHeader.js`: 44 `letterSpacing: 0.8,`
- `components/ui/Skeleton.js`: 67 `width: 40,`; 68 `height: 40,`; 77 `height: 12,`
- `components/ui/StatusPill.js`: 41 `fontSize: 12,`; 42 `lineHeight: 16,`
- `components/ui/Wordmark.js`: 47 `letterSpacing: 1,`
- `components/ui/sheet.js`: 41 `width: 40,`; 42 `height: 5,`
- `features/auth/components/SubmitButton.js`: 33 `marginHorizontal: 0,`
- `features/checklist/components/ChecklistItemModal.js`: 371 `marginBottom: 6,`; 383 `gap: 4,`; 384 `paddingVertical: 3,`; 410 `marginBottom: 2,`; 425 `marginBottom: 0,`; 435 `paddingVertical: 6,`; 450 `minHeight: 70,`; 458 `width: 72,`; 459 `height: 72,`; 465 `top: -8,`; 466 `right: -8,`; 475 `marginHorizontal: 0,`; 479 `marginHorizontal: 0,`; 483 `marginHorizontal: 0,`; 486 `marginHorizontal: 0,`
- `features/checklist/components/NameModal.js`: 96 `marginHorizontal: 0,`; 100 `marginHorizontal: 0,`
- `features/checklist/components/NewChecklistModal.js`: 214 `marginBottom: 6,`; 242 `paddingVertical: 6,`; 258 `marginHorizontal: 0,`; 262 `marginHorizontal: 0,`
- `features/checklist/components/SignOffModal.js`: 123 `marginBottom: 6,`; 142 `marginHorizontal: 0,`; 146 `marginHorizontal: 0,`
- `features/checklist/screens/ChecklistDetailScreen.js`: 393 `marginBottom: 2,`; 416 `gap: 6,`; 417 `marginTop: 6,`; 501 `fontSize: 14,`; 509 `marginHorizontal: 0,`; 512 `marginHorizontal: 0,`; 515 `marginHorizontal: 0,`; 518 `marginHorizontal: 0,`; 521 `marginHorizontal: 0,`
- `features/checklist/screens/ChecklistScreen.js`: 187 `marginHorizontal: 0,`; 226 `marginTop: 2,`; 235 `marginTop: 6,`; 247 `gap: 6,`; 248 `marginTop: 6,`
- `features/documents/components/DocumentDetailModal.js`: 161 `gap: 6,`; 167 `paddingVertical: 3,`; 184 `fontSize: 11,`; 185 `lineHeight: 15,`; 192 `height: 220,`; 211 `marginHorizontal: 0,`; 215 `marginHorizontal: 0,`; 219 `marginHorizontal: 0,`; 223 `marginHorizontal: 0,`
- `features/documents/components/DocumentFormModal.js`: 316 `marginBottom: 6,`; 344 `fontSize: 14,`; 347 `marginHorizontal: 0,`; 348 `marginBottom: 6,`; 356 `minHeight: 70,`; 375 `paddingVertical: 6,`; 394 `marginBottom: 0,`; 403 `marginHorizontal: 0,`; 407 `marginHorizontal: 0,`
- `features/documents/screens/DocumentsScreen.js`: 426 `marginHorizontal: 0,`; 430 `marginHorizontal: 0,`; 435 `marginBottom: 6,`; 456 `marginVertical: 4,`; 501 `marginTop: 2,`; 506 `gap: 6,`; 507 `marginTop: 6,`; 511 `paddingVertical: 3,`; 525 `fontSize: 11,`; 526 `lineHeight: 15,`
- `features/expenses/components/AddExpenseModal.js`: 464 `marginBottom: 6,`; 488 `minHeight: 70,`; 503 `paddingVertical: 6,`; 528 `width: 72,`; 529 `height: 72,`; 535 `top: -8,`; 536 `right: -8,`; 545 `marginHorizontal: 0,`; 549 `marginHorizontal: 0,`; 553 `marginHorizontal: 0,`; 557 `marginHorizontal: 0,`
- `features/expenses/components/BudgetsModal.js`: 132 `marginBottom: 6,`; 146 `marginHorizontal: 0,`; 150 `marginHorizontal: 0,`
- `features/expenses/components/ExpenseDetailsModal.js`: 107 `marginTop: 4,`; 112 `height: 160,`; 116 `marginHorizontal: 0,`
- `features/expenses/components/RecurringModal.js`: 114 `marginHorizontal: 0,`; 118 `marginHorizontal: 0,`; 122 `marginHorizontal: 0,`
- `features/expenses/screens/ExpensesScreen.js`: 691 `marginHorizontal: 0,`; 695 `marginHorizontal: 0,`; 699 `marginHorizontal: 0,`; 703 `marginHorizontal: 0,`; 707 `marginHorizontal: 0,`; 711 `marginHorizontal: 0,`; 823 `letterSpacing: 0.8,`; 860 `maxWidth: 220,`; 879 `fontSize: 11,`; 880 `lineHeight: 15,`; 890 `width: 56,`; 891 `height: 56,`; 918 `fontSize: 14,`
- `features/expenses/screens/YearEndReportScreen.js`: 168 `marginHorizontal: 0,`
- `features/home/screens/DashboardScreen.js`: 192 `marginHorizontal: 0,`; 206 `marginHorizontal: 0,`
- `features/home/screens/TenantHomeScreen.js`: 279 `marginHorizontal: 0,`
- `features/home/screens/WelcomeScreen.js`: 121 `marginHorizontal: 0,`; 128 `marginHorizontal: 0,`
- `features/invites/screens/InviteTenantScreen.js`: 340 `marginBottom: 6,`; 354 `fontSize: 34,`; 355 `lineHeight: 44,`; 368 `marginHorizontal: 0,`; 398 `marginHorizontal: 0,`; 402 `marginHorizontal: 0,`; 405 `marginHorizontal: 0,`; 412 `letterSpacing: 0.8,`; 438 `letterSpacing: 1,`
- `features/messages/components/AttachmentImage.js`: 92 `width: 200,`; 93 `height: 150,`; 94 `borderRadius: 10,`; 105 `fontSize: 12,`; 106 `marginTop: 4,`
- `features/messages/components/MessageBubble.js`: 77 `fontSize: 15,`; 78 `lineHeight: 21,`; 86 `fontSize: 11,`; 87 `lineHeight: 15,`
- `features/messages/screens/MessageThreadScreen.js`: 434 `width: 48,`; 435 `height: 48,`; 459 `fontSize: 15,`; 462 `maxHeight: 120,`
- `features/messages/screens/MessagesScreen.js`: 147 `marginHorizontal: 0,`
- `features/mileage/components/TripModal.js`: 179 `marginBottom: 6,`; 195 `paddingVertical: 6,`; 211 `marginHorizontal: 0,`; 215 `marginHorizontal: 0,`; 219 `marginHorizontal: 0,`
- `features/mileage/screens/MileageScreen.js`: 217 `marginHorizontal: 0,`; 265 `marginBottom: 0,`; 268 `marginHorizontal: 0,`
- `features/payments/screens/PaymentDetailScreen.js`: 69 `marginHorizontal: 0,`
- `features/payments/screens/PaymentsScreen.js`: 85 `paddingHorizontal: 0,`
- `features/settings/screens/SettingsScreen.js`: 110 `marginHorizontal: 0,`; 116 `marginHorizontal: 0,`
- `features/tenants/components/EndTenancyModal.js`: 153 `marginBottom: 6,`; 162 `minHeight: 70,`; 178 `marginHorizontal: 0,`; 182 `marginHorizontal: 0,`
- `features/tenants/components/PlaceModal.js`: 181 `marginBottom: 6,`; 202 `paddingVertical: 6,`; 218 `marginHorizontal: 0,`; 222 `marginHorizontal: 0,`
- `features/tenants/components/PropertyFormModal.js`: 148 `marginHorizontal: 0,`; 152 `marginHorizontal: 0,`
- `features/tenants/screens/PastRequestsScreen.js`: 146 `marginBottom: 4,`; 153 `paddingVertical: 4,`; 155 `borderRadius: 12,`; 160 `fontSize: 12,`; 168 `fontSize: 14,`; 170 `marginTop: 4,`
- `features/tenants/screens/PropertiesScreen.js`: 214 `marginHorizontal: 0,`; 257 `width: 32,`; 258 `height: 32,`
- `features/tenants/screens/PropertyDetailScreen.js`: 99 `marginHorizontal: 0,`
- `features/tenants/screens/TenantDetailScreen.js`: 439 `marginHorizontal: 0,`; 443 `marginHorizontal: 0,`; 453 `marginHorizontal: 0,`; 459 `marginHorizontal: 0,`; 462 `marginHorizontal: 0,`
- `features/tenants/screens/TenantLeaseScreen.js`: 90 `marginHorizontal: 0,`
- `features/tenants/screens/TenantsScreen.js`: 361 `marginHorizontal: 0,`; 365 `marginHorizontal: 0,`; 400 `letterSpacing: 0.6,`; 437 `fontSize: 12,`; 438 `lineHeight: 16,`; 445 `letterSpacing: 0.8,`
- `features/workOrders/components/WorkOrderCard.js`: 192 `height: 160,`; 206 `width: 48,`; 207 `height: 48,`; 218 `marginHorizontal: 0,`
- `features/workOrders/screens/MyRequestsScreen.js`: 138 `marginHorizontal: 0,`; 160 `marginBottom: 4,`; 167 `paddingVertical: 4,`; 169 `borderRadius: 12,`; 174 `fontSize: 12,`
- `features/workOrders/screens/NewWorkOrderScreen.js`: 606 `maxWidth: 600,`; 612 `marginBottom: 6,`; 620 `minHeight: 80,`; 639 `paddingVertical: 6,`; 651 `height: 160,`; 655 `height: 120,`; 664 `marginHorizontal: 0,`; 667 `marginHorizontal: 0,`; 691 `fontSize: 14,`; 707 `width: 72,`; 708 `height: 72,`; 714 `top: -8,`; 715 `right: -8,`
- `features/workOrders/screens/RequestDetailScreen.js`: 256 `paddingVertical: 4,`; 258 `borderRadius: 12,`; 263 `fontSize: 12,`; 283 `width: 110,`; 284 `height: 110,`; 304 `marginHorizontal: 0,`
- `features/workOrders/screens/WorkOrderDetailScreen.js`: 396 `width: 120,`; 397 `height: 120,`; 416 `height: 160,`; 438 `minHeight: 80,`; 442 `marginHorizontal: 0,`; 459 `width: 48,`; 460 `height: 48,`; 474 `marginHorizontal: 0,`; 478 `marginHorizontal: 0,`; 484 `marginHorizontal: 0,`; 488 `marginHorizontal: 0,`; 492 `marginHorizontal: 0,`

238 in all. Most are font sizes (11 to 34), small radii (6, 8, 10, 12, 16), 2 to 6 point gaps, and fixed photo or thumbnail sizes.

**Plan:** font sizes move to the `TYPE` scale, radii to `RADIUS`, spacing to the 4 point `SPACING` steps, and sizes that repeat (thumbnails, avatars, icon circles) to `SIZES`. One-off layout sizes for photos stay as numbers where a token would add nothing, and the final sweep lists any that remain.

## Every place money is shown

- `features/expenses/components/ExpenseDetailsModal.js:32` <Text style={styles.total}>Total: ${total.toFixed(2)}</Text>
- `features/expenses/components/ExpenseDetailsModal.js:36` <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
- `features/expenses/components/RecurringModal.js:33` {formatMoney(rule.template.amount)} · {rule.frequency}
- `features/expenses/screens/ExpensesScreen.js:402` <Text style={styles.summary_total}>{formatMoney(deductible_total)}</Text>
- `features/expenses/screens/ExpensesScreen.js:404` Capital improvements (depreciated): {formatMoney(capital_total)}
- `features/expenses/screens/ExpensesScreen.js:408` Billed to tenants: {formatMoney(billed_total)} · Recovered:{' '}
- `features/expenses/screens/ExpensesScreen.js:409` {formatMoney(recovered_total)}
- `features/expenses/screens/ExpensesScreen.js:436` {formatMoney(row.total)} · {percent}%
- `features/expenses/screens/ExpensesScreen.js:461` {formatMoney(row.total)}
- `features/expenses/screens/ExpensesScreen.js:462` {budget !== undefined ? ' of ' + formatMoney(budget) : ''}
- `features/expenses/screens/ExpensesScreen.js:493` <Text style={styles.bar_amount}>{formatMoney(row.total)}</Text>
- `features/expenses/screens/ExpensesScreen.js:569` <Text style={styles.row_amount}>{formatMoney(expense.amount)}</Text>
- `features/expenses/screens/ExpensesScreen.js:584` Billed to tenant · {formatMoney(expense.recovered \|\| 0)} back
- `features/expenses/screens/YearEndReportScreen.js:81` <Text style={styles.summary_total}>{formatMoney(data.deductible)}</Text>
- `features/expenses/screens/YearEndReportScreen.js:83` Capital improvements (depreciated): {formatMoney(data.capital)}
- `features/expenses/screens/YearEndReportScreen.js:86` Mileage: {data.miles.toFixed(1)} miles, {formatMoney(data.mileage_deduction)}
- `features/expenses/screens/YearEndReportScreen.js:97` {formatDate(expense.date)} · {formatMoney(expense.amount)} ·{' '}
- `features/expenses/screens/YearEndReportScreen.js:114` <Text style={styles.line_amount}>{formatMoney(row.total)}</Text>
- `features/expenses/screens/YearEndReportScreen.js:120` <Text style={styles.line_amount}>{formatMoney(item.deductible)}</Text>
- `features/expenses/screens/YearEndReportScreen.js:124` <Text style={styles.line_amount}>{formatMoney(item.capital)}</Text>
- `features/expenses/screens/YearEndReportScreen.js:128` <Text style={styles.line_amount}>{formatMoney(item.mileage_deduction)}</Text>
- `features/expenses/screens/YearEndReportScreen.js:145` <Text style={styles.line_amount}>{formatMoney(row.total)}</Text>
- `features/expenses/utils/expenseStats.js:70` export function formatMoney(value) {
- `features/expenses/utils/expenseStats.js:71` return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
- `features/expenses/utils/exportExpenses.js:60` expense.amount.toFixed(2),
- `features/expenses/utils/exportExpenses.js:64` (expense.recovered \|\| 0).toFixed(2),
- `features/expenses/utils/exportExpenses.js:76` lines.push(csvField(row.category) + ',' + row.total.toFixed(2));
- `features/expenses/utils/exportExpenses.js:79` 'Total deductible,' + sumAmounts(expenses.filter((expense) => !expense.is_capital)).toFixed(2),
- `features/expenses/utils/exportExpenses.js:83` sumAmounts(expenses.filter((expense) => expense.is_capital)).toFixed(2),
- `features/expenses/utils/exportExpenses.js:102` lines.push(csvField(row.category) + ',' + row.total.toFixed(2));
- `features/expenses/utils/exportExpenses.js:104` lines.push('Total deductible,' + item.deductible.toFixed(2));
- `features/expenses/utils/exportExpenses.js:105` lines.push('Capital improvements (depreciated),' + item.capital.toFixed(2));
- `features/expenses/utils/exportExpenses.js:108` 'Mileage deduction at ' + mileage_rate + ' per mile,' + item.mileage_deduction.toFixed(2),
- `features/expenses/utils/exportExpenses.js:114` lines.push('Total deductible,' + data.deductible.toFixed(2));
- `features/expenses/utils/exportExpenses.js:115` lines.push('Capital improvements (depreciated),' + data.capital.toFixed(2));
- `features/expenses/utils/exportExpenses.js:117` lines.push('Mileage deduction,' + data.mileage_deduction.toFixed(2));
- `features/expenses/utils/exportExpenses.js:122` lines.push(csvField(row.vendor) + ',' + row.total.toFixed(2));
- `features/mileage/screens/MileageScreen.js:130` <Text style={styles.summary_total}>{formatMoney(total_miles * mileage_rate)}</Text>
- `features/mileage/screens/MileageScreen.js:190` <Text style={styles.detail}>{formatMoney(item.miles * mileage_rate)} deduction</Text>
- `features/settings/screens/SettingsScreen.js:62` <Text style={styles.body}>{formatMoney(mileage_rate)} per mile</Text>
- `features/workOrders/components/WorkOrderCard.js:69` Estimate: ${order.estimate.toFixed(2)} · Actual: ${expense_total.toFixed(2)}
- `features/workOrders/components/WorkOrderCard.js:92` Expenses: ${expense_total.toFixed(2)} ({expenses.length}) · Tap to view
- `features/workOrders/screens/WorkOrderDetailScreen.js:293` Estimate: {has_estimate ? '$' + order.estimate.toFixed(2) : 'Not set'}
- `features/workOrders/screens/WorkOrderDetailScreen.js:295` <Text style={styles.detail}>Actual: ${expense_total.toFixed(2)}</Text>
- `features/workOrders/screens/WorkOrderDetailScreen.js:300` ? '$' + difference.toFixed(2) + ' over estimate'
- `features/workOrders/screens/WorkOrderDetailScreen.js:301` : '$' + Math.abs(difference).toFixed(2) + ' under estimate'}
- `features/workOrders/screens/WorkOrderDetailScreen.js:312` <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>

Money shows up in three ways today: `formatMoney` (expenses, mileage, year-end, settings), hand-built `'$' + value.toFixed(2)` (work order cards and detail, expense details), and the CSV export in `exportExpenses.js`.

**Plan:** add `utils/formatCurrency.js` (thousands separators, two decimals, a real minus sign for negatives, an optional + for positives) with tests and use it everywhere money is drawn on screen, always with tabular numbers. The CSV export and `formatMoney` stay as they are, since they're output formats other code and saved files depend on.


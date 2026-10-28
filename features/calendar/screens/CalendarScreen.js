import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListRow from '../../../components/ui/ListRow';
import SectionHeader from '../../../components/ui/SectionHeader';
import { toneColors } from '../../../components/ui/uiHelpers';
import AddToCalendarSheet from '../components/AddToCalendarSheet';
import { useDeviceCalendar } from '../hooks/useDeviceCalendar';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { useTenants } from '../../tenants/context/TenantsContext';
import { useLedger } from '../../payments/context/LedgerContext';
import { ordersForTenant } from '../../workOrders/utils/workOrderHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { monthOf } from '../../payments/utils/ledgerMath';
import {
  buildCalendarEvents,
  eventsByDate,
  dotsFor,
  monthGrid,
  nextMonth,
  previousMonth,
  monthLabel,
  dayLabel,
  daySpokenLabel,
  weekday_labels,
  upcomingForExport,
  canExport,
} from '../utils/calendarEvents';
import { COLORS, SPACING, TYPE, SIZES, RADIUS, BORDER, FONTS } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the legend under the grid, so a dot's color always has words next to it somewhere on screen
const legend = [
  { tone: 'danger', label: 'Past due' },
  { tone: 'warning', label: 'Due' },
  { tone: 'success', label: 'Paid or done' },
  { tone: 'neutral', label: 'Other' },
];

// a month of rent due dates, payments, lease ends, and work order dates, from what the app already has
// I drew the grid myself with Views instead of a calendar library: it's 7 columns of Pressables, it uses the
// same tokens and line icons as every other screen, and it works the same in light and dark with nothing to install
// tap a day to see its agenda, tap a row to open it, and the calendar button sends it to the phone's calendar
function CalendarScreen(props) {
  const insets = useSafeAreaInsets();
  const role = useAppRole();
  const { user } = useAuth();
  const { orders, demo_mode } = useWorkOrders();
  const { tenants, my_active_tenancies } = useTenants();
  const { ledgers, current_ledger, past_ledgers, today } = useLedger();
  const device = useDeviceCalendar(user ? user.id : null, demo_mode);
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);
  const is_owner = role !== 'tenant';

  const events = useMemo(() => {
    // a tenant only gets their own: the demo shares one order list, so Sam's come out of it by name
    const my_orders = is_owner || !demo_mode ? orders : ordersForTenant(orders, demo_tenant.name);
    return buildCalendarEvents({
      role: is_owner ? 'owner' : 'tenant',
      ledgers: is_owner ? ledgers : [current_ledger, ...(past_ledgers || [])].filter(Boolean),
      tenants: is_owner ? tenants : [],
      my_tenancies: is_owner ? [] : my_active_tenancies,
      orders: my_orders,
      today: today,
    });
  }, [
    is_owner,
    demo_mode,
    orders,
    ledgers,
    current_ledger,
    past_ledgers,
    tenants,
    my_active_tenancies,
    today,
  ]);
  const by_date = useMemo(() => eventsByDate(events), [events]);
  const weeks = monthGrid(month);
  const day_events = by_date[selected] || [];

  function pickDay(date) {
    setSelected(date);
    if (monthOf(date) !== month) {
      setMonth(monthOf(date));
    }
  }

  function goToday() {
    setMonth(monthOf(today));
    setSelected(today);
  }

  // every route gets its own call so the id always goes as an inline param
  function openEvent(entry) {
    const id = entry.target_id;
    const navigation = props.navigation;
    switch (entry.route) {
      case 'TenantLedger':
        navigation.navigate('TenantLedger', { tenancyId: id });
        break;
      case 'PaymentDetail':
        navigation.navigate('PaymentDetail', { paymentId: id });
        break;
      case 'TenantLease':
        navigation.navigate('TenantLease', { tenancyId: id });
        break;
      case 'WorkOrderDetail':
        navigation.navigate('WorkOrderDetail', { workOrderId: id });
        break;
      case 'RequestDetail':
        navigation.navigate('RequestDetail', { workOrderId: id });
        break;
      case 'TenantHome':
        navigation.navigate('TenantHome');
        break;
      default:
        navigation.navigate('Payments');
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
      >
        {/* the month and the arrows around it */}
        <View style={styles.month_row}>
          <Pressable
            onPress={() => setMonth(previousMonth(month))}
            accessibilityRole="button"
            accessibilityLabel={'Previous month, ' + monthLabel(previousMonth(month))}
            style={styles.arrow}
          >
            <Ionicons name="chevron-back-outline" size={SIZES.row_icon} color={COLORS.title} />
          </Pressable>
          <Text style={styles.month_title} accessibilityRole="header" numberOfLines={1}>
            {monthLabel(month)}
          </Text>
          <Pressable
            onPress={() => setMonth(nextMonth(month))}
            accessibilityRole="button"
            accessibilityLabel={'Next month, ' + monthLabel(nextMonth(month))}
            style={styles.arrow}
          >
            <Ionicons name="chevron-forward-outline" size={SIZES.row_icon} color={COLORS.title} />
          </Pressable>
        </View>
        {month !== monthOf(today) || selected !== today ? (
          <Pressable
            onPress={goToday}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            hitSlop={SPACING.sm}
            style={styles.today_link}
          >
            <Text style={styles.today_link_text}>Today</Text>
          </Pressable>
        ) : null}

        {/* the weekday letters are only for the eye, each day says its full name to a screen reader */}
        <View
          style={styles.week_row}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {weekday_labels.map((label) => (
            <Text key={label} style={styles.weekday} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0].date} style={styles.week_row}>
            {week.map((cell) => {
              const cell_events = by_date[cell.date] || [];
              const is_selected = cell.date === selected;
              const is_today = cell.date === today;
              return (
                <Pressable
                  key={cell.date}
                  onPress={() => pickDay(cell.date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: is_selected }}
                  accessibilityLabel={daySpokenLabel(cell.date, cell_events, is_today)}
                  style={({ pressed }) => [
                    styles.cell,
                    is_selected && styles.cell_selected,
                    pressed && styles.cell_pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.day,
                      !cell.in_month && styles.day_outside,
                      is_today && styles.day_today,
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {cell.day}
                  </Text>
                  <View style={styles.dots}>
                    {dotsFor(cell_events).map((tone) => (
                      <View
                        key={tone}
                        style={[styles.dot, { backgroundColor: toneColors(tone).text }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          {legend.map((item) => (
            <View key={item.tone} style={styles.legend_item}>
              <View style={[styles.dot, { backgroundColor: toneColors(item.tone).text }]} />
              <Text style={styles.legend_text}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* the agenda for the picked day */}
        <SectionHeader
          title={dayLabel(selected)}
          count={day_events.length > 0 ? day_events.length : null}
        />
        {day_events.length === 0 ? (
          <Text style={styles.nothing}>Nothing on this day.</Text>
        ) : (
          day_events.map((entry, index) => (
            <ListRow
              key={entry.key}
              icon={entry.icon}
              icon_tone={entry.past_due ? 'danger' : undefined}
              title={entry.title}
              subtitle={entry.subtitle}
              subtitle_tone={entry.past_due ? 'danger' : undefined}
              accessibilityLabel={[entry.past_due ? 'Past due' : '', entry.title, entry.subtitle]
                .filter(Boolean)
                .join(', ')}
              accessibilityHint="Opens it"
              divider={index < day_events.length - 1}
              onPress={() => openEvent(entry)}
              trailing={
                canExport(entry, today) ? (
                  <Pressable
                    onPress={() => device.start([entry])}
                    accessibilityRole="button"
                    accessibilityLabel={'Add to my calendar, ' + entry.title}
                    style={styles.add_button}
                  >
                    <Ionicons name="add-circle-outline" size={SIZES.row_icon} color={COLORS.cta} />
                  </Pressable>
                ) : null
              }
              chevron={false}
            />
          ))
        )}

        {/* everything coming up in one go */}
        <SectionHeader title="Your phone's calendar" />
        <ListRow
          icon="calendar-outline"
          title="Add upcoming rent due dates and lease ends"
          subtitle={device.busy ? 'Adding...' : 'The next 90 days, skipping anything already added'}
          accessibilityHint="Asks before adding anything"
          onPress={device.busy ? undefined : () => device.start(upcomingForExport(events, today))}
        />
      </ScrollView>

      <AddToCalendarSheet
        visible={!!device.pending}
        count={device.pending ? device.pending.entries.length : 0}
        needs_permission={device.pending ? device.pending.needs_permission : false}
        demo_mode={demo_mode}
        onConfirm={device.confirm}
        onCancel={device.cancel}
      />
    </View>
  );
}

export default CalendarScreen;

const styles = themedStyles((COLORS) => ({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    // capped and centered on a tablet so the grid doesn't stretch into wide flat cells
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  month_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month_title: {
    ...TYPE.title,
    color: COLORS.title,
    flex: 1,
    textAlign: 'center',
  },
  today_link: {
    alignSelf: 'center',
    minHeight: SIZES.touch,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  today_link_text: {
    ...TYPE.label,
    color: COLORS.cta,
  },
  week_row: {
    flexDirection: 'row',
  },
  weekday: {
    ...TYPE.caption,
    flex: 1,
    textAlign: 'center',
    color: COLORS.text_muted,
    paddingVertical: SPACING.xs,
  },
  cell: {
    flex: 1,
    minHeight: SIZES.row_min_height - SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.thick,
    borderColor: 'transparent',
  },
  cell_selected: {
    borderColor: COLORS.cta,
  },
  cell_pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  day: {
    ...TYPE.body,
    color: COLORS.text,
  },
  day_outside: {
    color: COLORS.text_muted,
  },
  day_today: {
    fontFamily: FONTS.body_bold,
    color: COLORS.cta,
    textDecorationLine: 'underline',
  },
  dots: {
    flexDirection: 'row',
    gap: SPACING.xs / 2,
    height: SIZES.tab_dot,
    marginTop: SPACING.xs / 2,
  },
  dot: {
    width: SIZES.tab_dot - 2,
    height: SIZES.tab_dot - 2,
    borderRadius: RADIUS.pill,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  legend_item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legend_text: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
  nothing: {
    ...TYPE.body,
    color: COLORS.text_muted,
    paddingVertical: SPACING.md,
  },
  add_button: {
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

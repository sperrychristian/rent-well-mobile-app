import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Wordmark from '../components/ui/Wordmark';
import SectionHeader from '../components/ui/SectionHeader';
import { useAppRole } from '../features/auth/hooks/useAppRole';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { navigation_map, hubs, tabs_route } from './navigationMap';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../theme';

// the drawer's state with its history cut back to the tabs and the picked screen, same routes and keys,
// so picking from the menu starts that section fresh: back goes to the tabs and the header shows the menu button
// (a link inside a section still adds to the history, so the screen it opens gets a back arrow)
export function menuPickState(state, route_name) {
  const tabs = state.routes.find((route) => route.name === tabs_route);
  const target = state.routes.find((route) => route.name === route_name) || tabs;
  const history = [{ type: 'route', key: tabs.key }];
  if (target.key !== tabs.key) {
    history.push({ type: 'route', key: target.key });
  }
  return { ...state, index: state.routes.indexOf(target), history };
}

// the words under the wordmark, so you always know which side you're on
export function roleLabel(role, demo_mode) {
  if (demo_mode) {
    return role === 'tenant' ? 'Demo, tenant view' : 'Demo, landlord view';
  }
  return role === 'tenant' ? 'Tenant' : 'Landlord';
}

// one plain row: a green line icon, the label, a hairline on top, and a soft fill on the one you're on
function DrawerRow(props) {
  const screen = navigation_map[props.route_name];
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={screen.nav_label}
      accessibilityState={{ selected: props.selected }}
      testID={'drawer-' + props.route_name}
      style={({ pressed }) => [
        styles.row,
        props.last && styles.last,
        (pressed || props.selected) && styles.row_on,
      ]}
    >
      <Ionicons name={screen.nav_icon} size={SIZES.row_icon} color={COLORS.cta} />
      <Text style={[styles.label, props.selected && styles.label_on]} numberOfLines={1}>
        {screen.nav_label}
      </Text>
    </Pressable>
  );
}

// the drawer: the wordmark and the role, the tab destinations first (so a drawer screen can get back to them),
// then the occasional sections in groups, all as plain rows on the paper with no cards or shadows
function DrawerContent(props) {
  const role = useAppRole() === 'tenant' ? 'tenant' : 'owner';
  const { demo_mode } = useWorkOrders();
  const state = props.state;
  const focused = state.routes[state.index];
  // which tab is showing, when the tabs are the drawer screen in front
  const tab_state = focused.name === tabs_route && focused.state ? focused.state : null;
  const current_tab = tab_state ? tab_state.routes[tab_state.index].name : hubs[role].tabs[0];

  function pickTab(route_name) {
    props.navigation.dispatch({
      ...CommonActions.reset(menuPickState(state, tabs_route)),
      target: state.key,
    });
    // the root stack's router knows a tab lives inside Main, so the plain name is enough
    props.navigation.navigate(route_name);
  }

  function pickSection(route_name) {
    props.navigation.dispatch({
      ...CommonActions.reset(menuPickState(state, route_name)),
      target: state.key,
    });
  }

  const sections = [
    { title: 'Main', screens: hubs[role].tabs, is_tabs: true },
    ...hubs[role].drawer,
  ];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Wordmark size="small" align="left" tagline={null} />
        <Text style={styles.role}>{roleLabel(role, demo_mode)}</Text>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          {section.screens.map((route_name, index) => (
            <DrawerRow
              key={route_name}
              route_name={route_name}
              last={index === section.screens.length - 1}
              selected={
                section.is_tabs
                  ? focused.name === tabs_route && current_tab === route_name
                  : focused.name === route_name
              }
              onPress={() => (section.is_tabs ? pickTab(route_name) : pickSection(route_name))}
            />
          ))}
        </View>
      ))}
    </DrawerContentScrollView>
  );
}

export default DrawerContent;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  top: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  role: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
  section: {
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.drawer_row,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  row_on: {
    backgroundColor: COLORS.surface_raised,
  },
  label: {
    ...TYPE.subheading,
    color: COLORS.text,
    flex: 1,
  },
  // the one you're on is semibold green, so it doesn't rely on the fill alone
  label_on: {
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.cta,
  },
});

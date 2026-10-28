import { useState, useMemo } from 'react';
import { View, Text, TextInput, SectionList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListRow from '../../../components/ui/ListRow';
import SectionHeader from '../../../components/ui/SectionHeader';
import EmptyState from '../../../components/ui/EmptyState';
import { list_styles } from '../../../components/ui/listStyles';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../auth/context/AuthContext';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { useTenants } from '../../tenants/context/TenantsContext';
import { useLedger } from '../../payments/context/LedgerContext';
import { ordersForTenant } from '../../workOrders/utils/workOrderHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRecentSearches } from '../hooks/useRecentSearches';
import {
  buildSearchItems,
  searchItems,
  highlightParts,
  resultCount,
  min_query_length,
} from '../utils/searchIndex';
import { COLORS, SPACING, TYPE, SIZES, FONTS } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// how long typing has to stop before the search runs
const debounce_ms = 250;

// one search box over everything the app already has loaded: no new requests, the same lists the screens read
// a landlord finds tenants, properties, work orders, payments, charges, and expenses, a tenant finds their own
// requests, payments, and charges, and every row opens the screen that already shows it, by id
function SearchScreen(props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const role = useAppRole();
  const { user } = useAuth();
  const { orders, expenses, demo_mode } = useWorkOrders();
  const { tenants, properties } = useTenants();
  const ledger_store = useLedger();
  const recent = useRecentSearches(user ? user.id : null, demo_mode);
  const [query, setQuery] = useState('');
  const settled_query = useDebouncedValue(query, debounce_ms);

  const is_owner = role !== 'tenant';
  const { ledgers, current_ledger, past_ledgers, today } = ledger_store;

  // rebuilt only when one of the lists changes, not on every key
  const items = useMemo(() => {
    // a tenant only gets their own: the demo shares one order list, so Sam's come out of it by name
    const my_orders = is_owner || !demo_mode ? orders : ordersForTenant(orders, demo_tenant.name);
    const my_ledgers = is_owner
      ? ledgers
      : [current_ledger, ...(past_ledgers || [])].filter(Boolean);
    return buildSearchItems({
      role: is_owner ? 'owner' : 'tenant',
      orders: my_orders,
      tenants: is_owner ? tenants : [],
      properties: is_owner ? properties : [],
      ledgers: my_ledgers,
      expenses: is_owner ? expenses : [],
      today: today,
    });
  }, [
    is_owner,
    demo_mode,
    orders,
    tenants,
    properties,
    ledgers,
    current_ledger,
    past_ledgers,
    expenses,
    today,
  ]);
  const sections = useMemo(() => searchItems(items, settled_query), [items, settled_query]);
  const searching = settled_query.trim().length >= min_query_length;
  const count = resultCount(sections);

  // every route gets its own call so the id always goes as an inline param, never the whole row
  function openResult(entry) {
    recent.remember(settled_query);
    const id = entry.target_id;
    const navigation = props.navigation;
    switch (entry.route) {
      case 'TenantDetail':
        navigation.navigate('TenantDetail', { tenantId: id });
        break;
      case 'PropertyDetail':
        navigation.navigate('PropertyDetail', { propertyId: id });
        break;
      case 'WorkOrderDetail':
        navigation.navigate('WorkOrderDetail', { workOrderId: id });
        break;
      case 'RequestDetail':
        navigation.navigate('RequestDetail', { workOrderId: id });
        break;
      case 'PaymentDetail':
        navigation.navigate('PaymentDetail', { paymentId: id });
        break;
      case 'TenantLedger':
        navigation.navigate('TenantLedger', { tenancyId: id });
        break;
      case 'Expenses':
        navigation.navigate('Expenses', { expenseId: id });
        break;
      default:
        navigation.navigate('Payments');
    }
  }

  // the matching letters in semibold green, so the eye lands on why a row came back
  function highlighted(text) {
    return highlightParts(text, settled_query).map((part, index) =>
      part.match ? (
        <Text key={index} style={styles.match}>
          {part.text}
        </Text>
      ) : (
        part.text
      ),
    );
  }

  let body;
  if (!searching) {
    body =
      recent.recents.length > 0 ? (
        <View>
          <SectionHeader
            title="Recent searches"
            action_label="Clear"
            onAction={recent.clear}
            style={styles.recent_header}
          />
          {recent.recents.map((text, index) => (
            <ListRow
              key={text}
              icon="time-outline"
              title={text}
              accessibilityLabel={'Search again for ' + text}
              divider={index < recent.recents.length - 1}
              onPress={() => setQuery(text)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="search-outline"
          title="Search everything"
          message={
            is_owner
              ? 'Find a tenant, property, work order, payment, charge, or expense by name, place, or amount.'
              : 'Find a repair request, payment, or charge by what it was for, the date, or the amount.'
          }
        />
      );
  } else if (count === 0) {
    body = (
      <EmptyState
        icon="search-outline"
        title="No matches"
        message={
          'Nothing matches "' + settled_query.trim() + '". Try a name, a place, or an amount.'
        }
        action_label="Clear Search"
        action_icon="close-outline"
        onAction={() => setQuery('')}
      />
    );
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.data.length} />
        )}
        renderItem={({ item: entry, index, section }) => (
          <ListRow
            icon={section.icon}
            title={highlighted(entry.title)}
            subtitle={entry.subtitle}
            subtitle_tone={entry.tone === 'danger' ? 'danger' : undefined}
            accessibilityLabel={[section.title, entry.title, entry.subtitle].join(', ')}
            accessibilityHint="Opens it"
            divider={index < section.data.length - 1}
            onPress={() => openResult(entry)}
          />
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.search_row}>
        <Ionicons
          name="search-outline"
          size={SIZES.icon}
          color={COLORS.text_muted}
          style={styles.search_icon}
          accessible={false}
        />
        <TextInput
          style={styles.search_input}
          accessibilityLabel="Search"
          keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
          placeholder={
            is_owner ? 'Tenants, work orders, payments...' : 'Requests, payments, charges...'
          }
          placeholderTextColor={COLORS.text_muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => recent.remember(query)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          clearButtonMode="never"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clear_button}
          >
            <Ionicons name="close-circle-outline" size={SIZES.icon} color={COLORS.text_muted} />
          </Pressable>
        ) : null}
      </View>
      {/* a screen reader hears how many came back once typing stops */}
      {searching ? (
        <Text style={styles.count} accessibilityLiveRegion="polite" accessibilityRole="text">
          {count === 1 ? '1 result' : count + ' results'}
        </Text>
      ) : null}
      {body}
    </View>
  );
}

export default SearchScreen;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    // capped and centered on a tablet so lines stay a readable length, like the other lists
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
  },
  search_row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  search_icon: {
    position: 'absolute',
    left: SPACING.md - SPACING.xs,
    zIndex: 1,
  },
  search_input: {
    ...list_styles.search_input,
    flex: 1,
    paddingLeft: SPACING.md - SPACING.xs + SIZES.icon + SPACING.sm,
    paddingRight: SIZES.touch,
  },
  clear_button: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: SIZES.touch,
    height: SIZES.button_medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs,
  },
  recent_header: {
    marginTop: 0,
  },
  match: {
    fontFamily: FONTS.body_bold,
    color: COLORS.cta,
  },
}));

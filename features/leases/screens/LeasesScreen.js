import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import ListRow from '../../../components/ui/ListRow';
import StatusLabel from '../../../components/ui/StatusLabel';
import SectionHeader from '../../../components/ui/SectionHeader';
import EmptyState from '../../../components/ui/EmptyState';
import SkeletonList from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ErrorState';
import { useTenants } from '../../tenants/context/TenantsContext';
import { placeLabel } from '../../tenants/utils/tenantHelpers';
import { leaseRows, leaseStatusLabel, daysLine, shortLeaseDate } from '../utils/leaseHelpers';
import { todayString } from '../../../utils/formatDate';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

// every lease in one list, soonest end first: current tenancies, then past ones that had a lease
// each row says the tenant, the place, the status in words and color, and the days left
// tapping one opens that tenancy's lease (Tenant Lease) by its id, where Set, Edit, and Renew live
// the leases come with the tenants in both modes (each tenancy carries its lease), so nothing extra loads here
function LeasesScreen(props) {
  const { tenants, status, error_message, refresh, refreshing } = useTenants();
  const today = todayString();
  const rows = leaseRows(tenants);
  const current = rows.filter((row) => !row.is_past);
  const past = rows.filter((row) => row.is_past);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <SkeletonList rows={5} style={styles.skeleton} />
      </View>
    );
  }
  if (status === 'error' && rows.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error_message} onRetry={refresh} />
      </View>
    );
  }

  // one list with the two section headers as rows, so it scrolls as one ruled block
  const items = [];
  if (current.length > 0) {
    items.push({ key: 'h-current', header: 'Current', count: current.length });
    current.forEach((row) => items.push({ key: row.tenancy.id, row }));
  }
  if (past.length > 0) {
    items.push({ key: 'h-past', header: 'Moved out', count: past.length });
    past.forEach((row) => items.push({ key: row.tenancy.id, row }));
  }

  function renderItem({ item, index }) {
    if (item.header) {
      return <SectionHeader title={item.header} count={item.count} />;
    }
    const row = item.row;
    const status_words = leaseStatusLabel(row.lease);
    const next = items[index + 1];
    const end_text = row.lease.lease_end_on
      ? 'Ends ' + shortLeaseDate(row.lease.lease_end_on, today)
      : null;
    return (
      <ListRow
        icon="document-text-outline"
        title={row.tenant.name}
        subtitle={placeLabel(row.tenancy.property_name, row.tenancy.unit_label)}
        detail={
          <View style={styles.detail}>
            <StatusLabel
              label={status_words.label}
              tone={status_words.tone}
              icon={status_words.icon}
            />
            <Text style={styles.days}>
              {[end_text, row.lease.lease_status === 'none' ? null : daysLine(row.lease)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        }
        divider={!!next && !next.header}
        accessibilityLabel={
          row.tenant.name +
          ', ' +
          placeLabel(row.tenancy.property_name, row.tenancy.unit_label) +
          ', ' +
          status_words.label +
          (row.lease.lease_status === 'none' ? '' : ', ' + daysLine(row.lease))
        }
        accessibilityHint="Opens the lease"
        onPress={() => props.navigation.navigate('TenantLease', { tenancyId: row.tenancy.id })}
      />
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        <EmptyState
          illustration="empty_leases"
          title="No leases yet"
          message="Leases show up here once you have tenants. Open a tenant's lease to set the dates."
          action_label="Open Tenants"
          action_icon="people-outline"
          onAction={() => props.navigation.navigate('Tenants')}
        />
      }
    />
  );
}

export default LeasesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SIZES.screen_padding,
    paddingBottom: SPACING.xl,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  skeleton: {
    paddingHorizontal: SIZES.screen_padding,
    paddingTop: SPACING.md,
  },
  detail: {
    marginTop: SPACING.xxs,
    gap: SPACING.xxs,
  },
  days: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
});

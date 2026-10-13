import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTenants } from '../context/TenantsContext';
import { placeLabel } from '../utils/tenantHelpers';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

// stub for the assignment: it gets only the tenant's id, shows their name when the tenants data has them,
// and the id otherwise, then links to the Documents screen where leases live today
function TenantLeaseScreen(props) {
  const insets = useSafeAreaInsets();
  const { getTenantById } = useTenants();
  const tenant_id =
    props.route.params && props.route.params.tenantId ? props.route.params.tenantId : null;
  const tenant = tenant_id ? getTenantById(tenant_id) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: insets.bottom + SPACING.lg }}
    >
      <Text style={styles.name_line}>{tenant ? tenant.name : 'Tenant'}</Text>
      <Card>
        <Text style={styles.heading}>Lease and documents</Text>
        {tenant && tenant.active_tenancies.length > 0 ? (
          tenant.active_tenancies.map((tenancy) => (
            <Text key={tenancy.id} style={styles.body}>
              {placeLabel(tenancy.property_name, tenancy.unit_label) +
                ', moved in ' +
                tenancy.started_at}
            </Text>
          ))
        ) : (
          <Text style={styles.body}>No current lease on file here yet.</Text>
        )}
        <Text style={styles.detail}>Tenant ID: {tenant_id || 'none'}</Text>
      </Card>

      <Card>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          This tenant&apos;s lease dates, renewals, and their documents in one place, with the ones
          you share showing up on their side of the app.
        </Text>
      </Card>

      <PrimaryButton
        title="Open Documents"
        icon="document-text-outline"
        variant="secondary"
        onPress={() => props.navigation.navigate('Documents')}
        style={styles.documents_button}
      />
    </ScrollView>
  );
}

export default TenantLeaseScreen;

const styles = StyleSheet.create({
  // the header has the screen's title now, so the name gets its own plain line instead of the big card
  name_line: {
    ...TYPE.title,
    color: COLORS.title,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    ...TYPE.body,
    color: COLORS.text,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
  documents_button: {
    width: '90%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    marginHorizontal: 0,
  },
});

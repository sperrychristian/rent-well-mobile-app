import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTenants } from '../context/TenantsContext';
import { placeLabel } from '../utils/tenantHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

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
      <ScreenTitle>{tenant ? tenant.name : 'Tenant'}</ScreenTitle>
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
        text_color={COLORS.text_dark}
        onPress={() => props.navigation.navigate('Documents')}
        style={styles.documents_button}
      />
    </ScrollView>
  );
}

export default TenantLeaseScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
    marginTop: SPACING.xs,
  },
  documents_button: {
    width: '90%',
    alignSelf: 'center',
    marginHorizontal: 0,
    backgroundColor: COLORS.surface_light,
  },
});

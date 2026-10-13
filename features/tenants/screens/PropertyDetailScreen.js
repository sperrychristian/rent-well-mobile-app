import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTenants } from '../context/TenantsContext';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

// stub for the assignment: it gets only the property's id and looks the property up in the shared tenants data
// (the demo's local copy or the server's), and if it isn't there it just shows the id instead of crashing
function PropertyDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const { properties } = useTenants();
  const property_id =
    props.route.params && props.route.params.propertyId ? props.route.params.propertyId : null;
  const property = properties.find((item) => item.id === property_id);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: insets.bottom + SPACING.lg }}
    >
      <Text style={styles.name_line}>{property ? property.name : 'Property'}</Text>
      <Card>
        {property ? (
          <>
            <Text style={styles.body}>{property.address}</Text>
            <Text style={styles.detail}>
              {property.tenancies.length === 0
                ? 'Nobody lives here right now'
                : property.tenancies.length +
                  (property.tenancies.length === 1 ? ' current tenant' : ' current tenants')}
            </Text>
          </>
        ) : (
          <Text style={styles.body}>
            {"This property isn't in your list (it may have been deleted)."}
          </Text>
        )}
        <Text style={styles.detail}>Property ID: {property_id || 'none'}</Text>
      </Card>

      <Card>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          Units, rent per unit, the property&apos;s documents and checklists, and its expenses in
          one place.
        </Text>
      </Card>

      <PrimaryButton
        title="Tenants Here"
        icon="people-outline"
        variant="secondary"
        onPress={() => props.navigation.navigate('Tenants', { propertyId: property_id })}
        style={styles.button}
      />
      <PrimaryButton
        title="Work Orders Here"
        icon="construct-outline"
        variant="secondary"
        onPress={() => props.navigation.navigate('WorkOrders', { propertyId: property_id })}
        style={styles.button}
      />
    </ScrollView>
  );
}

export default PropertyDetailScreen;

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
  button: {
    width: '90%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
  },
});

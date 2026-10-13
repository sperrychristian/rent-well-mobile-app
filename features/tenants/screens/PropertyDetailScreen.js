import { StyleSheet, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTenants } from '../context/TenantsContext';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

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
      <ScreenTitle>{property ? property.name : 'Property'}</ScreenTitle>
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
        text_color={COLORS.text_light}
        onPress={() => props.navigation.navigate('Tenants', { propertyId: property_id })}
        style={[styles.button, styles.tenants_button]}
      />
      <PrimaryButton
        title="Work Orders Here"
        icon="construct-outline"
        text_color={COLORS.text_light}
        onPress={() => props.navigation.navigate('WorkOrders', { propertyId: property_id })}
        style={[styles.button, styles.orders_button]}
      />
    </ScrollView>
  );
}

export default PropertyDetailScreen;

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
  button: {
    width: '90%',
    alignSelf: 'center',
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
  },
  tenants_button: {
    backgroundColor: COLORS.title,
  },
  orders_button: {
    backgroundColor: COLORS.success,
  },
});

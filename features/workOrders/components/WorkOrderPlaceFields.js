import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Input from '../../../components/forms/Input';
import ChoiceChips from '../../../components/forms/ChoiceChips';
import { name_max, unit_max } from '../utils/workOrderValidation';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import { themedStyles } from '../../../utils/themedStyles';

// the "where is it" part of the work order form, which depends on who's filling it in
// variant: local_owner (the demo landlord types the tenant and property), remote_owner (a real landlord picks
//   from their properties), remote_tenant (a real tenant's rental comes from GET /me), demo_tenant (Sam's rental)
// it gives back a fragment so every field sits right in the form, that way the form can scroll to a field's spot
// props: variant, inputs, onChange(inputIdentifier, value), fieldProps(inputIdentifier) (ref, return key, layout),
//   isEditing, placeText (where the order is, shown read only when editing), plus the lists for each variant
function WorkOrderPlaceFields(props) {
  const inputs = props.inputs;

  // a place that can't change shows as plain text in a quiet box
  if (props.isEditing && props.variant !== 'local_owner') {
    return (
      <View style={styles.rental_box}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.rental_text}>{props.placeText || 'No property'}</Text>
        <Text style={styles.helper}>
          {"The location can't change after the work order is created."}
        </Text>
      </View>
    );
  }

  if (props.variant === 'local_owner') {
    const property_field = props.fieldProps('property');
    return (
      <>
        <View onLayout={props.fieldProps('tenantName').onLayout}>
          <Input
            label="Tenant name"
            invalid={!inputs.tenantName.isValid}
            errorText={inputs.tenantName.errorText}
            textInputConfig={{
              ref: props.fieldProps('tenantName').ref,
              value: inputs.tenantName.value,
              onChangeText: (value) => props.onChange('tenantName', value),
              placeholder: 'Who reported it?',
              maxLength: name_max,
              autoCapitalize: 'words',
              textContentType: 'name',
              ...props.fieldProps('tenantName').returnConfig,
            }}
          />
        </View>
        <View onLayout={property_field.onLayout}>
          {props.properties.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chip_scroll}
              contentContainerStyle={styles.chip_row}
              keyboardShouldPersistTaps="handled"
            >
              {props.properties.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => props.onChange('property', name)}
                  style={[styles.chip, inputs.property.value === name && styles.chip_active]}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={'Property ' + name}
                  accessibilityState={{ selected: inputs.property.value === name }}
                >
                  <Text style={styles.chip_text}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Input
            label="Property"
            invalid={!inputs.property.isValid}
            errorText={inputs.property.errorText}
            textInputConfig={{
              ref: property_field.ref,
              value: inputs.property.value,
              onChangeText: (value) => props.onChange('property', value),
              placeholder: 'Pick one above or type the address',
              maxLength: name_max,
              ...property_field.returnConfig,
            }}
          />
        </View>
      </>
    );
  }

  if (props.variant === 'remote_owner') {
    const owner_property = props.ownerProperties.find(
      (item) => item.id === inputs.propertyId.value,
    );
    return (
      <>
        <View onLayout={props.fieldProps('propertyId').onLayout}>
          {props.ownerProperties.length === 0 ? (
            <View style={styles.rental_box}>
              <Text style={styles.label}>Property</Text>
              <Text style={styles.notice}>Add a property first from Tenants, then Properties.</Text>
              {inputs.propertyId.errorText ? (
                <Text style={styles.error_text}>{inputs.propertyId.errorText}</Text>
              ) : null}
            </View>
          ) : (
            <ChoiceChips
              label="Property"
              options={props.ownerProperties.map((item) => ({ key: item.id, label: item.name }))}
              selected={inputs.propertyId.value}
              onSelect={(key) => props.onChange('propertyId', key)}
              invalid={!inputs.propertyId.isValid}
              errorText={inputs.propertyId.errorText}
            />
          )}
        </View>
        {owner_property && owner_property.tenancies.length > 0 && (
          <ChoiceChips
            label="Tenant (optional)"
            options={owner_property.tenancies.map((tenancy) => ({
              key: tenancy.tenant_id,
              label: tenancy.tenant_name + (tenancy.unit_label ? ', ' + tenancy.unit_label : ''),
            }))}
            selected={inputs.tenantUserId.value}
            onSelect={(key) => props.onChooseTenant(owner_property, key)}
            helperText="Tap the tenant again to unlink them."
          />
        )}
        <View onLayout={props.fieldProps('unit').onLayout}>
          <Input
            label="Unit (optional)"
            invalid={!inputs.unit.isValid}
            errorText={inputs.unit.errorText}
            textInputConfig={{
              ref: props.fieldProps('unit').ref,
              value: inputs.unit.value,
              onChangeText: (value) => props.onChange('unit', value),
              placeholder: 'e.g. Unit 2B, or Exterior',
              maxLength: unit_max,
              ...props.fieldProps('unit').returnConfig,
            }}
          />
        </View>
      </>
    );
  }

  if (props.variant === 'remote_tenant') {
    const tenancies = props.tenancies;
    const me_status = props.meStatus;
    return (
      <View style={styles.rental_box}>
        <Text style={styles.label}>Reporting for</Text>
        {me_status === 'loading' && <ActivityIndicator color={COLORS.title} />}
        {me_status === 'error' && (
          <Pressable onPress={props.onRetryMe} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link_text}>{"Couldn't load your rental. Tap to try again."}</Text>
          </Pressable>
        )}
        {me_status === 'ready' && tenancies.length === 0 && (
          <Text style={styles.rental_text}>
            No rental linked yet. Ask your landlord for an invite.
          </Text>
        )}
        {me_status === 'ready' && tenancies.length === 1 && (
          <Text style={styles.rental_text}>
            {tenancies[0].property.name +
              (tenancies[0].unitLabel ? ', ' + tenancies[0].unitLabel : '')}
          </Text>
        )}
        {me_status === 'ready' && tenancies.length > 1 && (
          <ChoiceChips
            label="Which rental?"
            options={tenancies.map((tenancy) => ({
              key: tenancy.id,
              label: tenancy.property.name + (tenancy.unitLabel ? ', ' + tenancy.unitLabel : ''),
            }))}
            selected={inputs.tenancyId.value || tenancies[0].id}
            onSelect={(key) => props.onChange('tenancyId', key)}
            style={styles.no_gap}
          />
        )}
      </View>
    );
  }

  // the demo tenant: Sam's name and rental come from the demo data, like real mode does
  return (
    <View style={styles.rental_box}>
      <Text style={styles.label}>Reporting for</Text>
      <Text style={styles.rental_text}>
        {props.placeText || 'No active rental in the demo right now.'}
      </Text>
    </View>
  );
}

export default WorkOrderPlaceFields;

const styles = themedStyles((COLORS) => ({
  label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  rental_box: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.sm + SPACING.xs,
    marginBottom: SPACING.md,
  },
  rental_text: {
    ...TYPE.body,
    color: COLORS.text,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
  notice: {
    ...TYPE.body_small,
    color: COLORS.text,
  },
  error_text: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    marginTop: SPACING.xs,
  },
  link_text: {
    ...TYPE.label,
    fontSize: TYPE.body_small.fontSize,
    color: COLORS.cta,
  },
  // without this the horizontal list grows to fill the spare height and the chips stretch with it
  chip_scroll: {
    flexGrow: 0,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    ...list_styles.chip,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_text: {
    ...list_styles.chip_text,
  },
  no_gap: {
    marginBottom: 0,
  },
}));

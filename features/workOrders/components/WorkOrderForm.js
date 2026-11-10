import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../../components/forms/Input';
import DateInput from '../../../components/forms/DateInput';
import ChoiceChips from '../../../components/forms/ChoiceChips';
import PrimaryButton from '../../../components/PrimaryButton';
import WorkOrderPlaceFields from './WorkOrderPlaceFields';
import WorkOrderPhotos from './WorkOrderPhotos';
import {
  validateWorkOrder,
  estimateToCents,
  oneYearFrom,
  priority_options,
  title_max,
  description_max,
  contractor_max,
} from '../utils/workOrderValidation';
import { centsToInputText } from '../../../util/formatCurrency';
import { todayString } from '../../../util/formatDate';
import { COLORS, SPACING, TYPE, SIZES } from '../../../constants/theme';
import { themedStyles } from '../../../util/themedStyles';

// the work order form, built like the lecture's ExpenseForm: one inputs object in state, every field shaped
// { value, isValid, errorText }, typing clears that one field's error, and submit checks everything at once
// props (the lecture's): submitButtonLabel, onCancel, onSubmit(workOrderData), defaultValues (the order when editing)
// props (Rent Well's): variant (see WorkOrderPlaceFields), isEditing, showLandlordFields (contractor and estimate),
//   showDate, readOnlyText (title and description can't change, a real-mode edit), showPhotos, multiplePhotos,
//   the place lists (properties, ownerProperties, tenancies, meStatus, onRetryMe, placeText),
//   submitting, progressText, submitError, onDirtyChange(is_dirty), insets, keyboardOffset, today

export const invalid_summary = 'Invalid input values, please check your data';

// the text boxes from top to bottom, so "next" on the keyboard knows where to go
const text_order = [
  'tenantName',
  'property',
  'unit',
  'title',
  'description',
  'contractor',
  'estimate',
  'date',
];
// every field in the order it shows on screen, so the first error is the highest one
const screen_order = [
  'tenantName',
  'property',
  'propertyId',
  'unit',
  'title',
  'description',
  'priority',
  'contractor',
  'estimate',
  'date',
];

function startingEstimate(defaultValues) {
  if (!defaultValues || defaultValues.estimate === null || defaultValues.estimate === undefined) {
    return '';
  }
  // the order keeps dollars, so I turn it into whole cents once and let the cents helper write the text
  return centsToInputText(Math.round(Number(defaultValues.estimate) * 100));
}

function startingPhotoUri(defaultValues) {
  return defaultValues && defaultValues.photo && defaultValues.photo.uri
    ? defaultValues.photo.uri
    : null;
}

function WorkOrderForm(props) {
  const defaultValues = props.defaultValues;
  const today = props.today || todayString();
  const insets = props.insets || { bottom: 0, left: 0, right: 0 };

  // step 1: one state object for the whole form, each field starts from the order when editing
  const [inputs, setInputs] = useState({
    title: { value: defaultValues ? defaultValues.title || '' : '', isValid: true, errorText: '' },
    description: {
      value: defaultValues ? defaultValues.description || '' : '',
      isValid: true,
      errorText: '',
    },
    priority: {
      value: defaultValues ? defaultValues.priority || 'Normal' : '',
      isValid: true,
      errorText: '',
    },
    contractor: {
      value: defaultValues ? defaultValues.contractor || '' : '',
      isValid: true,
      errorText: '',
    },
    estimate: { value: startingEstimate(defaultValues), isValid: true, errorText: '' },
    date: {
      value: defaultValues ? defaultValues.preferred_date || '' : '',
      isValid: true,
      errorText: '',
    },
    tenantName: {
      value: defaultValues ? defaultValues.tenant || '' : '',
      isValid: true,
      errorText: '',
    },
    property: {
      value: defaultValues ? defaultValues.property || '' : '',
      isValid: true,
      errorText: '',
    },
    propertyId: { value: null, isValid: true, errorText: '' },
    unit: { value: '', isValid: true, errorText: '' },
    tenantUserId: { value: null, isValid: true, errorText: '' },
    tenancyId: { value: null, isValid: true, errorText: '' },
    photos: { value: [], isValid: true, errorText: '' },
    photoUri: { value: startingPhotoUri(defaultValues), isValid: true, errorText: '' },
  });
  // a copy of where the form started, so I can tell if anything changed (for the discard prompt)
  const [starting_inputs] = useState(inputs);

  const scroll_ref = useRef(null);
  const field_refs = useRef({});
  const field_y = useRef({});

  // which fields this form shows and can change, they're the only ones the rules check
  const shows_place_text = props.variant === 'local_owner';
  const shows_owner_pickers = props.variant === 'remote_owner' && !props.isEditing;
  const checked = [
    ...(props.readOnlyText ? [] : ['title', 'description']),
    'priority',
    ...(props.showLandlordFields ? ['contractor', 'estimate'] : []),
    ...(props.showDate ? ['date'] : []),
    ...(shows_place_text ? ['tenantName', 'property'] : []),
    ...(shows_owner_pickers ? ['propertyId', 'unit'] : []),
  ];
  const editable_text = text_order.filter(
    (field) => checked.includes(field) && field !== 'propertyId',
  );

  const is_dirty = Object.keys(inputs).some(
    (key) => JSON.stringify(inputs[key].value) !== JSON.stringify(starting_inputs[key].value),
  );
  // the screen needs to know for the "Discard changes?" prompt
  const onDirtyChange = props.onDirtyChange;
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(is_dirty);
    }
  }, [is_dirty, onDirtyChange]);

  // step 2: one change handler for every field, typing in a field clears only that field's error
  function inputChangeHandler(inputIdentifier, enteredValue) {
    setInputs((curInputs) => {
      return {
        ...curInputs,
        [inputIdentifier]: { value: enteredValue, isValid: true, errorText: '' },
      };
    });
  }

  // picking a tenant also fills in their unit, picking them again unlinks them
  function chooseOwnerTenant(owner_property, tenant_id) {
    if (inputs.tenantUserId.value === tenant_id) {
      inputChangeHandler('tenantUserId', null);
      return;
    }
    const tenancy = owner_property.tenancies.find((item) => item.tenant_id === tenant_id);
    inputChangeHandler('tenantUserId', tenant_id);
    inputChangeHandler('unit', tenancy && tenancy.unit_label ? tenancy.unit_label : '');
  }

  function choosePropertyId(property_id) {
    inputChangeHandler('propertyId', property_id);
    inputChangeHandler('tenantUserId', null);
  }

  function focusField(field) {
    const input = field_refs.current[field];
    if (input && input.focus) {
      input.focus();
    }
  }

  // the ref, the spot on screen, and the keyboard's return key for one text box
  // "next" moves to the box below it, the last one says "done" and closes the keyboard
  function fieldProps(field) {
    const position = editable_text.indexOf(field);
    const next_field = position === -1 ? null : editable_text[position + 1];
    return {
      ref: (element) => {
        field_refs.current[field] = element;
      },
      onLayout: (event) => {
        field_y.current[field] = event.nativeEvent.layout.y;
      },
      returnConfig: next_field
        ? {
            returnKeyType: 'next',
            submitBehavior: 'submit',
            onSubmitEditing: () => focusField(next_field),
          }
        : { returnKeyType: 'done', submitBehavior: 'blurAndSubmit' },
    };
  }

  // scrolls up to the first field with an error, puts the cursor in it, and tells a screen reader what's wrong
  function showFirstError(checks) {
    const first = screen_order.find((field) => checks[field] && !checks[field].isValid);
    if (!first) {
      return;
    }
    const y = field_y.current[first];
    if (scroll_ref.current && typeof y === 'number') {
      scroll_ref.current.scrollTo({ y: Math.max(0, y - SPACING.md), animated: true });
    }
    focusField(first);
    AccessibilityInfo.announceForAccessibility(invalid_summary + '. ' + checks[first].errorText);
  }

  // the place fields get the same { value, isValid, errorText } shape, written once here
  function checkedField(curInputs, field, check) {
    return { value: curInputs[field].value, isValid: check.isValid, errorText: check.errorText };
  }

  // step 3: on submit, build the data, check every rule, and only hand it to the screen when it all passes
  function submitHandler() {
    const estimate_cents = estimateToCents(inputs.estimate.value);
    const tenancies = props.tenancies || [];
    const workOrderData = {
      title: inputs.title.value.trim(),
      description: inputs.description.value.trim(),
      priority: inputs.priority.value,
      contractor: inputs.contractor.value.trim(),
      estimate_cents: estimate_cents,
      preferred_date: inputs.date.value.trim(),
      tenant: inputs.tenantName.value.trim(),
      property: inputs.property.value.trim(),
      property_id: inputs.propertyId.value,
      unit_label: inputs.unit.value.trim(),
      tenant_user_id: inputs.tenantUserId.value,
      // the first rental is picked unless the tenant chose another one
      tenancy_id: inputs.tenancyId.value || (tenancies.length > 0 ? tenancies[0].id : null),
      photos: inputs.photos.value,
      photo_uri: inputs.photoUri.value,
      photo_changed: inputs.photoUri.value !== starting_inputs.photoUri.value,
    };

    const checks = validateWorkOrder(
      {
        title: inputs.title.value,
        description: inputs.description.value,
        priority: inputs.priority.value,
        contractor: inputs.contractor.value,
        estimate: inputs.estimate.value,
        date: inputs.date.value,
        tenantName: inputs.tenantName.value,
        property: inputs.property.value,
        propertyId: inputs.propertyId.value,
        unit: inputs.unit.value,
      },
      { checked: checked, isEditing: !!props.isEditing, today: today },
    );
    const titleIsValid = checks.title.isValid;
    const descriptionIsValid = checks.description.isValid;
    const priorityIsValid = checks.priority.isValid;
    const contractorIsValid = checks.contractor.isValid;
    const estimateIsValid = checks.estimate.isValid;
    const dateIsValid = checks.date.isValid;
    const placeIsValid =
      checks.tenantName.isValid &&
      checks.property.isValid &&
      checks.propertyId.isValid &&
      checks.unit.isValid;

    if (
      !titleIsValid ||
      !descriptionIsValid ||
      !priorityIsValid ||
      !contractorIsValid ||
      !estimateIsValid ||
      !dateIsValid ||
      !placeIsValid
    ) {
      // step 4: something failed, so every field gets its own { value, isValid, errorText } and nothing is saved
      setInputs((curInputs) => {
        return {
          ...curInputs,
          title: {
            value: curInputs.title.value,
            isValid: titleIsValid,
            errorText: checks.title.errorText,
          },
          description: {
            value: curInputs.description.value,
            isValid: descriptionIsValid,
            errorText: checks.description.errorText,
          },
          priority: {
            value: curInputs.priority.value,
            isValid: priorityIsValid,
            errorText: checks.priority.errorText,
          },
          contractor: {
            value: curInputs.contractor.value,
            isValid: contractorIsValid,
            errorText: checks.contractor.errorText,
          },
          estimate: {
            value: curInputs.estimate.value,
            isValid: estimateIsValid,
            errorText: checks.estimate.errorText,
          },
          date: {
            value: curInputs.date.value,
            isValid: dateIsValid,
            errorText: checks.date.errorText,
          },
          tenantName: checkedField(curInputs, 'tenantName', checks.tenantName),
          property: checkedField(curInputs, 'property', checks.property),
          propertyId: checkedField(curInputs, 'propertyId', checks.propertyId),
          unit: checkedField(curInputs, 'unit', checks.unit),
        };
      });
      showFirstError(checks);
      return;
    }

    // step 5: everything passed, the screen decides where it gets saved
    props.onSubmit(workOrderData);
  }

  // the lecture's one summary line above the buttons, on whenever any field has an error
  const formIsInvalid = Object.keys(inputs).some((key) => !inputs[key].isValid);
  const read_only_hint = "This can't be changed after the work order is created.";

  return (
    // iOS doesn't resize the app when the keyboard opens, so it needs padding; Android already moves the content up on its own
    <KeyboardAvoidingView
      keyboardVerticalOffset={props.keyboardOffset || 0}
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scroll_ref}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: insets.bottom + SPACING.lg,
            paddingLeft: insets.left + SPACING.lg,
            paddingRight: insets.right + SPACING.lg,
          },
        ]}
      >
        {/* I cap the width so the form doesn't stretch edge to edge on a tablet */}
        <View style={styles.form}>
          <WorkOrderPlaceFields
            variant={props.variant}
            inputs={inputs}
            onChange={(field, value) =>
              field === 'propertyId' ? choosePropertyId(value) : inputChangeHandler(field, value)
            }
            onChooseTenant={chooseOwnerTenant}
            fieldProps={fieldProps}
            isEditing={props.isEditing}
            placeText={props.placeText}
            properties={props.properties || []}
            ownerProperties={props.ownerProperties || []}
            tenancies={props.tenancies || []}
            meStatus={props.meStatus}
            onRetryMe={props.onRetryMe}
          />

          <View onLayout={fieldProps('title').onLayout}>
            <Input
              label="Title"
              invalid={!inputs.title.isValid}
              errorText={inputs.title.errorText}
              helperText={props.readOnlyText ? read_only_hint : undefined}
              textInputConfig={{
                ref: fieldProps('title').ref,
                value: inputs.title.value,
                onChangeText: inputChangeHandler.bind(this, 'title'),
                placeholder: 'e.g. Kitchen faucet leaking',
                maxLength: title_max,
                autoCapitalize: 'sentences',
                editable: !props.readOnlyText,
                ...fieldProps('title').returnConfig,
              }}
            />
          </View>

          <View onLayout={fieldProps('description').onLayout}>
            <Input
              label="Description"
              invalid={!inputs.description.isValid}
              errorText={inputs.description.errorText}
              helperText={props.readOnlyText ? read_only_hint : undefined}
              counter={
                props.readOnlyText
                  ? undefined
                  : { count: inputs.description.value.length, max: description_max }
              }
              textInputConfig={{
                ref: fieldProps('description').ref,
                value: inputs.description.value,
                onChangeText: inputChangeHandler.bind(this, 'description'),
                placeholder: 'What happened, where, and since when?',
                multiline: true,
                maxLength: description_max,
                autoCapitalize: 'sentences',
                editable: !props.readOnlyText,
              }}
            />
          </View>

          <View onLayout={fieldProps('priority').onLayout}>
            <ChoiceChips
              label="How urgent is it?"
              options={priority_options.map((option) => ({
                key: option,
                label: option,
                spoken: option + ' priority',
              }))}
              selected={inputs.priority.value}
              onSelect={inputChangeHandler.bind(this, 'priority')}
              invalid={!inputs.priority.isValid}
              errorText={inputs.priority.errorText}
            />
          </View>

          {props.showLandlordFields && (
            <>
              <View onLayout={fieldProps('contractor').onLayout}>
                <Input
                  label="Contractor (optional)"
                  invalid={!inputs.contractor.isValid}
                  errorText={inputs.contractor.errorText}
                  textInputConfig={{
                    ref: fieldProps('contractor').ref,
                    value: inputs.contractor.value,
                    onChangeText: inputChangeHandler.bind(this, 'contractor'),
                    placeholder: 'Who is doing the work?',
                    maxLength: contractor_max,
                    autoCapitalize: 'words',
                    ...fieldProps('contractor').returnConfig,
                  }}
                />
              </View>
              <View onLayout={fieldProps('estimate').onLayout}>
                <Input
                  label="Estimated cost (optional)"
                  invalid={!inputs.estimate.isValid}
                  errorText={inputs.estimate.errorText}
                  helperText="Dollars, from 0 to 100,000."
                  textInputConfig={{
                    ref: fieldProps('estimate').ref,
                    value: inputs.estimate.value,
                    onChangeText: inputChangeHandler.bind(this, 'estimate'),
                    placeholder: 'e.g. 250.00',
                    keyboardType: 'decimal-pad',
                    // 100000.00 is 9 characters, the extra room lets a too-big number show its message
                    maxLength: 12,
                    ...fieldProps('estimate').returnConfig,
                  }}
                />
              </View>
            </>
          )}

          {props.showDate && (
            <View onLayout={fieldProps('date').onLayout}>
              <DateInput
                label="Preferred date (optional)"
                value={inputs.date.value}
                onChangeText={inputChangeHandler.bind(this, 'date')}
                invalid={!inputs.date.isValid}
                errorText={inputs.date.errorText}
                helperText="When would you like someone to come by?"
                minimumDate={props.isEditing ? undefined : today}
                maximumDate={oneYearFrom(today)}
                textInputRef={fieldProps('date').ref}
                returnKeyType={fieldProps('date').returnConfig.returnKeyType}
                onSubmitEditing={fieldProps('date').returnConfig.onSubmitEditing}
              />
            </View>
          )}

          {props.showPhotos && (
            <WorkOrderPhotos
              multiple={props.multiplePhotos}
              photos={inputs.photos.value}
              onChangePhotos={inputChangeHandler.bind(this, 'photos')}
              photoUri={inputs.photoUri.value}
              onChangePhotoUri={inputChangeHandler.bind(this, 'photoUri')}
            />
          )}

          {formIsInvalid && (
            <View style={styles.summary_row}>
              <Ionicons name="alert-circle-outline" size={SIZES.icon} color={COLORS.danger_text} />
              <Text style={styles.errorText} accessibilityRole="alert">
                {invalid_summary}
              </Text>
            </View>
          )}
          {props.submitError ? (
            <View style={styles.summary_row}>
              <Ionicons name="cloud-offline-outline" size={SIZES.icon} color={COLORS.danger_text} />
              <Text style={styles.errorText} accessibilityRole="alert">
                {props.submitError}
              </Text>
            </View>
          ) : null}
          {props.submitting && props.progressText ? (
            <Text style={styles.helper}>{props.progressText}</Text>
          ) : null}

          <View style={styles.buttons}>
            <PrimaryButton
              title="Cancel"
              variant="tertiary"
              onPress={props.onCancel}
              style={styles.button}
            />
            <PrimaryButton
              title={props.submitting ? 'Saving...' : props.submitButtonLabel}
              variant="primary"
              loading={props.submitting}
              onPress={props.submitting ? undefined : submitHandler}
              accessibilityLabel={props.submitButtonLabel + ' work order'}
              style={styles.button}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default WorkOrderForm;

const styles = themedStyles((COLORS) => ({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: SPACING.md,
  },
  form: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  summary_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorText: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    flexShrink: 1,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    marginHorizontal: 0,
  },
}));

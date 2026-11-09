import { useState, useLayoutEffect, useRef, useCallback } from 'react';
import { View, Text, Alert, Platform } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import PrimaryButton from '../../../components/PrimaryButton';
import WorkOrderForm from '../components/WorkOrderForm';
import { useWorkOrders } from '../../../store/WorkOrdersContext';
import { useTenants } from '../../../store/TenantsContext';
import { useAppRole } from '../../auth/hooks/useAppRole';
import { useToast } from '../../../components/ui/Toast';
import { hapticSuccess } from '../../../util/haptics';
import { editRuleFor } from '../utils/workOrderHelpers';
import { placeLabel } from '../../tenants/utils/tenantHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { headerTitle } from '../../../navigation/navigationMap';
import { SPACING, TYPE, SIZES } from '../../../constants/theme';
import { themedStyles } from '../../../util/themedStyles';
import { withDataScreen } from '../../../components/ui/DataScreen';

// asks before throwing away typed changes, the web has no Alert buttons so it uses the browser's confirm
function confirmDiscard(onDiscard) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm && globalThis.confirm('Discard changes? Your edits will be lost.')) {
      onDiscard();
    }
    return;
  }
  Alert.alert('Discard changes?', 'You have changes that are not saved yet.', [
    { text: 'Keep Editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: onDiscard },
  ]);
}

// the lecture's ManageExpense: one screen adds a work order or edits one, the workOrderId param says which
// it keeps the route name NewWorkOrder so the header buttons, push taps, and the navigation map still find it
function NewWorkOrderScreen(props) {
  const editedWorkOrderId = props.route.params ? props.route.params.workOrderId : undefined;
  const isEditing = !!editedWorkOrderId;

  const {
    addWorkOrder,
    updateWorkOrder,
    getOrder,
    properties,
    is_remote,
    role,
    demo_mode,
    demo_role,
  } = useWorkOrders();
  const app_role = useAppRole();
  const selectedWorkOrder = isEditing ? getOrder(editedWorkOrderId) : undefined;
  const toast = useToast();

  // in real mode a tenant's property, unit, and name come from their account, so those boxes go away
  const tenant_remote = is_remote && role === 'tenant';
  // a real owner picks the property (and optionally the tenant) from their own list, the Work Orders Add button opens this
  const owner_remote = is_remote && role === 'owner';
  const {
    properties: owner_properties,
    my_active_tenancies,
    status: tenants_status,
    refresh: refreshTenants,
  } = useTenants();
  // the tenant demo is Sam, so the name and place fill in from Sam's rental in the demo data, like real mode does
  const tenant_demo = demo_mode && demo_role === 'tenant';
  const demo_place =
    my_active_tenancies.length > 0
      ? placeLabel(my_active_tenancies[0].property_name, my_active_tenancies[0].unit_label)
      : null;
  // the header is hidden, so I push the content below the status bar and notch myself
  const insets = useSafeAreaInsets();
  // the header sits above this screen now, so the keyboard lift has to count its height too
  const header_height = useHeaderHeight();

  let variant = 'local_owner';
  if (tenant_remote) {
    variant = 'remote_tenant';
  } else if (owner_remote) {
    variant = 'remote_owner';
  } else if (tenant_demo) {
    variant = 'demo_tenant';
  }
  const is_owner = app_role !== 'tenant';
  const edit_rule = editRuleFor(selectedWorkOrder, {
    role: is_owner ? 'owner' : 'tenant',
    is_own: tenant_demo && selectedWorkOrder ? selectedWorkOrder.tenant === demo_tenant.name : true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [progress_text, setProgressText] = useState('');
  const [submit_error, setSubmitError] = useState('');
  const [is_dirty, setIsDirty] = useState(false);
  // set right before leaving after a save, so the discard prompt never shows for a saved form
  const allow_leave = useRef(false);
  // the tenant's rentals come from the tenants store (the same tenancies Firebase holds), almost always just one
  // the form reads them in the old server's shape, so each one gets a small property object
  const tenancies = tenant_remote
    ? my_active_tenancies.map((tenancy) => ({
        id: tenancy.id,
        property: { name: tenancy.property_name },
        unitLabel: tenancy.unit_label,
      }))
    : [];
  // loading, ready, or error for the rental lookup
  const me_status = tenants_status;

  // step 1: the title says Add or Edit, from the navigation map like every other header
  useLayoutEffect(() => {
    props.navigation.setOptions({ title: headerTitle('NewWorkOrder', props.route.params) });
  }, [props.navigation, props.route.params]);

  // step 2: leaving with unsaved changes (Cancel, the back button, a swipe, Android's back) asks first
  usePreventRemove(is_dirty, (event) => {
    if (allow_leave.current) {
      props.navigation.dispatch(event.data.action);
      return;
    }
    confirmDiscard(() => props.navigation.dispatch(event.data.action));
  });

  const onDirtyChange = useCallback((value) => setIsDirty(value), []);

  function cancelHandler() {
    props.navigation.goBack();
  }

  // the form's clean data turned into what each mode's addWorkOrder expects
  function buildRequest(workOrderData) {
    const estimate =
      workOrderData.estimate_cents === null ? null : workOrderData.estimate_cents / 100;
    if (tenant_remote) {
      return {
        title: workOrderData.title,
        description: workOrderData.description,
        priority: workOrderData.priority,
        // only needed when there's more than one rental to pick from
        tenancy_id: tenancies.length > 1 ? workOrderData.tenancy_id : undefined,
        preferred_date: workOrderData.preferred_date,
      };
    }
    if (owner_remote) {
      return {
        property_id: workOrderData.property_id,
        title: workOrderData.title,
        description: workOrderData.description,
        priority: workOrderData.priority,
        unit_label: workOrderData.unit_label,
        tenant_user_id: workOrderData.tenant_user_id,
        contractor: workOrderData.contractor,
        estimate: estimate,
        preferred_date: workOrderData.preferred_date,
      };
    }
    // the demo tenant's version: it goes in the demo's shared list, so the landlord side sees it as Open
    // after switching, and the photo stays on the phone like the rest of the demo
    if (tenant_demo) {
      return {
        title: workOrderData.title,
        description: workOrderData.description,
        property: demo_place,
        tenant: demo_tenant.name,
        priority: workOrderData.priority,
        photo: workOrderData.photo_uri ? { uri: workOrderData.photo_uri } : null,
        preferred_date: workOrderData.preferred_date,
      };
    }
    return {
      title: workOrderData.title,
      description: workOrderData.description,
      property: workOrderData.property,
      tenant: workOrderData.tenant,
      priority: workOrderData.priority,
      photo: workOrderData.photo_uri ? { uri: workOrderData.photo_uri } : null,
      contractor: workOrderData.contractor,
      estimate: estimate,
      preferred_date: workOrderData.preferred_date,
    };
  }

  // only the fields this mode can change go into an update
  function buildChanges(workOrderData) {
    const estimate =
      workOrderData.estimate_cents === null ? null : workOrderData.estimate_cents / 100;
    // Firebase has no server limits, so a landlord changes every field and a tenant changes their own while it's Open
    if (is_remote) {
      const remote_changes = {
        title: workOrderData.title,
        description: workOrderData.description,
        priority: workOrderData.priority,
        preferred_date: workOrderData.preferred_date,
      };
      if (is_owner) {
        remote_changes.contractor = workOrderData.contractor;
        remote_changes.estimate = estimate;
      }
      return remote_changes;
    }
    const changes = {
      title: workOrderData.title,
      description: workOrderData.description,
      priority: workOrderData.priority,
      preferred_date: workOrderData.preferred_date,
    };
    if (is_owner) {
      changes.tenant = workOrderData.tenant;
      changes.property = workOrderData.property;
      changes.contractor = workOrderData.contractor;
      changes.estimate = estimate;
    }
    if (workOrderData.photo_changed) {
      changes.photo = workOrderData.photo_uri ? { uri: workOrderData.photo_uri } : null;
    }
    return changes;
  }

  // step 3: save through the shared context, add or update, then go back like the lecture does
  // in real mode a failed save keeps the form open with everything still filled in
  async function confirmHandler(workOrderData) {
    if (tenant_remote && !isEditing && tenancies.length === 0) {
      setSubmitError("Your account isn't linked to a rental yet. Ask your landlord for an invite.");
      return;
    }
    if (tenant_demo && !isEditing && !demo_place) {
      setSubmitError("Sam doesn't have an active rental in the demo right now.");
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateWorkOrder(editedWorkOrderId, buildChanges(workOrderData));
      } else {
        await addWorkOrder(buildRequest(workOrderData));
      }
    } catch (error) {
      console.log('Could not save the work order', error.message);
      // everything stays filled in so it can be sent again
      setSubmitError((isEditing ? 'Not updated: ' : 'Not sent: ') + error.message);
      setProgressText('');
      setSubmitting(false);
      return;
    }
    setProgressText('');
    setSubmitting(false);
    hapticSuccess();
    if (isEditing) {
      toast.show(is_owner ? 'Work order updated' : 'Request updated', 'checkmark-circle-outline');
    } else if (tenant_demo) {
      toast.show('Request sent. Switch to the Landlord view to see it.', 'send-outline');
    } else if (!is_owner) {
      toast.show('Request sent. Your landlord will see it in their work orders.', 'send-outline');
    } else {
      toast.show('Work order added', 'checkmark-circle-outline');
    }
    allow_leave.current = true;
    // a tenant's new request opens their list so they can see it, everything else goes back
    if (!isEditing && !is_owner) {
      props.navigation.replace('MyRequests');
    } else {
      props.navigation.goBack();
    }
  }

  // editing something that's gone or locked shows why instead of a form that can't save
  if (isEditing && (!selectedWorkOrder || !edit_rule.canEdit)) {
    return (
      <View style={styles.message_screen}>
        <Text style={styles.message_text}>
          {!selectedWorkOrder ? 'That work order could not be found.' : edit_rule.reason}
        </Text>
        <PrimaryButton title="Back" variant="secondary" onPress={cancelHandler} />
      </View>
    );
  }

  return (
    <WorkOrderForm
      submitButtonLabel={isEditing ? 'Update' : 'Add'}
      onCancel={cancelHandler}
      onSubmit={confirmHandler}
      defaultValues={selectedWorkOrder}
      isEditing={isEditing}
      variant={variant}
      showLandlordFields={is_owner}
      // the preferred date is saved on the Firebase record too now, so it shows in both modes
      showDate={true}
      readOnlyText={false}
      // photos wait for Firebase Storage, so only the demo shows the photo picker
      showPhotos={!is_remote}
      multiplePhotos={false}
      properties={properties}
      ownerProperties={owner_properties}
      tenancies={tenancies}
      meStatus={me_status}
      onRetryMe={refreshTenants}
      placeText={
        isEditing
          ? selectedWorkOrder.property
          : demo_place
            ? demo_tenant.name + ', ' + demo_place
            : null
      }
      submitting={submitting}
      progressText={progress_text}
      submitError={submit_error}
      onDirtyChange={onDirtyChange}
      insets={insets}
      keyboardOffset={header_height}
    />
  );
}

// never blank while the Firebase data loads: a spinner, then the error with Try Again, or a banner
export default withDataScreen(NewWorkOrderScreen, {
  stores: ['tenants'],
  label: 'Loading your properties and rentals',
});

const styles = themedStyles((COLORS) => ({
  message_screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screen_padding,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  message_text: {
    ...TYPE.body,
    color: COLORS.text,
  },
}));

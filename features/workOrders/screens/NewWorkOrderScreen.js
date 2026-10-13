import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import PrimaryButton from '../../../components/PrimaryButton';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import { getMe } from '../../../services/api';
import { max_photos_per_upload } from '../utils/workOrderHelpers';
import { placeLabel } from '../../tenants/utils/tenantHelpers';
import { demo_tenant } from '../../tenants/data/sampleTenants';
import { COLORS, SPACING, FONTS } from '../../../theme';

const urgency_options = ['Emergency', 'Normal', 'Low'];
// the server takes photos up to 10 MB
const max_photo_bytes = 10485760;

function NewWorkOrderScreen(props) {
  const { addWorkOrder, properties, is_remote, role, demo_mode, demo_role } = useWorkOrders();
  // in real mode a tenant's property, unit, and name come from their account, so those boxes go away
  const tenant_remote = is_remote && role === 'tenant';
  // a real owner picks the property (and optionally the tenant) from their own list, the Work Orders Add button opens this
  const owner_remote = is_remote && role === 'owner';
  // both real versions keep a list of up to 5 photos that get uploaded
  const remote_form = tenant_remote || owner_remote;
  const { properties: owner_properties, my_active_tenancies } = useTenants();
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
  // I check the screen shape so the photo can shrink when it's wider than it is tall
  const { width, height } = useWindowDimensions();
  const is_landscape = width > height;

  // everything the tenant types or picks stays in state until they submit
  const [tenant_name, setTenantName] = useState('');
  const [property, setProperty] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [photo_uri, setPhotoUri] = useState(null);
  // real mode takes up to 5 photos, each one is { uri, mime_type }
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress_text, setProgressText] = useState('');
  // the tenant's rentals from GET /me, almost always just one
  const [tenancies, setTenancies] = useState([]);
  const [tenancy_id, setTenancyId] = useState(null);
  // loading, ready, or error for the rental lookup
  const [me_status, setMeStatus] = useState('loading');
  const [me_attempt, setMeAttempt] = useState(0);
  // the owner's choices: which property, which unit, and which tenant (all but the property are optional)
  const [owner_property_id, setOwnerPropertyId] = useState(null);
  const [owner_unit, setOwnerUnit] = useState('');
  const [owner_tenant_id, setOwnerTenantId] = useState(null);
  const owner_property = owner_properties.find((item) => item.id === owner_property_id);

  // picking a tenant also fills in their unit, picking them again unlinks them
  function chooseOwnerTenant(tenancy) {
    if (owner_tenant_id === tenancy.tenant_id) {
      setOwnerTenantId(null);
      return;
    }
    setOwnerTenantId(tenancy.tenant_id);
    setOwnerUnit(tenancy.unit_label || '');
  }

  useEffect(() => {
    if (!tenant_remote) {
      return undefined;
    }
    let active = true;
    getMe()
      .then((me) => {
        if (!active) {
          return;
        }
        // the server renamed tenancies to activeTenancies, only active ones can file a request
        const list = me.activeTenancies || me.tenancies || [];
        setTenancies(list);
        setTenancyId(list.length > 0 ? list[0].id : null);
        setMeStatus('ready');
      })
      .catch((error) => {
        console.log('Could not load the rental', error.message);
        if (active) {
          setMeStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [tenant_remote, me_attempt]);

  // real mode keeps a list of photos, anything over 10 MB gets turned away
  function keepPhotos(assets) {
    const room = max_photos_per_upload - photos.length;
    const fitting = assets.filter((asset) => !asset.fileSize || asset.fileSize <= max_photo_bytes);
    if (fitting.length < assets.length) {
      Alert.alert('Photo too large', 'Photos have to be under 10 MB.');
    }
    setPhotos((current) => [
      ...current,
      ...fitting
        .slice(0, room)
        .map((asset) => ({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' })),
    ]);
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((photo, photo_index) => photo_index !== index));
  }

  // I have to ask for camera permission before the camera can open
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      if (remote_form) {
        keepPhotos(result.assets);
      } else {
        setPhotoUri(result.assets[0].uri);
      }
    }
  }

  async function choosePhoto() {
    // real mode can pick several at once, up to what's left of the 5
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: remote_form,
      selectionLimit: remote_form ? max_photos_per_upload - photos.length : 1,
    });
    if (!result.canceled) {
      if (remote_form) {
        keepPhotos(result.assets);
      } else {
        setPhotoUri(result.assets[0].uri);
      }
    }
  }

  // real mode: the photos upload first, then the request goes to the landlord
  async function submitToServer() {
    if (title.trim() === '') {
      Alert.alert('Describe the issue', 'Add a short title, like Kitchen faucet leaking.');
      return;
    }
    if (title.trim().length > 120) {
      Alert.alert('Shorten the title', 'Keep the title under 120 characters.');
      return;
    }
    if (tenancies.length === 0) {
      Alert.alert(
        'No rental found',
        "Your account isn't linked to a rental yet. Ask your landlord for an invite.",
      );
      return;
    }
    setBusy(true);
    try {
      await addWorkOrder(
        {
          title: title.trim(),
          description: description.trim(),
          priority: priority,
          photos: photos,
          // only needed when there's more than one rental to pick from
          tenancy_id: tenancies.length > 1 ? tenancy_id : undefined,
        },
        (number, total) => setProgressText('Uploading photo ' + number + ' of ' + total + '...'),
      );
      Alert.alert('Request submitted', 'Your landlord has been notified.', [
        { text: 'OK', onPress: () => props.navigation.replace('MyRequests') },
      ]);
    } catch (error) {
      console.log('Could not submit the request', error.message);
      // everything stays filled in so it can be sent again
      Alert.alert('Request not sent', error.message);
    }
    setProgressText('');
    setBusy(false);
  }

  // the owner's version: the property comes from the chips, then the photos upload and the order is created
  async function submitOwnerOrder() {
    if (!owner_property_id) {
      Alert.alert('Pick a property', 'Choose which property this work order is for.');
      return;
    }
    if (title.trim() === '' || title.trim().length > 120) {
      Alert.alert('Describe the issue', 'Add a short title (up to 120 characters).');
      return;
    }
    if (owner_unit.trim().length > 50) {
      Alert.alert('Shorten the unit', 'Keep the unit under 50 characters.');
      return;
    }
    setBusy(true);
    try {
      await addWorkOrder(
        {
          property_id: owner_property_id,
          title: title.trim(),
          description: description.trim(),
          priority: priority,
          photos: photos,
          unit_label: owner_unit.trim(),
          tenant_user_id: owner_tenant_id,
        },
        (number, total) => setProgressText('Uploading photo ' + number + ' of ' + total + '...'),
      );
      Alert.alert('Work order added', 'It shows up in Work Orders as Open.', [
        { text: 'OK', onPress: () => props.navigation.goBack() },
      ]);
    } catch (error) {
      console.log('Could not add the work order', error.message);
      // everything stays filled in so it can be sent again
      Alert.alert('Work order not added', error.message);
    }
    setProgressText('');
    setBusy(false);
  }

  // the demo tenant's version: it goes in the demo's shared list, so the landlord side sees it as Open
  // after switching, and the photo stays on the phone like the rest of the demo
  function submitDemoRequest() {
    if (title.trim() === '') {
      Alert.alert('Describe the issue', 'Add a short title, like Kitchen faucet leaking.');
      return;
    }
    if (!demo_place) {
      Alert.alert('No rental found', "Sam doesn't have an active rental in the demo right now.");
      return;
    }
    addWorkOrder({
      title: title.trim(),
      description: description.trim(),
      property: demo_place,
      tenant: demo_tenant.name,
      priority: priority,
      photo: photo_uri ? { uri: photo_uri } : null,
    });
    Alert.alert('Request submitted', 'Switch to the Landlord view to see it in Work Orders.', [
      { text: 'OK', onPress: () => props.navigation.replace('MyRequests') },
    ]);
  }

  // I check the required pieces first so an empty request never gets submitted
  function handleSubmit() {
    if (tenant_remote) {
      submitToServer();
      return;
    }
    if (owner_remote) {
      submitOwnerOrder();
      return;
    }
    if (tenant_demo) {
      submitDemoRequest();
      return;
    }
    if (tenant_name.trim() === '') {
      Alert.alert('Add your name', 'Type your name so the landlord knows who sent it.');
      return;
    }
    if (property.trim() === '') {
      Alert.alert('Add the property', 'Pick your property or type it in.');
      return;
    }
    if (title.trim() === '') {
      Alert.alert('Describe the issue', 'Add a short title, like Kitchen faucet leaking.');
      return;
    }
    addWorkOrder({
      title: title.trim(),
      description: description.trim(),
      property: property.trim(),
      tenant: tenant_name.trim(),
      priority: priority,
      photo: photo_uri ? { uri: photo_uri } : null,
    });
    Alert.alert('Request submitted', 'Your work order was added.', [
      { text: 'OK', onPress: () => props.navigation.goBack() },
    ]);
  }

  return (
    // iOS doesn't resize the app when the keyboard opens, so it needs padding; Android already moves the content up on its own
    <KeyboardAvoidingView
      keyboardVerticalOffset={header_height}
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: SPACING.md,
            paddingBottom: insets.bottom + SPACING.lg,
            paddingLeft: insets.left + SPACING.lg,
            paddingRight: insets.right + SPACING.lg,
          },
        ]}
      >
        {/* I cap the width so the form doesn't stretch edge to edge on a tablet */}
        <View style={styles.form}>
          {/* an owner signed in for real can't file a tenant request, the dashboard hides the button but this is a backup */}
          {/* it's the owner's own work order form now, opened from the Add button on Work Orders */}
          {owner_remote ? (
            <View>
              <Text style={styles.label}>Property</Text>
              {owner_properties.length === 0 ? (
                <Text style={styles.notice}>
                  Add a property first from Tenants, then Properties.
                </Text>
              ) : (
                <View style={styles.chip_wrap}>
                  {owner_properties.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setOwnerPropertyId(item.id);
                        setOwnerTenantId(null);
                      }}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={[styles.chip, owner_property_id === item.id && styles.chip_active]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: owner_property_id === item.id }}
                    >
                      <Text style={styles.chip_text}>{item.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {owner_property && owner_property.tenancies.length > 0 && (
                <View>
                  <Text style={styles.label}>Tenant (optional)</Text>
                  <View style={styles.chip_wrap}>
                    {owner_property.tenancies.map((tenancy) => (
                      <Pressable
                        key={tenancy.id}
                        onPress={() => chooseOwnerTenant(tenancy)}
                        hitSlop={{ top: 8, bottom: 8 }}
                        style={[
                          styles.chip,
                          owner_tenant_id === tenancy.tenant_id && styles.chip_active,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: owner_tenant_id === tenancy.tenant_id }}
                      >
                        <Text style={styles.chip_text}>
                          {tenancy.tenant_name +
                            (tenancy.unit_label ? ', ' + tenancy.unit_label : '')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <Text style={styles.label}>Unit (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Unit 2B, or Exterior"
                placeholderTextColor={COLORS.text}
                value={owner_unit}
                onChangeText={setOwnerUnit}
              />
            </View>
          ) : tenant_remote ? (
            <View style={styles.rental_box}>
              <Text style={styles.label}>Reporting for</Text>
              {me_status === 'loading' && <ActivityIndicator color={COLORS.title} />}
              {me_status === 'error' && (
                <Pressable onPress={() => setMeAttempt((current) => current + 1)} hitSlop={8}>
                  <Text style={styles.link_text}>
                    {"Couldn't load your rental. Tap to try again."}
                  </Text>
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
                <View style={styles.chip_wrap}>
                  {tenancies.map((tenancy) => (
                    <Pressable
                      key={tenancy.id}
                      onPress={() => setTenancyId(tenancy.id)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={[styles.chip, tenancy_id === tenancy.id && styles.chip_active]}
                    >
                      <Text style={styles.chip_text}>
                        {tenancy.property.name +
                          (tenancy.unitLabel ? ', ' + tenancy.unitLabel : '')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : tenant_demo ? (
            <View style={styles.rental_box}>
              <Text style={styles.label}>Reporting for</Text>
              <Text style={styles.rental_text}>
                {demo_place
                  ? demo_tenant.name + ', ' + demo_place
                  : 'No active rental in the demo right now.'}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={COLORS.text}
                value={tenant_name}
                onChangeText={setTenantName}
              />

              <Text style={styles.label}>Property</Text>
              {properties.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chip_scroll}
                  contentContainerStyle={styles.chip_row}
                >
                  {properties.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => setProperty(name)}
                      style={[styles.chip, property === name && styles.chip_active]}
                    >
                      <Text style={styles.chip_text}>{name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <TextInput
                style={styles.input}
                placeholder="Pick one above or type your address"
                placeholderTextColor={COLORS.text}
                value={property}
                onChangeText={setProperty}
              />
            </View>
          )}

          <Text style={styles.label}>What's wrong?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kitchen faucet leaking"
            placeholderTextColor={COLORS.text}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Details</Text>
          <TextInput
            style={[styles.input, styles.description_input]}
            placeholder="Anything the landlord should know"
            placeholderTextColor={COLORS.text}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>How urgent is it?</Text>
          <View style={styles.chip_wrap}>
            {urgency_options.map((option) => (
              <Pressable
                key={option}
                onPress={() => setPriority(option)}
                style={[styles.chip, priority === option && styles.chip_active]}
              >
                <Text style={styles.chip_text}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {photo_uri && (
            <Image
              source={{ uri: photo_uri }}
              style={[styles.preview, is_landscape && styles.preview_landscape]}
            />
          )}
          {remote_form && photos.length > 0 && (
            <ScrollView
              horizontal
              style={styles.chip_scroll}
              contentContainerStyle={styles.thumb_row}
            >
              {photos.map((photo, index) => (
                <View key={photo.uri + index}>
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  <Pressable
                    style={styles.remove_button}
                    onPress={() => removePhoto(index)}
                    hitSlop={8}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          {remote_form && (
            <Text style={styles.helper}>
              {photos.length + ' of ' + max_photos_per_upload + ' photos'}
            </Text>
          )}
          {(!remote_form || photos.length < max_photos_per_upload) && (
            <View style={styles.button_row}>
              <PrimaryButton
                title="Camera"
                icon="camera-outline"
                onPress={takePhoto}
                style={styles.photo_button}
              />
              <PrimaryButton
                title="Library"
                icon="image-outline"
                onPress={choosePhoto}
                style={styles.photo_button}
              />
            </View>
          )}

          {busy && progress_text !== '' && <Text style={styles.helper}>{progress_text}</Text>}
          <PrimaryButton
            title={busy ? 'Sending...' : 'Submit Request'}
            icon="send-outline"
            onPress={busy ? undefined : handleSubmit}
            style={[styles.submit_button, busy && styles.busy]}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default NewWorkOrderScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  form: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.muted,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  description_input: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // without this the horizontal list grows to fill the spare height and the chips stretch with it
  chip_scroll: {
    flexGrow: 0,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip_wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.muted,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  preview_landscape: {
    height: 120,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  photo_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.secondary,
  },
  submit_button: {
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
  busy: {
    opacity: 0.7,
  },
  notice: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  rental_box: {
    backgroundColor: COLORS.muted,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  rental_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  link_text: {
    color: COLORS.action,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  thumb_row: {
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingRight: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  remove_button: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface_light,
    borderRadius: 11,
  },
});

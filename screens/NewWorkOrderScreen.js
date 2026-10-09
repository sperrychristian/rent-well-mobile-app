import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Image, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import PrimaryButton from '../components/PrimaryButton';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { COLORS, SPACING, FONTS } from '../theme';

const urgency_options = ['Emergency', 'Normal', 'Low'];

function NewWorkOrderScreen(props) {
  const { addWorkOrder, properties } = useWorkOrders();
  // the header is hidden, so I push the content below the status bar and notch myself
  const insets = useSafeAreaInsets();
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

  // I have to ask for camera permission before the camera can open
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  // I check the required pieces first so an empty request never gets submitted
  function handleSubmit() {
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING.lg,
            paddingLeft: insets.left + SPACING.lg,
            paddingRight: insets.right + SPACING.lg,
          },
        ]}
      >
        {/* I cap the width so the form doesn't stretch edge to edge on a tablet */}
        <View style={styles.form}>
          <ScreenTitle>Report an Issue</ScreenTitle>

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chip_scroll} contentContainerStyle={styles.chip_row}>
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

          {photo_uri && <Image source={{ uri: photo_uri }} style={[styles.preview, is_landscape && styles.preview_landscape]} />}
          <View style={styles.button_row}>
            <PrimaryButton title="Camera" icon="camera-outline" onPress={takePhoto} style={styles.photo_button} />
            <PrimaryButton title="Library" icon="image-outline" onPress={choosePhoto} style={styles.photo_button} />
          </View>

          <PrimaryButton
            title="Submit Request"
            icon="send-outline"
            onPress={handleSubmit}
            style={styles.submit_button}
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
});
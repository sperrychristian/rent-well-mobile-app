import { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { conditions } from '../data/checklistTemplates';
import { itemGotWorse } from '../utils/checklistHelpers';
import { getPhotoUri, saveChecklistPhoto, deleteChecklistPhoto } from '../utils/checklistPhotos';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

const max_photos = 3;

// one color per condition so they're easy to spot
const condition_colors = {
  Good: COLORS.success,
  Fair: COLORS.warning,
  Poor: COLORS.danger,
};

// props: visible, item, locked, in_demo, onSave, onDelete, onClose
// onSave gets the changed fields, a locked (signed) checklist only shows the item and can't change it
function ChecklistItemModal(props) {
  // the screen gives it a new key each time it opens, so these start from the item without an effect
  const [done, setDone] = useState(props.item ? props.item.done : false);
  const [condition, setCondition] = useState(props.item ? props.item.condition : null);
  const [note, setNote] = useState(props.item ? props.item.note || '' : '');
  const [photos, setPhotos] = useState(props.item ? props.item.photos || [] : []);
  const [full_photo, setFullPhoto] = useState(null);
  // photos copied in while the modal is open, they get deleted again if it's cancelled
  const added_photos = useRef([]);

  if (!props.item) {
    return null;
  }

  const locked = props.locked;
  const has_move_in = !!(props.item.move_in_condition || props.item.move_in_note);
  const got_worse = itemGotWorse({ move_in_condition: props.item.move_in_condition, condition });

  // tapping the chosen condition again clears it, meters and keys don't need one
  function chooseCondition(option) {
    setCondition(condition === option ? null : option);
  }

  async function keepPhoto(asset) {
    try {
      const stored_name = await saveChecklistPhoto(asset.uri, props.in_demo);
      added_photos.current.push(stored_name);
      setPhotos((current) => [...current, stored_name]);
    } catch (error) {
      console.log('Could not save checklist photo', error);
      Alert.alert('Could not save the photo', 'The photo could not be copied into the app.');
    }
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
      await keepPhoto(result.assets[0]);
    }
  }

  // the library only lets me pick as many as there's room for
  async function choosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max_photos - photos.length,
      quality: 0.7,
    });
    if (result.canceled) {
      return;
    }
    for (const asset of result.assets.slice(0, max_photos - photos.length)) {
      await keepPhoto(asset);
    }
  }

  function removePhoto(stored_name) {
    setPhotos((current) => current.filter((name) => name !== stored_name));
  }

  // photos added this time get deleted, the saved ones stay since nothing changed
  function handleCancel() {
    added_photos.current.forEach((stored_name) => deleteChecklistPhoto(stored_name, props.in_demo));
    added_photos.current = [];
    props.onClose();
  }

  // any photo that was on the item before and got removed is deleted for good now
  function handleSave() {
    (props.item.photos || [])
      .filter((stored_name) => !photos.includes(stored_name))
      .forEach((stored_name) => deleteChecklistPhoto(stored_name, props.in_demo));
    // a photo added and then removed before saving goes too
    added_photos.current
      .filter((stored_name) => !photos.includes(stored_name))
      .forEach((stored_name) => deleteChecklistPhoto(stored_name, props.in_demo));
    added_photos.current = [];
    props.onSave({ done: done, condition: condition, note: note.trim(), photos: photos });
  }

  function confirmDelete() {
    Alert.alert('Delete item?', 'This removes "' + props.item.name + '" and its photos.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // the context deletes the saved photos, I only clean up ones added this time
          added_photos.current.forEach((stored_name) =>
            deleteChecklistPhoto(stored_name, props.in_demo),
          );
          added_photos.current = [];
          props.onDelete();
        },
      },
    ]);
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={locked ? props.onClose : handleCancel}
    >
      <View style={styles.root}>
        {/* iOS needs padding to lift the form, Android already resizes the window so it uses height */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll_content}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <Text style={styles.heading}>{props.item.name}</Text>
              {got_worse && (
                <View style={styles.worse_tag}>
                  <Ionicons name="trending-down" size={14} color={COLORS.text_light} />
                  <Text style={styles.worse_text}>Changed since move-in</Text>
                </View>
              )}

              {/* side by side so the move-in and the move-out can be compared at a glance */}
              {has_move_in && (
                <View style={styles.compare_row}>
                  <View style={styles.compare_box}>
                    <Text style={styles.label}>Move-in</Text>
                    <Text style={styles.compare_value}>
                      {props.item.move_in_condition || 'No condition'}
                    </Text>
                    {props.item.move_in_note ? (
                      <Text style={styles.helper}>{props.item.move_in_note}</Text>
                    ) : null}
                  </View>
                  <View style={styles.compare_box}>
                    <Text style={styles.label}>Now</Text>
                    <Text style={[styles.compare_value, got_worse && styles.worse_value]}>
                      {condition || 'Not set'}
                    </Text>
                    {note.trim() !== '' && <Text style={styles.helper}>{note.trim()}</Text>}
                  </View>
                </View>
              )}

              <View style={styles.switch_row}>
                <Text style={[styles.label, styles.switch_text]}>Done</Text>
                <Switch value={done} onValueChange={setDone} disabled={locked} />
              </View>

              <Text style={styles.label}>Condition</Text>
              <View style={styles.wrap_row}>
                {conditions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => chooseCondition(option)}
                    disabled={locked}
                    hitSlop={{ top: 8, bottom: 8 }}
                    style={[
                      styles.chip,
                      condition === option && { backgroundColor: condition_colors[option] },
                    ]}
                  >
                    <Text
                      style={[styles.chip_text, condition === option && styles.chip_text_active]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Note</Text>
              <TextInput
                style={[styles.input, styles.notes_input]}
                placeholder="Damage, reading, key count, anything worth noting"
                placeholderTextColor={COLORS.text}
                multiline
                editable={!locked}
                value={note}
                onChangeText={setNote}
              />

              <Text style={styles.label}>
                Photos ({photos.length} of {max_photos})
              </Text>
              {photos.length > 0 && (
                <View style={styles.wrap_row}>
                  {photos.map((stored_name) => (
                    <View key={stored_name} style={styles.photo_wrap}>
                      <Pressable
                        onPress={() => setFullPhoto(stored_name)}
                        accessibilityLabel="View photo"
                      >
                        <Image
                          source={{ uri: getPhotoUri(stored_name, props.in_demo) }}
                          style={styles.photo_thumb}
                        />
                      </Pressable>
                      {!locked && (
                        <Pressable
                          style={styles.remove_button}
                          onPress={() => removePhoto(stored_name)}
                          accessibilityLabel="Remove photo"
                        >
                          <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {!locked && photos.length < max_photos && (
                <View style={styles.button_row}>
                  <PrimaryButton
                    title="Camera"
                    icon="camera-outline"
                    onPress={takePhoto}
                    style={styles.small_button}
                  />
                  <PrimaryButton
                    title="Library"
                    icon="image-outline"
                    onPress={choosePhotos}
                    style={styles.small_button}
                  />
                </View>
              )}

              {locked ? (
                <View style={styles.button_row}>
                  <PrimaryButton
                    title="Close"
                    onPress={props.onClose}
                    style={styles.cancel_button}
                  />
                </View>
              ) : (
                <View>
                  <View style={styles.button_row}>
                    <PrimaryButton
                      title="Cancel"
                      onPress={handleCancel}
                      style={styles.cancel_button}
                    />
                    <PrimaryButton title="Save" onPress={handleSave} style={styles.save_button} />
                  </View>
                  <PrimaryButton
                    title="Delete Item"
                    icon="trash-outline"
                    text_color={COLORS.text_light}
                    onPress={confirmDelete}
                    style={styles.delete_button}
                  />
                </View>
              )}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* the full size photo sits on top of the form instead of opening a second modal */}
        {full_photo && (
          <Pressable style={styles.full_backdrop} onPress={() => setFullPhoto(null)}>
            <Image
              source={{ uri: getPhotoUri(full_photo, props.in_demo) }}
              style={styles.full_image}
              resizeMode="contain"
            />
            <Text style={styles.full_hint}>Tap to close</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default ChecklistItemModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
  },
  scroll_content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
  },
  worse_tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  worse_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 11,
  },
  compare_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  compare_box: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
  },
  compare_value: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: 2,
  },
  worse_value: {
    color: COLORS.danger,
  },
  switch_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  switch_text: {
    flex: 1,
    marginBottom: 0,
  },
  wrap_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  chip_text_active: {
    color: COLORS.text_light,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  notes_input: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  photo_wrap: {
    position: 'relative',
  },
  photo_thumb: {
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
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  small_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  cancel_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.secondary,
  },
  save_button: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: COLORS.success,
  },
  delete_button: {
    marginHorizontal: 0,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.danger,
  },
  full_backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.photo_backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  full_image: {
    width: '100%',
    height: '80%',
  },
  full_hint: {
    color: COLORS.text_light,
    fontFamily: FONTS.body,
    marginTop: SPACING.sm,
  },
});

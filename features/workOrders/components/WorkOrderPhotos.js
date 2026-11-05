import { View, Text, Image, Pressable, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImagePicker } from '../../../services/systemPickers';
import PrimaryButton from '../../../components/PrimaryButton';
import { max_photos_per_upload } from '../utils/workOrderHelpers';
import { COLORS, SPACING, TYPE, RADIUS } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the server takes photos up to 10 MB
const max_photo_bytes = 10485760;

// the photo part of the work order form, moved out of the screen so the form reads like the lecture's
// props: multiple (real mode keeps a list of up to 5 photos that get uploaded, the demo keeps one on the phone),
//   photos and onChangePhotos (the list), photoUri and onChangePhotoUri (the one local photo)
function WorkOrderPhotos(props) {
  const photos = props.photos || [];
  const photo_uri = props.photoUri;
  const remote_form = !!props.multiple;
  // I check the screen shape so the photo can shrink when it's wider than it is tall
  const { width, height } = useWindowDimensions();
  const is_landscape = width > height;

  // real mode keeps a list of photos, anything over 10 MB gets turned away
  function keepPhotos(assets) {
    const room = max_photos_per_upload - photos.length;
    const fitting = assets.filter((asset) => !asset.fileSize || asset.fileSize <= max_photo_bytes);
    if (fitting.length < assets.length) {
      Alert.alert('Photo too large', 'Photos have to be under 10 MB.');
    }
    props.onChangePhotos([
      ...photos,
      ...fitting
        .slice(0, room)
        .map((asset) => ({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' })),
    ]);
  }

  function removePhoto(index) {
    props.onChangePhotos(photos.filter((photo, photo_index) => photo_index !== index));
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
        props.onChangePhotoUri(result.assets[0].uri);
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
        props.onChangePhotoUri(result.assets[0].uri);
      }
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Photos (optional)</Text>
      {photo_uri && (
        <Image
          source={{ uri: photo_uri }}
          style={[styles.preview, is_landscape && styles.preview_landscape]}
          accessibilityLabel="Photo of the issue"
        />
      )}
      {remote_form && photos.length > 0 && (
        <ScrollView horizontal style={styles.chip_scroll} contentContainerStyle={styles.thumb_row}>
          {photos.map((photo, index) => (
            <View key={photo.uri + index}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <Pressable
                style={styles.remove_button}
                onPress={() => removePhoto(index)}
                hitSlop={12}
                accessibilityLabel="Remove photo"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle-outline" size={22} color={COLORS.danger_text} />
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
            variant="secondary"
            onPress={takePhoto}
            style={styles.photo_button}
          />
          <PrimaryButton
            title="Library"
            icon="image-outline"
            variant="secondary"
            onPress={choosePhoto}
            style={styles.photo_button}
          />
        </View>
      )}
    </View>
  );
}

export default WorkOrderPhotos;

const styles = themedStyles((COLORS) => ({
  section: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  // without this the horizontal list grows to fill the spare height and the chips stretch with it
  chip_scroll: {
    flexGrow: 0,
  },
  preview: {
    borderRadius: RADIUS.md,
    width: '100%',
    height: 160,
    marginBottom: SPACING.sm,
  },
  preview_landscape: {
    height: 120,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photo_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  thumb_row: {
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingRight: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  thumb: {
    borderRadius: RADIUS.md,
    width: 72,
    height: 72,
  },
  remove_button: {
    backgroundColor: COLORS.surface_raised,
    borderRadius: RADIUS.pill,
    position: 'absolute',
    top: -SPACING.sm,
    right: -SPACING.sm,
  },
}));

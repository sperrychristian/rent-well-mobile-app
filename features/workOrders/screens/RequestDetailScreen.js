import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import ErrorState from '../../../components/ErrorState';
import RemoteImage from '../../../components/RemoteImage';
import ImageViewerModal from '../../messages/components/ImageViewerModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { canTenantAddPhotos, photosLeft } from '../utils/workOrderHelpers';
import { formatDate } from '../../../utils/formatDate';
import { COLORS, SPACING, FONTS, TYPE, RADIUS } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import StatusPill from '../../../components/ui/StatusPill';

// the server takes photos up to 10 MB
const max_photo_bytes = 10485760;

// one of the tenant's requests: where it's at, the photos, and the landlord's notes
// it updates on its own when the landlord changes something, since it reads the live list
function RequestDetailScreen(props) {
  const insets = useSafeAreaInsets();
  const { getOrder, is_remote, ensureOrder, addOrderPhotos } = useWorkOrders();
  const order_id = props.route.params.workOrderId;
  const order = getOrder(order_id);

  const [load_error, setLoadError] = useState('');
  // goes up on Try Again so the effect asks again
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress_text, setProgressText] = useState('');
  const [viewer_url, setViewerUrl] = useState(null);

  const has_order = !!order;
  // the context hands out a new function every render, so the effect reads the latest one from here
  const ensure = useRef(ensureOrder);
  useEffect(() => {
    ensure.current = ensureOrder;
  });

  // a push tap can open a request that isn't in the list yet, so I ask the server for it
  useEffect(() => {
    if (has_order || !is_remote) {
      return;
    }
    ensure.current(order_id).catch((error) => {
      console.log('Could not load the request', error.message);
      setLoadError(error.message);
    });
  }, [order_id, attempt, is_remote, has_order]);

  if (!order) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: SPACING.md }]}>
        {load_error || !is_remote ? (
          <ErrorState
            message={load_error || 'That request could not be found.'}
            onRetry={() => {
              setLoadError('');
              setAttempt((current) => current + 1);
            }}
          />
        ) : (
          <ActivityIndicator color={COLORS.title} size="large" />
        )}
      </View>
    );
  }

  const room = photosLeft(order);
  // the demo keeps its one photo on the phone as order.photo, the server's photos are upload keys in order.photos
  const local_photo = !is_remote && order.photo ? order.photo : null;
  const photo_total = local_photo ? 1 : (order.photos || []).length;
  const can_add = is_remote && canTenantAddPhotos(order) && room > 0;

  // the photos go up one at a time, then get added to the request
  async function sendPhotos(assets) {
    const fitting = assets.filter((asset) => !asset.fileSize || asset.fileSize <= max_photo_bytes);
    if (fitting.length < assets.length) {
      Alert.alert('Photo too large', 'Photos have to be under 10 MB.');
    }
    const photos = fitting
      .slice(0, room)
      .map((asset) => ({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' }));
    if (photos.length === 0) {
      return;
    }
    setBusy(true);
    try {
      await addOrderPhotos(order_id, photos, (number, total) =>
        setProgressText('Uploading photo ' + number + ' of ' + total + '...'),
      );
    } catch (error) {
      console.log('Could not add photos', error.message);
      Alert.alert('Photos not added', error.message);
    }
    setProgressText('');
    setBusy(false);
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
      sendPhotos(result.assets);
    }
  }

  async function choosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: room,
    });
    if (!result.canceled) {
      sendPhotos(result.assets);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + SPACING.lg,
        }}
      >
        <Card>
          <View style={styles.top_line}>
            <Text style={[styles.heading, styles.title_big]}>{order.title}</Text>
            <StatusPill label={order.status} />
          </View>
          <Text style={styles.detail}>{order.property}</Text>
          <View style={styles.tag_row}>
            <StatusPill label={order.priority} />
          </View>
          {order.description ? <Text style={styles.body}>{order.description}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Progress</Text>
          <Text style={styles.detail}>Submitted: {formatDate(order.created_at)}</Text>
          <Text style={styles.detail}>
            Work started: {order.started_at ? formatDate(order.started_at) : 'Not yet'}
          </Text>
          <Text style={styles.detail}>
            Resolved: {order.resolved_at ? formatDate(order.resolved_at) : 'Not yet'}
          </Text>
        </Card>

        <Card>
          <Text style={styles.heading}>Landlord notes</Text>
          <Text style={styles.body}>{order.notes || 'No notes yet.'}</Text>
        </Card>

        <Card>
          <Text style={styles.heading}>Photos ({photo_total})</Text>
          {local_photo ? (
            <Pressable
              onPress={() => local_photo.uri && setViewerUrl(local_photo.uri)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open photo"
            >
              <Image source={local_photo} style={[styles.photo_thumb, styles.local_photo]} />
            </Pressable>
          ) : order.photos && order.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {order.photos.map((key) => (
                <RemoteImage
                  key={key}
                  attachment_key={key}
                  style={styles.photo_thumb}
                  onPress={setViewerUrl}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.detail}>No photos.</Text>
          )}
          {/* photos can only be added while nobody has started on it */}
          {can_add && (
            <View>
              {busy ? (
                <View style={styles.busy_row}>
                  <ActivityIndicator color={COLORS.title} />
                  <Text style={styles.detail}>{progress_text || 'Saving...'}</Text>
                </View>
              ) : (
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
                    onPress={choosePhotos}
                    style={styles.photo_button}
                  />
                </View>
              )}
            </View>
          )}
          {is_remote && order.status !== 'Open' && (
            <Text style={styles.helper}>Photos can be added while the request is still open.</Text>
          )}
        </Card>
      </ScrollView>
      <ImageViewerModal url={viewer_url} onClose={() => setViewerUrl(null)} />
    </View>
  );
}

export default RequestDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  heading: {
    ...TYPE.heading,
    flex: 1,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  badge_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  tag_row: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  detail: {
    ...list_styles.detail,
  },
  body: {
    ...TYPE.body,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
  photo_thumb: {
    width: 110,
    height: 110,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },
  local_photo: {
    borderRadius: RADIUS.md,
  },
  busy_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  photo_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  // the request itself is the big thing at the top
  title_big: {
    ...TYPE.title,
    color: COLORS.text,
  },
});

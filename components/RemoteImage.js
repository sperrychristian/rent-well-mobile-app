import { useState, useEffect } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, TYPE, SPACING, RADIUS } from '../constants/theme';
import { themedStyles } from '../util/themedStyles';

// shows an uploaded photo from its key, the key gets swapped for a short-lived url first
// props: attachment_key, style (size and corners), onPress (gets the url, optional)
// milestone 2: there's no upload server anymore, so the key is the photo's own uri (demo photos stay on the
// phone), Firebase records don't have photos until Storage is added
function RemoteImage(props) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  // goes up on a retry so the effect asks for the url again
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve(props.attachment_key)
      .then((fresh_url) => {
        if (active) {
          setUrl(fresh_url || null);
          setFailed(!fresh_url);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [props.attachment_key, attempt]);

  // an expired link is the usual reason a photo stops loading, so I throw it out and get a new one
  function retry() {
    setUrl(null);
    setFailed(false);
    setAttempt((current) => current + 1);
  }

  if (failed) {
    return (
      <Pressable
        style={[styles.frame, props.style, styles.center]}
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Reload photo"
      >
        <Ionicons name="image-outline" size={24} color={COLORS.text_muted} />
        <Text style={styles.retry_text}>Tap to reload</Text>
      </Pressable>
    );
  }

  if (!url) {
    return (
      <View style={[styles.frame, props.style, styles.center]}>
        <ActivityIndicator color={COLORS.text_muted} />
      </View>
    );
  }

  const image = (
    <Image
      source={{ uri: url }}
      style={[styles.frame, props.style]}
      onError={() => {
        if (attempt === 0) {
          retry();
        } else {
          setFailed(true);
        }
      }}
    />
  );

  if (!props.onPress) {
    return image;
  }
  return (
    <Pressable
      onPress={() => props.onPress(url)}
      accessibilityRole="imagebutton"
      accessibilityLabel="Open photo"
    >
      {image}
    </Pressable>
  );
}

export default RemoteImage;

const styles = themedStyles((COLORS) => ({
  frame: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TYPE.micro.fontSize,
    marginTop: SPACING.xxs,
  },
}));

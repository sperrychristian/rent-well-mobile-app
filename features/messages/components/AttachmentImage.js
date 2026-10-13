import { useState, useEffect, useRef } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMessages } from '../context/MessagesContext';
import { COLORS, SPACING, FONTS } from '../../../theme';

// shows a message photo, the key gets swapped for a short-lived url first
// props: attachment_key, onPress (gets the url for the full size view)
function AttachmentImage(props) {
  const { attachmentUrl, forgetAttachmentUrl } = useMessages();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  // goes up on a retry so the effect asks for the url again
  const [attempt, setAttempt] = useState(0);
  // the context hands out a new function every render, so the effect reads the latest one from here
  const getUrl = useRef(attachmentUrl);
  useEffect(() => {
    getUrl.current = attachmentUrl;
  });

  useEffect(() => {
    let active = true;
    getUrl
      .current(props.attachment_key)
      .then((fresh_url) => {
        if (active) {
          setUrl(fresh_url);
          setFailed(false);
        }
      })
      .catch((error) => {
        console.log('Could not get the photo link', error.message);
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
    forgetAttachmentUrl(props.attachment_key);
    setUrl(null);
    setFailed(false);
    setAttempt((current) => current + 1);
  }

  if (failed) {
    return (
      <Pressable style={[styles.frame, styles.center]} onPress={retry} accessibilityRole="button">
        <Ionicons name="image-outline" size={28} color={COLORS.text_muted} />
        <Text style={styles.retry_text}>Tap to reload photo</Text>
      </Pressable>
    );
  }

  if (!url) {
    return (
      <View style={[styles.frame, styles.center]}>
        <ActivityIndicator color={COLORS.text_muted} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => props.onPress(url)}
      accessibilityRole="imagebutton"
      accessibilityLabel="Open photo"
    >
      <Image
        source={{ uri: url }}
        style={styles.frame}
        onError={() => {
          if (attempt === 0) {
            retry();
          } else {
            setFailed(true);
          }
        }}
      />
    </Pressable>
  );
}

export default AttachmentImage;

const styles = StyleSheet.create({
  frame: {
    width: 200,
    height: 150,
    borderRadius: 10,
    backgroundColor: COLORS.muted,
    marginBottom: SPACING.xs,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
});

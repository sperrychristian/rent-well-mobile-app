import { Modal, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetHandle, sheet_styles } from '../../../components/ui/sheet';
import Button from '../../../components/ui/Button';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import { SPACING, TYPE } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the sheet before anything goes on the phone's calendar: how many, where they go, why the phone may ask,
// and in the demo, that these are sample events landing in the real calendar
// props: visible, count, needs_permission, demo_mode, onConfirm, onCancel
function AddToCalendarSheet(props) {
  const reduce_motion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const count_text = props.count === 1 ? '1 event' : props.count + ' events';
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={props.onCancel}
    >
      <View style={sheet_styles.backdrop}>
        <Pressable
          style={styles.dismiss}
          onPress={props.onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[sheet_styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <SheetHandle />
          <Text style={styles.title} accessibilityRole="header">
            {props.demo_mode ? 'Add sample events?' : 'Add to your calendar?'}
          </Text>
          <Text style={styles.message}>
            {'Rent Well will add ' +
              count_text +
              ' to a calendar called Rent Well on this phone, or to your default calendar if it can’t make one. Anything already added is skipped.'}
          </Text>
          {props.demo_mode ? (
            <Text style={styles.message}>
              This is the demo, so these are sample events. They go into your phone’s real calendar
              with “[Demo]” at the start of the title, and you can delete them there anytime.
            </Text>
          ) : null}
          {props.needs_permission ? (
            <Text style={styles.message}>
              Your phone will ask to let Rent Well use your calendar. Rent Well only uses it to add
              these events and to check it hasn’t added them already.
            </Text>
          ) : null}
          <View style={sheet_styles.button_row}>
            <Button
              title="Not Now"
              variant="secondary"
              onPress={props.onCancel}
              style={styles.button}
            />
            <Button
              title={props.demo_mode ? 'Add Samples' : 'Add Events'}
              icon="calendar-outline"
              variant="primary"
              onPress={props.onConfirm}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default AddToCalendarSheet;

const styles = themedStyles((COLORS) => ({
  dismiss: {
    flex: 1,
  },
  title: {
    ...TYPE.heading,
    color: COLORS.title,
    marginBottom: SPACING.sm,
  },
  message: {
    ...TYPE.body,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  button: {
    flex: 1,
  },
}));
